const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');

const JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
let cachedKeys = new Map();
let cacheExpiresAt = 0;

const loadKeys = async () => {
  if (cachedKeys.size && Date.now() < cacheExpiresAt) return cachedKeys;
  const response = await fetch(JWKS_URL, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error('Google signing keys are temporarily unavailable');
  const body = await response.json();
  cachedKeys = new Map((body.keys || []).map(jwk => [jwk.kid, crypto.createPublicKey({ key: jwk, format: 'jwk' }).export({ type: 'spki', format: 'pem' })]));
  const maxAge = Number.parseInt(response.headers.get('cache-control')?.match(/max-age=(\d+)/)?.[1] || '3600', 10);
  cacheExpiresAt = Date.now() + Math.max(300, maxAge) * 1000;
  return cachedKeys;
};

const verifyGoogleCredential = async credential => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw new Error('Google sign-in is not configured');
  if (!credential || String(credential).length > 10000) throw new Error('Google credential is required');
  const decoded = jwt.decode(String(credential), { complete: true });
  if (!decoded?.header?.kid || decoded.header.alg !== 'RS256') throw new Error('Invalid Google credential');
  const keys = await loadKeys();
  const publicKey = keys.get(decoded.header.kid);
  if (!publicKey) {
    cacheExpiresAt = 0;
    const refreshed = await loadKeys();
    if (!refreshed.get(decoded.header.kid)) throw new Error('Unknown Google signing key');
  }
  const payload = jwt.verify(String(credential), cachedKeys.get(decoded.header.kid), {
    algorithms: ['RS256'], audience: clientId,
    issuer: ['accounts.google.com', 'https://accounts.google.com'],
  });
  if (!payload.sub || !payload.email || payload.email_verified !== true) throw new Error('Google email is not verified');
  return payload;
};

const resetGoogleKeyCache = () => { cachedKeys = new Map(); cacheExpiresAt = 0; };
module.exports = { verifyGoogleCredential, _resetGoogleKeyCache: resetGoogleKeyCache };
