import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt, { SignOptions } from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { body, validationResult } from 'express-validator';
import { config } from '../config';
import { UserModel, toPublicUser } from '../models/user.model';
import { asyncHandler } from '../utils/asyncHandler';
import { badRequest, unauthorized } from '../utils/httpError';
import { requireAuth } from '../middleware/auth';
import { checkPasswordPolicy } from '../utils/passwordPolicy';
import { recordAudit } from '../utils/audit';

const router = Router();

/** Aggressive limit on /login to slow down credential-stuffing. */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Try again in 15 minutes.' },
});

/** Lighter limit on /register so an attacker can't spawn a million accounts. */
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many accounts created from this IP. Try again later.' },
});

/** Per-account lockout policy. */
const MAX_FAILED = 5;
const LOCK_FOR_MS = 15 * 60 * 1000;

function signToken(user: { id: string; userName: string; role: 'admin' | 'user'; tokenVersion: number }): string {
  const payload = { userName: user.userName, role: user.role, tv: user.tokenVersion };
  return jwt.sign(payload, config.jwtSecret, {
    algorithm: 'HS256',
    expiresIn: config.jwtExpiresIn as SignOptions['expiresIn'],
    subject: user.id,
    issuer: 'tid-api',
    audience: 'tid-frontend',
  });
}

/** POST /api/auth/register */
router.post(
  '/register',
  registerLimiter,
  [
    body('userEmail').isEmail().normalizeEmail(),
    body('phone').isString().matches(/^\d{10}$/),
    body('userPassword').isString(),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw badRequest('Invalid registration payload', errors.array());
    }

    const userEmail: string = req.body.userEmail.toLowerCase().trim();
    const userName: string = (req.body.userName ?? userEmail.split('@')[0]).toLowerCase().trim();
    const phone: string = String(req.body.phone).trim();
    const plainPassword: string = String(req.body.userPassword);

    const policy = checkPasswordPolicy(plainPassword, { userName, userEmail });
    if (!policy.ok) {
      throw badRequest('Weak password', policy.reasons);
    }

    const existing = await UserModel.findOne({
      $or: [{ userEmail }, { userName }],
    });
    if (existing) {
      // Generic message — don't disclose which field clashed.
      throw badRequest('Username or email already registered');
    }

    const passwordHash = await bcrypt.hash(plainPassword, config.bcryptRounds);

    const user = await UserModel.create({
      userName,
      userEmail,
      phone,
      passwordHash,
      role: 'user',
      tokenVersion: 0,
    });

    recordAudit(req, 'user.registered', { userName }, { actorId: user.id, actorName: userName, targetId: user.id });

    res.status(201).json({
      message: 'Registration successful. Please log in.',
      user: toPublicUser(user),
    });
  })
);

/** POST /api/auth/login */
router.post(
  '/login',
  loginLimiter,
  [body('userName').isString().notEmpty(), body('userPassword').isString().notEmpty()],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw badRequest('Invalid login payload', errors.array());
    }

    const identifier = String(req.body.userName).toLowerCase().trim();
    const plainPassword = String(req.body.userPassword);

    const user = await UserModel.findOne({
      $or: [{ userName: identifier }, { userEmail: identifier }],
    }).select('+passwordHash +tokenVersion +failedLoginAttempts +lockUntil +lastLoginAt');

    if (!user) {
      // Run a real bcrypt comparison anyway so timing doesn't disclose
      // whether the username exists.
      await bcrypt.compare(plainPassword, '$2b$12$invalidinvalidinvalidinvalidinv.');
      recordAudit(req, 'login.failed', { reason: 'unknown_user', identifier });
      throw unauthorized('Invalid username or password');
    }

    // Per-account lockout check.
    const now = Date.now();
    const lockUntil = (user as any).lockUntil ?? 0;
    if (lockUntil && lockUntil > now) {
      const minutes = Math.ceil((lockUntil - now) / 60_000);
      recordAudit(req, 'login.locked', { identifier, until: new Date(lockUntil).toISOString() }, { targetId: user.id });
      throw unauthorized(
        `Account temporarily locked. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`
      );
    }

    const ok = await bcrypt.compare(plainPassword, (user as any).passwordHash);
    if (!ok) {
      const fails = ((user as any).failedLoginAttempts ?? 0) + 1;
      const updates: Record<string, unknown> = { failedLoginAttempts: fails };
      if (fails >= MAX_FAILED) {
        updates.lockUntil = now + LOCK_FOR_MS;
        updates.failedLoginAttempts = 0;
        recordAudit(req, 'login.lock-triggered', { identifier, fails }, { targetId: user.id });
      } else {
        recordAudit(req, 'login.failed', { reason: 'bad_password', identifier, fails }, { targetId: user.id });
      }
      await UserModel.findByIdAndUpdate(user.id, updates);
      throw unauthorized('Invalid username or password');
    }

    // Success — clear counters, update last login, audit.
    await UserModel.findByIdAndUpdate(user.id, {
      failedLoginAttempts: 0,
      lockUntil: 0,
      lastLoginAt: new Date(),
    });

    const token = signToken({
      id: user.id,
      userName: user.userName,
      role: user.role as 'admin' | 'user',
      tokenVersion: (user as any).tokenVersion ?? 0,
    });

    recordAudit(req, 'login.success', { userName: user.userName }, { actorId: user.id, actorName: user.userName });

    res.json({
      token,
      user: toPublicUser(user),
      message: 'Login successful',
    });
  })
);

/** GET /api/auth/me — used by the frontend to validate a stored token on boot. */
router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await UserModel.findById(req.auth!.sub);
    if (!user) throw unauthorized('Account no longer exists');
    res.json({ user: toPublicUser(user) });
  })
);

/** POST /api/auth/change-password — requires current password to confirm. */
router.post(
  '/change-password',
  requireAuth,
  [body('currentPassword').isString().notEmpty(), body('newPassword').isString().notEmpty()],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) throw badRequest('Invalid payload', errors.array());

    const user = await UserModel.findById(req.auth!.sub).select(
      '+passwordHash +tokenVersion'
    );
    if (!user) throw unauthorized();

    const ok = await bcrypt.compare(String(req.body.currentPassword), (user as any).passwordHash);
    if (!ok) {
      recordAudit(req, 'password.change.failed', { reason: 'bad_current' });
      throw unauthorized('Current password is incorrect');
    }

    const policy = checkPasswordPolicy(String(req.body.newPassword), {
      userName: user.userName,
      userEmail: user.userEmail,
    });
    if (!policy.ok) throw badRequest('Weak password', policy.reasons);

    const newHash = await bcrypt.hash(String(req.body.newPassword), config.bcryptRounds);
    await UserModel.findByIdAndUpdate(user.id, {
      passwordHash: newHash,
      passwordChangedAt: new Date(),
      tokenVersion: ((user as any).tokenVersion ?? 0) + 1,
      // Also clear any lock that might be in place.
      failedLoginAttempts: 0,
      lockUntil: 0,
    });

    recordAudit(req, 'password.changed', { userName: user.userName });

    res.json({ message: 'Password updated. Please log in again.' });
  })
);

/** POST /api/auth/logout-everywhere — revokes every token issued so far. */
router.post(
  '/logout-everywhere',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await UserModel.findById(req.auth!.sub).select('+tokenVersion');
    if (!user) throw unauthorized();
    await UserModel.findByIdAndUpdate(user.id, {
      $inc: { tokenVersion: 1 },
    });
    recordAudit(req, 'token.revoked', { reason: 'logout-everywhere' });
    res.json({ message: 'All sessions signed out. Please log in again.' });
  })
);

export const authRoutes = router;
