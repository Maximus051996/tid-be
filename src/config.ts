import dotenv from 'dotenv';
import path from 'path';

// Load .env from the server root (one level up from src/).
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

/**
 * Read an env var or die on missing — fail fast at boot if the secret
 * isn't present. We deliberately avoid silent fallbacks for credentials.
 */
function required(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    // eslint-disable-next-line no-console
    console.error(`\n[config] FATAL — missing required env var: ${name}\n`);
    process.exit(1);
  }
  return value.trim();
}

function optional(name: string, fallback: string): string {
  return (process.env[name] ?? fallback).trim();
}

function intOrDefault(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const isProd = optional('NODE_ENV', 'development') === 'production';

export const config = {
  isProd,
  host: optional('HOST', '0.0.0.0'),
  port: intOrDefault('PORT', 3001),
  mongoUri: required('MONGODB_URI'),
  mongoDb: optional('MONGODB_DB', 'tid'),
  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: optional('JWT_EXPIRES_IN', '30m'),
  bcryptRounds: intOrDefault('BCRYPT_ROUNDS', 12),
  corsOrigins: optional('CORS_ORIGINS', 'http://localhost:4200')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
};

// Belt-and-suspenders: never accept a placeholder JWT secret in prod.
if (isProd && config.jwtSecret.length < 32) {
  // eslint-disable-next-line no-console
  console.error(
    '[config] FATAL — JWT_SECRET must be at least 32 characters in production.'
  );
  process.exit(1);
}
