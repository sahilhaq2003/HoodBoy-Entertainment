const test = require('node:test');
const assert = require('node:assert/strict');
const sharp = require('sharp');
const { optimizeImageBuffer } = require('../services/imageOptimizationService');

test('uploaded images are resized and converted to WebP', async () => {
  const source = await sharp({ create: { width: 3200, height: 1800, channels: 3, background: '#6d28d9' } }).png().toBuffer();
  const result = await optimizeImageBuffer(source);
  assert.equal(result.format, 'webp');
  assert.equal(result.width, 1920);
  assert.equal(result.height, 1080);
  assert.ok(result.optimizedBytes < result.originalBytes);
  assert.equal((await sharp(result.buffer).metadata()).format, 'webp');
});

test('invalid image content is rejected even when an upload MIME type was spoofed', async () => {
  await assert.rejects(() => optimizeImageBuffer(Buffer.from('not an image')), /image|format|unsupported/i);
});
