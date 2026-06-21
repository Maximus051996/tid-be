import { config } from './config';
import { connectDb, disconnectDb } from './db/connection';
import { createApp } from './app';
import { seedDefaultAccounts } from './seed';

async function main(): Promise<void> {
  await connectDb();
  await seedDefaultAccounts();

  const app = createApp();
  const server = app.listen(config.port, config.host, () => {
    // eslint-disable-next-line no-console
    console.log(
      `[server] listening on http://${config.host}:${config.port} · env=${
        config.isProd ? 'production' : 'development'
      }`
    );
  });

  const shutdown = async (signal: string): Promise<void> => {
    // eslint-disable-next-line no-console
    console.log(`[server] received ${signal}, shutting down...`);
    server.close(async () => {
      await disconnectDb();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 8000).unref();
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[server] fatal startup error:', err);
  process.exit(1);
});
