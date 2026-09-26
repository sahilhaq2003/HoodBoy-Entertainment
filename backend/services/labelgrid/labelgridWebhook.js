const crypto = require('crypto');
const { LabelGridError } = require('./labelgridErrors');

const verifyWebhook = (rawBody, signature, secret = process.env.LABELGRID_WEBHOOK_SECRET) => {
  if (!secret) throw new LabelGridError('LabelGrid webhook secret is not configured.', { code: 'LABELGRID_WEBHOOK_NOT_CONFIGURED', status: 503 });
  if (!Buffer.isBuffer(rawBody) || !/^[a-f0-9]{64}$/i.test(signature || '')) throw new LabelGridError('Invalid LabelGrid webhook signature.', { code: 'LABELGRID_INVALID_SIGNATURE', status: 401 });
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const actual = Buffer.from(signature, 'hex'); const wanted = Buffer.from(expected, 'hex');
  if (actual.length !== wanted.length || !crypto.timingSafeEqual(actual, wanted)) throw new LabelGridError('Invalid LabelGrid webhook signature.', { code: 'LABELGRID_INVALID_SIGNATURE', status: 401 });
  const payload = JSON.parse(rawBody.toString('utf8'));
  const sentAt = new Date(payload.timestamp).getTime();
  if (!Number.isFinite(sentAt) || Math.abs(Date.now() - sentAt) > 5 * 60 * 1000) throw new LabelGridError('Stale LabelGrid webhook delivery.', { code: 'LABELGRID_STALE_WEBHOOK', status: 401 });
  return payload;
};

module.exports = { verifyWebhook };
