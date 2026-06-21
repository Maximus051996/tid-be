import { Request } from 'express';
import { Types } from 'mongoose';
import { AuditModel } from '../models/audit.model';

/**
 * Persist a security event. Fire-and-forget — we never let a failed
 * audit write block the actual request, but we do log it.
 */
export function recordAudit(
  req: Request | null,
  event: string,
  meta: Record<string, unknown> = {},
  overrides: { actorId?: string | Types.ObjectId; targetId?: string | Types.ObjectId; actorName?: string } = {}
): void {
  const ip = req
    ? (req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() || req.ip || '')
    : '';
  const userAgent = req ? (req.headers['user-agent']?.toString() ?? '') : '';
  const actorId = overrides.actorId ?? req?.auth?.sub;
  const actorName = overrides.actorName ?? req?.auth?.userName ?? '';
  const targetId = overrides.targetId;

  AuditModel.create({
    actorId: actorId ? new Types.ObjectId(actorId) : null,
    actorName,
    targetId: targetId ? new Types.ObjectId(targetId) : null,
    event,
    meta,
    ip,
    userAgent,
  }).catch((err) => {
    // eslint-disable-next-line no-console
    console.warn('[audit] write failed:', (err as Error).message);
  });
}
