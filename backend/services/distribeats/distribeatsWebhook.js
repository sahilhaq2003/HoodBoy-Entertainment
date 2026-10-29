const crypto = require('crypto');
const { DistribeatsError } = require('./distribeatsClient');

const verifyWebhook = (rawBody, { signature, timestamp }, secret = process.env.DISTRIBEATS_WEBHOOK_SECRET) => {
  if (!secret) throw new DistribeatsError('Distribeats webhook secret is not configured.', { code: 'DISTRIBEATS_WEBHOOK_NOT_CONFIGURED', status: 503 });
  if (!Buffer.isBuffer(rawBody)) throw new DistribeatsError('Webhook body must be raw bytes.', { code: 'DISTRIBEATS_INVALID_SIGNATURE', status: 401 });
  const time = Number(timestamp);
  const supplied = String(signature || '').replace(/^sha256=/i, '');
  if (!Number.isFinite(time) || !/^[a-f0-9]{64}$/i.test(supplied)) throw new DistribeatsError('Invalid Distribeats webhook signature.', { code: 'DISTRIBEATS_INVALID_SIGNATURE', status: 401 });
  if (Math.abs(Date.now() - time) > 5 * 60 * 1000) throw new DistribeatsError('Stale Distribeats webhook delivery.', { code: 'DISTRIBEATS_STALE_WEBHOOK', status: 401 });
  const expected = crypto.createHmac('sha256', secret).update(`${time}.`).update(rawBody).digest();
  const actual = Buffer.from(supplied, 'hex');
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) throw new DistribeatsError('Invalid Distribeats webhook signature.', { code: 'DISTRIBEATS_INVALID_SIGNATURE', status: 401 });
  try { return JSON.parse(rawBody.toString('utf8')); }
  catch { throw new DistribeatsError('Invalid Distribeats webhook JSON.', { code: 'DISTRIBEATS_INVALID_PAYLOAD', status: 400 }); }
};

module.exports = { verifyWebhook };
