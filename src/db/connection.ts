import mongoose from 'mongoose';
import { config } from '../config';

/**
 * Connect to MongoDB. Mongoose handles reconnection automatically;
 * we just await once at boot so we fail fast on bad credentials.
 */
export async function connectDb(): Promise<void> {
  mongoose.set('strictQuery', true);
  await mongoose.connect(config.mongoUri, {
    dbName: config.mongoDb,
    serverSelectionTimeoutMS: 8000,
    socketTimeoutMS: 45000,
  });

  mongoose.connection.on('error', (err) => {
    // eslint-disable-next-line no-console
    console.error('[mongo] connection error:', err.message);
  });
  mongoose.connection.on('disconnected', () => {
    // eslint-disable-next-line no-console
    console.warn('[mongo] disconnected');
  });

  // eslint-disable-next-line no-console
  console.log(`[mongo] connected · db=${config.mongoDb}`);
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
}
