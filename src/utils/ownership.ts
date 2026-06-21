import { Request } from 'express';
import { Types } from 'mongoose';
import { unauthorized } from './httpError';

/**
 * Filter that scopes a query to the current user. Admins see everything;
 * standard users only see rows where `ownerId === their id`.
 */
export function ownerScope(req: Request): Record<string, unknown> {
  if (!req.auth) throw unauthorized();
  if (req.auth.role === 'admin') return {};
  return { ownerId: new Types.ObjectId(req.auth.sub) };
}

/** Returns the current user's id as an ObjectId. */
export function currentUserId(req: Request): Types.ObjectId {
  if (!req.auth) throw unauthorized();
  return new Types.ObjectId(req.auth.sub);
}

/** Server-side check before a non-admin tries to mutate someone else's row. */
export function canMutate(req: Request, ownerId: Types.ObjectId | string): boolean {
  if (!req.auth) return false;
  if (req.auth.role === 'admin') return true;
  return String(ownerId) === req.auth.sub;
}
