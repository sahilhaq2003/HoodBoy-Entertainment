const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createEntryPassToken,
  extractEntryPassToken,
  verifyEntryPassToken,
  entryPassQrBuffer,
  entryPassQrUrl,
} = require('../services/entryPassService');

test('Linkup entry passes are deterministic, signed and booking-specific', () => {
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'entry-pass-test-secret-with-sufficient-length';
  try {
    const booking = { _id: 'booking-123', bookingReference: 'LNK-2026-001' };
    const token = createEntryPassToken(booking);
    assert.equal(createEntryPassToken(booking), token);
    assert.equal(extractEntryPassToken(`HBE-LINKUP:${token}`), token);
    assert.deepEqual(verifyEntryPassToken(`HBE-LINKUP:${token}`), {
      token,
      bookingId: booking._id,
      bookingReference: booking.bookingReference,
    });
    assert.throws(() => verifyEntryPassToken(`${token.slice(0, -1)}x`));
  } finally {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  }
});

test('Linkup entry pass QR output is a PNG and uses the public API URL', async () => {
  const previousSecret = process.env.JWT_SECRET;
  const previousApiUrl = process.env.PUBLIC_API_URL;
  process.env.JWT_SECRET = 'entry-pass-test-secret-with-sufficient-length';
  process.env.PUBLIC_API_URL = 'https://api.example.test/';
  try {
    const booking = { _id: 'booking-456', bookingReference: 'LNK-2026-002' };
    const token = createEntryPassToken(booking);
    const image = await entryPassQrBuffer(token);
    assert.deepEqual([...image.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    assert.match(entryPassQrUrl(booking), /^https:\/\/api\.example\.test\/api\/lnk-up\/public\/entry-pass\/.+\/qr$/);
  } finally {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
    if (previousApiUrl === undefined) delete process.env.PUBLIC_API_URL;
    else process.env.PUBLIC_API_URL = previousApiUrl;
  }
});
