import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { UserModel } from '../models/user.model';
import { forbidden, unauthorized } from '../utils/httpError';

export interface AuthClaims {
  sub: string;          // user id
  userName: string;
  role: 'admin' | 'user';
  /** Token-version snapshot at issue time. */
  tv: number;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthClaims;
    }
  }
}

/**
 * Verify the Bearer token AND check that the token-version still matches
 * the current value on the user record. Bumping `tokenVersion` on the
 * user (e.g. on password change or "logout everywhere") invalidates every
 * token issued before the bump — even if they're still within their TTL.
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.header('Authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return next(unauthorized('Missing bearer token'));

  let decoded: jwt.JwtPayload;
  try {
    decoded = jwt.verify(match[1], config.jwtSecret, {
      algorithms: ['HS256'],
    }) as jwt.JwtPayload;
  } catch {
    return next(unauthorized('Invalid or expired token'));
  }

  if (!decoded || typeof decoded !== 'object' || !decoded.sub) {
    return next(unauthorized('Invalid token'));
  }

  const claims: AuthClaims = {
    sub: String(decoded.sub),
    userName: String(decoded.userName ?? ''),
    role: decoded.role === 'admin' ? 'admin' : 'user',
    tv: typeof decoded.tv === 'number' ? decoded.tv : 0,
  };

  // Verify the user still exists and the tokenVersion hasn't been bumped.
  // This is the cheap-but-correct way to support real logout-everywhere.
  UserModel.findById(claims.sub)
    .select('+tokenVersion role')
    .then((user) => {
      if (!user) return next(unauthorized('Account no longer exists'));
      const currentTv = (user as any).tokenVersion ?? 0;
      if (currentTv !== claims.tv) {
        return next(unauthorized('Session has been revoked'));
      }
      // Refresh role from DB in case admin demoted them since issue time.
      claims.role = user.role as 'admin' | 'user';
      req.auth = claims;
      next();
    })
    .catch(next);
}

/** Restrict a route to specific roles. Use after requireAuth. */
export function requireRole(...roles: Array<'admin' | 'user'>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.auth) return next(unauthorized());
    if (!roles.includes(req.auth.role)) return next(forbidden('Insufficient role'));
    next();
  };
}
