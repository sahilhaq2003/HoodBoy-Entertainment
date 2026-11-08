const jwt = require('jsonwebtoken');
const QRCode = require('qrcode');

const issuer = 'hbe-api';
const audience = 'hbe-linkup-entry';
const prefix = 'HBE-LINKUP:';

const secret = () => {
  if (!process.env.JWT_SECRET) throw new Error('Entry pass signing is not configured');
  return process.env.JWT_SECRET;
};

const createEntryPassToken = booking => jwt.sign({
  type: 'linkup-entry',
  bookingId: String(booking?._id || ''),
  bookingReference: String(booking?.bookingReference || ''),
}, secret(), { algorithm: 'HS256', issuer, audience, noTimestamp: true });

const extractEntryPassToken = rawValue => {
  const value = String(rawValue || '').trim();
  if (value.startsWith(prefix)) return value.slice(prefix.length).trim();
  try {
    const url = new URL(value);
    const queryToken = url.searchParams.get('token');
    if (queryToken) return queryToken;
    const match = url.pathname.match(/\/entry-pass\/([^/]+)$/);
    if (match) return decodeURIComponent(match[1]);
  } catch { /* The scanner normally returns the HBE-LINKUP prefix format. */ }
  return value;
};

const verifyEntryPassToken = rawValue => {
  const token = extractEntryPassToken(rawValue);
  const payload = jwt.verify(token, secret(), { algorithms: ['HS256'], issuer, audience });
  if (payload.type !== 'linkup-entry' || !payload.bookingId || !payload.bookingReference) throw new Error('Invalid Linkup entry pass');
  return { token, bookingId: String(payload.bookingId), bookingReference: String(payload.bookingReference) };
};

const entryPassQrUrl = booking => {
  const token = createEntryPassToken(booking);
  const apiBase = String(process.env.PUBLIC_API_URL || (process.env.NODE_ENV === 'production' ? 'https://api.hbe.lol' : 'http://localhost:5000')).replace(/\/$/, '');
  return `${apiBase}/api/lnk-up/public/entry-pass/${encodeURIComponent(token)}/qr`;
};

const entryPassQrBuffer = token => QRCode.toBuffer(`${prefix}${token}`, {
  type: 'png',
  width: 420,
  margin: 2,
  errorCorrectionLevel: 'M',
  color: { dark: '#100A27', light: '#FFFFFF' },
});

module.exports = { createEntryPassToken, extractEntryPassToken, verifyEntryPassToken, entryPassQrUrl, entryPassQrBuffer };
