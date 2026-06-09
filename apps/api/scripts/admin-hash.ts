import bcrypt from 'bcryptjs';

const main = async (): Promise<void> => {
  const password = process.argv[2];
  if (!password || password.length < 8) {
    console.error('Usage: pnpm admin:hash <password>');
    console.error('Password must be at least 8 characters.');
    process.exit(1);
  }
  const rounds = Number(process.env.BCRYPT_ROUNDS ?? 12);
  const hash = await bcrypt.hash(password, rounds);
  console.log('');
  console.log('Add this line to apps/api/.env:');
  console.log('');
  console.log(`ADMIN_PASSWORD_HASH=${hash}`);
  console.log('');
};

void main();
