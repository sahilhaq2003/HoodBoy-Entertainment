const sharp = require('sharp');

const MAX_INPUT_PIXELS = 40_000_000;
const DEFAULT_MAX_DIMENSION = 1920;
const DEFAULT_QUALITY = 82;

const optimizeImageBuffer = async (input, options = {}) => {
  if (!Buffer.isBuffer(input) || !input.length) throw new Error('The uploaded image is empty');
  const maxDimension = Math.min(2560, Math.max(320, Number(options.maxDimension || DEFAULT_MAX_DIMENSION)));
  const quality = Math.min(90, Math.max(65, Number(options.quality || DEFAULT_QUALITY)));
  const source = sharp(input, { failOn: 'warning', limitInputPixels: MAX_INPUT_PIXELS });
  const metadata = await source.metadata();
  if (!['jpeg', 'png', 'webp'].includes(metadata.format)) throw new Error('The uploaded file is not a valid JPG, PNG, or WEBP image');
  if (!metadata.width || !metadata.height) throw new Error('The uploaded image dimensions could not be read');

  const buffer = await source
    .rotate()
    .resize({ width: maxDimension, height: maxDimension, fit: 'inside', withoutEnlargement: true })
    .webp({ quality, effort: 4, smartSubsample: true })
    .toBuffer();
  const output = await sharp(buffer).metadata();
  return {
    buffer,
    width: output.width,
    height: output.height,
    format: 'webp',
    originalBytes: input.length,
    optimizedBytes: buffer.length,
  };
};

module.exports = { optimizeImageBuffer, MAX_INPUT_PIXELS, DEFAULT_MAX_DIMENSION, DEFAULT_QUALITY };
