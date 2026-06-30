import { createHash, randomBytes, randomInt } from 'node:crypto';

import bcrypt from 'bcryptjs';
import { generateSecret, generateURI } from 'otplib';
import qrcode from 'qrcode';

const BACKUP_CODE_COUNT = 8;
const ISSUER = 'DotLearn';

const out = (line) => process.stdout.write(`${line}\n`);
const note = (line) => process.stderr.write(`${line}\n`);

const generateBackupCodes = (count) => {
  const plain = [];
  const hashed = [];
  for (let index = 0; index < count; index += 1) {
    const left = randomInt(0, 0xffff).toString(16).padStart(4, '0').toUpperCase();
    const right = randomInt(0, 0xffff).toString(16).padStart(4, '0').toUpperCase();
    const code = `${left}-${right}`;
    plain.push(code);
    hashed.push(createHash('sha256').update(code).digest('hex'));
  }
  return { plain, hashed };
};

const readStdin = () =>
  new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      data += chunk;
    });
    process.stdin.on('end', () => resolve(data));
  });

const main = async () => {
  const piped = process.stdin.isTTY ? '' : (await readStdin()).replace(/\r?\n$/, '');
  const password = piped || process.argv[2] || '';
  if (!password || password.length < 8) {
    note('Usage: printf %s <password> | node scripts/gen-admin-secrets.mjs');
    note('Password must be at least 8 characters.');
    process.exit(1);
  }
  const login = process.env.ADMIN_LOGIN ?? 'admin';
  const rounds = Number(process.env.BCRYPT_ROUNDS ?? 12);

  const passwordHash = await bcrypt.hash(password, rounds);
  const totpSecret = generateSecret();
  const otpauth = generateURI({ issuer: ISSUER, label: login, secret: totpSecret });
  const accessSecret = randomBytes(48).toString('hex');
  const refreshSecret = randomBytes(48).toString('hex');
  const { plain, hashed } = generateBackupCodes(BACKUP_CODE_COUNT);
  const qr = await qrcode.toString(otpauth, { type: 'terminal', small: true });

  note('');
  note('=== Scan this QR in Google Authenticator / Authy (shown once) ===');
  note('');
  note(qr);
  note(`Manual TOTP secret: ${totpSecret}`);
  note('');
  note('=== Backup codes (store somewhere safe — shown once) ===');
  for (const code of plain) note(`  ${code}`);
  note('');

  out(`ADMIN_PASSWORD_HASH=${passwordHash}`);
  out(`ADMIN_TOTP_SECRET=${totpSecret}`);
  out(`ADMIN_BACKUP_CODES_HASHED=${JSON.stringify(hashed)}`);
  out(`ADMIN_JWT_SECRET=${accessSecret}`);
  out(`ADMIN_REFRESH_SECRET=${refreshSecret}`);
};

void main();
