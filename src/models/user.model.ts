import { Schema, model, InferSchemaType, HydratedDocument } from 'mongoose';

const userSchema = new Schema(
  {
    userName: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    userEmail: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    phone: { type: String, required: true, trim: true },
    /** bcrypt hash — never plaintext. */
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['admin', 'user'], default: 'user', index: true },

    // ===== Security fields =====

    /**
     * Bumped on every "logout everywhere" or password change.
     * Tokens encode the user's `tokenVersion` at issue time; if it
     * doesn't match the current value, the token is rejected — even
     * if it's not yet expired.
     */
    tokenVersion: { type: Number, default: 0, select: false },

    /** Counter of consecutive failed logins; cleared on success. */
    failedLoginAttempts: { type: Number, default: 0, select: false },

    /** Epoch ms until which login is rejected (per-account lockout). */
    lockUntil: { type: Number, default: 0, select: false, index: true },

    /** ISO timestamp of the last successful login. */
    lastLoginAt: { type: Date, default: null, select: false },

    /** ISO timestamp of the last password change (used for forced re-auth). */
    passwordChangedAt: { type: Date, default: null, select: false },
  },
  { timestamps: true }
);

export type UserDoc = HydratedDocument<InferSchemaType<typeof userSchema>>;
export const UserModel = model('User', userSchema);

/** Public-safe shape returned over the wire. */
export interface PublicUser {
  id: string;
  userName: string;
  userEmail: string;
  phone: string;
  role: 'admin' | 'user';
  createdAt: string;
}

export function toPublicUser(u: UserDoc): PublicUser {
  return {
    id: u.id,
    userName: u.userName,
    userEmail: u.userEmail,
    phone: u.phone,
    role: u.role as 'admin' | 'user',
    createdAt: (u as any).createdAt?.toISOString?.() ?? new Date().toISOString(),
  };
}
