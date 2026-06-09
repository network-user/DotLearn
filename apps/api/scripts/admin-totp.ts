import { createHash, randomInt } from 'node:crypto';

import { generateSecret, generateURI } from 'otplib';
import qrcode from 'qrcode';

const BACKUP_CODE_COUNT = 8;
const ISSUER = 'DotLearn';
const ACCOUNT = process.env.ADMIN_LOGIN ?? 'admin';

const generateBackupCodes = (count: number): { plain: string[]; hashed: string[] } => {
  const plain: string[] = [];
  const hashed: string[] = [];
  for (let index = 0; index < count; index += 1) {
    const left = randomInt(0, 0xffff).toString(16).padStart(4, '0').toUpperCase();
    const right = randomInt(0, 0xffff).toString(16).padStart(4, '0').toUpperCase();
    const code = `${left}-${right}`;
    plain.push(code);
    hashed.push(createHash('sha256').update(code).digest('hex'));
  }
  return { plain, hashed };
};

const main = async (): Promise<void> => {
  const secret = generateSecret();
  const otpauth = generateURI({
    issuer: ISSUER,
    label: ACCOUNT,
    secret,
  });
  const qr = await qrcode.toString(otpauth, { type: 'terminal', small: true });
  const { plain, hashed } = generateBackupCodes(BACKUP_CODE_COUNT);

  console.log('');
  console.log('Scan this QR code in Google Authenticator / Authy:');
  console.log('');
  console.log(qr);
  console.log(`Or enter the secret manually: ${secret}`);
  console.log(`otpauth URI: ${otpauth}`);
  console.log('');
  console.log('--- Backup codes (store somewhere safe — shown only once) ---');
  for (const code of plain) {
    console.log(`  ${code}`);
  }
  console.log('');
  console.log('Add these lines to apps/api/.env:');
  console.log('');
  console.log(`ADMIN_TOTP_SECRET=${secret}`);
  console.log(`ADMIN_BACKUP_CODES_HASHED=${JSON.stringify(hashed)}`);
  console.log('');
};

void main();
