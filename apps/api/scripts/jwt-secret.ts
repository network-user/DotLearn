import { randomBytes } from 'node:crypto';

const main = (): void => {
  const access = randomBytes(48).toString('hex');
  const refresh = randomBytes(48).toString('hex');
  console.log('');
  console.log('Add these lines to apps/api/.env:');
  console.log('');
  console.log(`ADMIN_JWT_SECRET=${access}`);
  console.log(`ADMIN_REFRESH_SECRET=${refresh}`);
  console.log('');
};

main();
