const crypto = require('node:crypto');

const key = () => crypto.createHash('sha256').update(String(process.env.BANK_ACCOUNT_ENCRYPTION_KEY || process.env.JWT_SECRET || '')).digest();

const encryptField = value => {
  if (!value || String(value).startsWith('enc:')) return value;
  if (!process.env.BANK_ACCOUNT_ENCRYPTION_KEY && !process.env.JWT_SECRET) throw new Error('Bank account encryption key is not configured');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  return `enc:${Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64')}`;
};

const decryptField = value => {
  if (!value || !String(value).startsWith('enc:')) return value;
  const payload = Buffer.from(String(value).slice(4), 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key(), payload.subarray(0, 12));
  decipher.setAuthTag(payload.subarray(12, 28));
  return Buffer.concat([decipher.update(payload.subarray(28)), decipher.final()]).toString('utf8');
};

module.exports = { encryptField, decryptField };
