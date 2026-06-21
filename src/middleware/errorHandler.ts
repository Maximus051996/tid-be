import { NextFunction, Request, Response } from 'express';
import { HttpError } from '../utils/httpError';

/**
 * Single source of truth for error responses.
 * In production we deliberately *don't* leak stack traces.
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  if (err instanceof HttpError) {
    res.status(err.status).json({
      error: err.message,
      details: err.details ?? undefined,
    });
    return;
  }

  // Mongoose validation errors → 400
  if (err && typeof err === 'object' && (err as any).name === 'ValidationError') {
    const e = err as { message: string; errors?: Record<string, { message: string }> };
    res.status(400).json({
      error: 'Validation failed',
      details: Object.fromEntries(
        Object.entries(e.errors ?? {}).map(([k, v]) => [k, v.message])
      ),
    });
    return;
  }

  // Mongo duplicate key → 409
  if ((err as any)?.code === 11000) {
    res.status(409).json({
      error: 'Resource already exists',
      details: (err as any).keyValue,
    });
    return;
  }

  // eslint-disable-next-line no-console
  console.error('[error]', err);
  res.status(500).json({ error: 'Internal server error' });
}
