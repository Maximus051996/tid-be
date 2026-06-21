/**
 * Centralized password policy. Used by both /register and /change-password.
 *
 * The blocklist is small but covers the bottom-line worst cases.
 * For a serious deployment, swap in a HIBP-style hashed list.
 */

const COMMON_PASSWORDS = new Set<string>([
  'password',
  'password1',
  'password123',
  '12345678',
  '123456789',
  'qwerty123',
  'admin@123',
  'user@123',
  'demo@123',
  'letmein',
  'welcome1',
  'iloveyou',
  'changeme',
  'p@ssw0rd',
]);

export interface PolicyCheck {
  ok: boolean;
  reasons: string[];
}

export function checkPasswordPolicy(plain: string, context: { userName?: string; userEmail?: string } = {}): PolicyCheck {
  const reasons: string[] = [];

  if (typeof plain !== 'string' || plain.length < 8) {
    reasons.push('Must be at least 8 characters long.');
  }
  if (plain.length > 128) {
    reasons.push('Must be at most 128 characters long.');
  }
  if (!/[A-Za-z]/.test(plain)) reasons.push('Must contain at least one letter.');
  if (!/\d/.test(plain)) reasons.push('Must contain at least one digit.');
  if (!/[^A-Za-z0-9]/.test(plain)) {
    // Non-fatal but recommended — surface as a warning-style message.
    reasons.push('Should contain at least one symbol for stronger security.');
  }

  // Commonality check — case insensitive.
  if (COMMON_PASSWORDS.has(plain.toLowerCase())) {
    reasons.push('That password is too common. Please choose a stronger one.');
  }

  // Don't allow the password to match the username/email obviously.
  const lower = plain.toLowerCase();
  if (context.userName && lower.includes(context.userName.toLowerCase())) {
    reasons.push('Password must not contain your username.');
  }
  if (context.userEmail) {
    const local = context.userEmail.toLowerCase().split('@')[0];
    if (local && lower.includes(local)) {
      reasons.push('Password must not contain the email local part.');
    }
  }

  return { ok: reasons.length === 0, reasons };
}
