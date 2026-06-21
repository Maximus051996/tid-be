# TID Backend

Express + TypeScript + MongoDB API for the TID frontend.

## Stack

- **Node.js** (>= 18) + **TypeScript**
- **Express 4** for HTTP
- **Mongoose** for MongoDB modeling
- **bcrypt** for password hashing
- **jsonwebtoken** (HS256) for stateless sessions with token-version revocation
- **helmet** for security headers, **compression**, **express-mongo-sanitize**, **hpp**
- **express-rate-limit** for global + per-route brute-force defense
- **express-validator** for request validation
- **pino** + **pino-http** for structured logs (with secret redaction)

## Local setup

```bash
# 1. Install deps
cd server
npm install

# 2. Configure env
cp .env.example .env
# Open .env and fill in:
#   - MONGODB_URI   (Atlas connection string)
#   - JWT_SECRET    (run: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")

# 3. Run in watch mode
npm run dev
# → http://localhost:3001

# 4. Build for production
npm run build
npm start
```

The server seeds two accounts on first boot **only if the users
collection is empty**:

| Role  | Username | Password   |
|-------|----------|------------|
| admin | admin    | Admin@123  |
| user  | demo     | Demo@123   |

Change them immediately after first login.

## API surface

All routes are prefixed `/api`.

| Verb   | Path                                          | Auth     | Notes                                       |
|--------|-----------------------------------------------|----------|---------------------------------------------|
| POST   | `/api/auth/register`                          | -        | rate-limited; password policy enforced      |
| POST   | `/api/auth/login`                             | -        | rate-limited; per-account lockout (5/15m)   |
| GET    | `/api/auth/me`                                | bearer   | validates current token                     |
| POST   | `/api/auth/change-password`                   | bearer   | bumps tokenVersion → forces re-login        |
| POST   | `/api/auth/logout-everywhere`                 | bearer   | revokes every token issued so far           |
| GET    | `/api/tasks`                                  | bearer   | scoped to current user                      |
| POST   | `/api/tasks`                                  | bearer   |                                             |
| GET    | `/api/tasks/:id`                              | bearer   |                                             |
| PUT    | `/api/tasks/:id`                              | bearer   |                                             |
| DELETE | `/api/tasks/:id`                              | bearer   | soft-delete                                 |
| GET    | `/api/investments`                            | bearer   |                                             |
| POST   | `/api/investments`                            | bearer   |                                             |
| GET    | `/api/investments/:id`                        | bearer   |                                             |
| PUT    | `/api/investments/:id`                        | bearer   |                                             |
| DELETE | `/api/investments/:id`                        | bearer   | soft-delete                                 |
| GET    | `/api/notes`                                  | bearer   |                                             |
| POST   | `/api/notes`                                  | bearer   |                                             |
| GET    | `/api/notes/:id`                              | bearer   |                                             |
| PUT    | `/api/notes/:id`                              | bearer   |                                             |
| PATCH  | `/api/notes/:id/toggle-pin`                   | bearer   |                                             |
| DELETE | `/api/notes/:id`                              | bearer   | hard-delete                                 |
| GET    | `/api/goals`                                  | bearer   |                                             |
| POST   | `/api/goals`                                  | bearer   |                                             |
| GET    | `/api/goals/:id`                              | bearer   |                                             |
| PUT    | `/api/goals/:id`                              | bearer   |                                             |
| PATCH  | `/api/goals/:id/status`                       | bearer   |                                             |
| PATCH  | `/api/goals/:id/milestones/:mid/toggle`       | bearer   |                                             |
| DELETE | `/api/goals/:id`                              | bearer   | hard-delete                                 |
| GET    | `/api/users`                                  | admin    |                                             |
| PATCH  | `/api/users/:id/role`                         | admin    | bumps target's tokenVersion                 |
| POST   | `/api/users/:id/wipe-data`                    | admin    | clear data, keep account                    |
| DELETE | `/api/users/:id`                              | admin    | cascade-remove                              |

## Security checklist

### Authentication
- [x] Passwords stored as bcrypt hashes (12 rounds; configurable)
- [x] Password policy: ≥8 chars, letters+digits required, blocklist of common passwords, can't contain username/email
- [x] Per-account lockout — 5 failed attempts triggers a 15-minute lock
- [x] Constant-time comparison for unknown-user case (dummy bcrypt)
- [x] JWT signed with HS256 + 30-min default TTL
- [x] **Token versioning** — `tokenVersion` on the user record; password-change and `/logout-everywhere` bump it → instant invalidation of every prior token
- [x] Role refreshed from DB on every request (admin can demote in real time)

### Transport / network
- [x] CORS allowlist driven by env (`CORS_ORIGINS`); never `*`
- [x] Helmet security headers (X-Content-Type-Options, X-Frame-Options, Referrer-Policy, etc.)
- [x] HSTS enabled in production
- [x] Compression for response bodies
- [x] Trust the first proxy so `req.ip` and rate-limiter see real IPs

### Input handling
- [x] `express-mongo-sanitize` strips `$` and `.` from request keys → blocks NoSQL injection like `{"userName": {"$ne": null}}`
- [x] `hpp` blocks HTTP Parameter Pollution
- [x] `express-validator` on every auth route
- [x] Mongo `ObjectId.isValid` check on every `:id` route
- [x] Body size capped at 256 KB
- [x] Owner-scoped queries: standard users can only see/edit their own rows
- [x] Admin role gate on user-management routes

### Rate limiting
- [x] Global limiter: 300 req / minute
- [x] `/login`: 20 / 15 min
- [x] `/register`: 10 / hour

### Observability / forensics
- [x] **Audit log collection** — append-only events for `login.success`, `login.failed`, `login.locked`, `login.lock-triggered`, `password.changed`, `password.change.failed`, `token.revoked`, `role.changed`, `user.removed`, `user.wiped`, `user.registered`
- [x] Pino structured logs in JSON for prod, pretty for dev
- [x] Authorization, cookies, and password fields auto-redacted from logs

### Build / deployment
- [x] `.env` git-ignored; `.env.example` committed
- [x] `JWT_SECRET` minimum-length check enforced in production
- [x] No source maps in prod (handled at the build pipeline level)
- [x] No request-body logging (avoids credentials in logs)

## Production deployment

Set these env vars on the host:

- `NODE_ENV=production`
- `MONGODB_URI` — Atlas SRV string with a strong password
- `JWT_SECRET` — at least 64 bytes of entropy
- `CORS_ORIGINS` — your real frontend URL, no wildcards
- `BCRYPT_ROUNDS` — bump to 13 if your CPU can spare ~500ms/login

Always run behind HTTPS. Behind a reverse proxy, the app already calls
`app.set('trust proxy', 1)` so client IPs are correct.

### Recommended additions for a hardened deployment

- Restrict the Mongo Atlas user to **only the `tid` database** (least privilege)
- Lock Atlas IP allowlist to your server's egress IP — never leave it `0.0.0.0/0`
- Rotate `JWT_SECRET` at least once a year; tokens are 30-min so cutover is fast
- Set up a logging sink (Datadog, Logtail, ELK) and watch for `login.failed`
  and `login.lock-triggered` events
