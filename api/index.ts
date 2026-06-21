/**
 * Vercel serverless entry point.
 *
 * Vercel does not run `app.listen(...)` — it invokes a default-exported
 * request handler per request. We wrap our existing Express app so the
 * same routes/middleware power both `npm run dev` (locally) and the
 * deployed function (on Vercel).
 */
import type { IncomingMessage, ServerResponse } from 'http';
import { createApp } from '../src/app';
import { connectDb } from '../src/db/connection';
import { seedDefaultAccounts } from '../src/seed';

// The Express app is built once per cold start and reused across warm
// invocations on the same lambda instance.
const app = createApp();

// Mongoose holds a connection pool on the module — reuse it across
// invocations so we don't reconnect on every request.
let dbReady: Promise<void> | null = null;

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  if (!dbReady) {
    dbReady = connectDb()
      .then(() => seedDefaultAccounts())
      .catch((err) => {
        // Reset so the next request retries, instead of being stuck on a
        // permanently-rejected promise.
        dbReady = null;
        throw err;
      });
  }
  await dbReady;
  return (app as unknown as (req: IncomingMessage, res: ServerResponse) => void)(req, res);
}
