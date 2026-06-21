import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import mongoSanitize from 'express-mongo-sanitize';
import hpp from 'hpp';
import pinoHttp from 'pino-http';
import { config } from './config';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { authRoutes } from './routes/auth.routes';
import { taskRoutes } from './routes/tasks.routes';
import { investmentRoutes } from './routes/investments.routes';
import { noteRoutes } from './routes/notes.routes';
import { goalRoutes } from './routes/goals.routes';
import { userRoutes } from './routes/users.routes';

export function createApp(): express.Express {
  const app = express();

  // === Trust the first proxy (Nginx / Render / Cloudflare) ===
  // Required so express-rate-limit and req.ip see the real client IP.
  app.set('trust proxy', 1);

  // === Structured request logging — never logs request bodies ===
  app.use(
    pinoHttp({
      logger,
      autoLogging: { ignore: (req) => req.url === '/health' },
      customLogLevel: (_req, res, err) => {
        if (err || res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },
      // Strip headers that could leak credentials in logs.
      serializers: {
        req: (req) => ({
          method: req.method,
          url: req.url,
          remoteAddress: req.remoteAddress,
        }),
      },
    })
  );

  // === Security headers ===
  app.use(
    helmet({
      contentSecurityPolicy: false, // CSP belongs on the frontend host, not the API
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      hsts: config.isProd
        ? { maxAge: 31536000, includeSubDomains: true, preload: false }
        : false,
      referrerPolicy: { policy: 'no-referrer' },
    })
  );

  // === CORS ===
  app.use(
    cors({
      origin(origin, cb) {
        if (!origin) return cb(null, true);
        if (config.corsOrigins.includes(origin)) return cb(null, true);
        return cb(new Error(`Origin ${origin} not allowed by CORS`));
      },
      credentials: false, // we use Bearer tokens, not cookies
      maxAge: 600,
    })
  );

  // === Compression ===
  app.use(compression());

  // === Body parser with sane size cap ===
  app.use(express.json({ limit: '256kb' }));

  // === NoSQL injection sanitizer ===
  // Strips $ and . from req.body / req.query / req.params keys to block
  // attacks like {"userName": {"$ne": null}} on login.
  app.use(mongoSanitize());

  // === HTTP Parameter Pollution ===
  app.use(hpp());

  // === Global rate limit (cheap floor against runaway clients) ===
  app.use(
    rateLimit({
      windowMs: 60 * 1000,
      limit: 300,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
    })
  );

  // === Health check ===
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ ok: true, ts: new Date().toISOString() });
  });

  // === API routes ===
  app.use('/api/auth', authRoutes);
  app.use('/api/tasks', taskRoutes);
  app.use('/api/investments', investmentRoutes);
  app.use('/api/notes', noteRoutes);
  app.use('/api/goals', goalRoutes);
  app.use('/api/users', userRoutes);

  // === 404 ===
  app.use((_req, res) => {
    res.status(404).json({ error: 'Route not found' });
  });

  // === Error handler — must be last ===
  app.use(errorHandler);

  return app;
}
