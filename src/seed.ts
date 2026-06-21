import bcrypt from 'bcrypt';
import { config } from './config';
import { UserModel } from './models/user.model';

/**
 * Insert the default admin/demo accounts on first boot if neither exists.
 * Idempotent — running this on an existing DB is a no-op.
 */
export async function seedDefaultAccounts(): Promise<void> {
  const count = await UserModel.estimatedDocumentCount();
  if (count > 0) return;

  const adminHash = await bcrypt.hash('Admin@123', config.bcryptRounds);
  const demoHash = await bcrypt.hash('Demo@123', config.bcryptRounds);

  await UserModel.create([
    {
      userName: 'admin',
      userEmail: 'admin@tid.com',
      phone: '9999999999',
      passwordHash: adminHash,
      role: 'admin',
    },
    {
      userName: 'demo',
      userEmail: 'demo@tid.com',
      phone: '8888888888',
      passwordHash: demoHash,
      role: 'user',
    },
  ]);

  // eslint-disable-next-line no-console
  console.log('[seed] inserted default admin + demo accounts');
}
