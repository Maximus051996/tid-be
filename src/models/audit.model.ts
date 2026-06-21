import { Schema, model, InferSchemaType, Types } from 'mongoose';

/**
 * Append-only audit trail for security-relevant events. Capped collection
 * keeps the size bounded (oldest entries roll off automatically).
 *
 * Use `recordAudit()` from `utils/audit.ts` so callers don't think about
 * the schema directly.
 */
const auditSchema = new Schema(
  {
    actorId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    actorName: { type: String, default: '' },
    targetId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    /** e.g. 'login.success', 'login.failed', 'login.locked', 'role.changed',
     *  'user.removed', 'user.wiped', 'password.changed', 'token.revoked'. */
    event: { type: String, required: true, index: true },
    /** Free-form context — IP, user-agent, before/after role, etc. Never PII. */
    meta: { type: Schema.Types.Mixed, default: {} },
    ip: { type: String, default: '' },
    userAgent: { type: String, default: '' },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Capped collection — last 50k entries kept.
auditSchema.set('autoIndex', true);

export type AuditDoc = InferSchemaType<typeof auditSchema> & { _id: Types.ObjectId };
export const AuditModel = model('AuditLog', auditSchema);
