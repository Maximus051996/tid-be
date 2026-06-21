import pino from 'pino';
import { config } from '../config';

/**
 * Structured logger. Pretty-printed in dev, JSON in production so it
 * ships cleanly to log aggregators.
 */
export const logger = pino({
  level: config.isProd ? 'info' : 'debug',
  transport: config.isProd
    ? undefined
    : {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' },
      },
  // Never log secrets even if a careless caller passes them.
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      '*.password',
      '*.userPassword',
      '*.passwordHash',
      '*.currentPassword',
      '*.newPassword',
    ],
    censor: '[REDACTED]',
  },
});
