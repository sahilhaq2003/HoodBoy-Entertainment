const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { resolveLinkupImagePath, removeLinkupImage } = require('../services/linkupImageCleanupService');

test('Linkup image cleanup removes only files inside the managed upload directory', async () => {
  const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'hbe-linkup-images-'));
  const image = path.join(root, 'event.webp');
  await fs.promises.writeFile(image, 'image');
  assert.equal(resolveLinkupImagePath('/uploads/linkup/event.webp', root), image);
  assert.equal(await removeLinkupImage('/uploads/linkup/event.webp', { root }), true);
  assert.equal(fs.existsSync(image), false);
  await fs.promises.rm(root, { recursive: true, force: true });
});

test('Linkup image cleanup ignores external URLs and traversal attempts', async () => {
  const root = path.join(os.tmpdir(), 'hbe-linkup-images-safe');
  assert.equal(resolveLinkupImagePath('https://example.com/image.webp', root), null);
  assert.equal(resolveLinkupImagePath('/uploads/linkup/../secret.env', root), null);
  assert.equal(resolveLinkupImagePath('/uploads/images/profile.webp', root), null);
});
