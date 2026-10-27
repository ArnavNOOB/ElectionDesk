export * from '../../scripts/createAdmin.js';
import { createAdminAccount } from '../../scripts/createAdmin.js';

if (process.argv[1]?.endsWith('createAdmin.js')) {
  createAdminAccount()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[FATAL] Administrator provisioning failed:', err.message);
      process.exit(1);
    });
}
