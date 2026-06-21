import { NextFunction, Request, Response } from 'express';

/**
 * Wrap async route handlers so thrown / rejected errors flow into Express's
 * error pipeline instead of crashing the process.
 */
export function asyncHandler<T = unknown>(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<T>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
