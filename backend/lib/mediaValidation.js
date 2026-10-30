/**
 * Authoritative media validation for DistriBeats distribution assets.
 *
 * Audio  : WAV or FLAC only (extension + MIME + file signature), size capped by the provider limit.
 * Artwork: JPG or PNG, RGB, exactly 3000x3000 px (extension + MIME + size + decoded header dimensions).
 *
 * Pure functions return arrays of { field, message, code }; the *File helpers read the header from disk.
 */
const fs = require('fs');
const path = require('path');

const AUDIO_EXTENSIONS = new Set(['.wav', '.flac']);
const AUDIO_MIME = new Set([
  'audio/wav', 'audio/x-wav', 'audio/wave', 'audio/vnd.wave',
  'audio/flac', 'audio/x-flac',
]);
// Browsers sometimes label lossless files generically; the file signature stays authoritative.
const GENERIC_MIME = new Set(['', 'application/octet-stream', 'binary/octet-stream']);
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png']);
const IMAGE_MIME = new Set(['image/jpeg', 'image/jpg', 'image/png']);
const REQUIRED_ARTWORK = Object.freeze({ width: 3000, height: 3000 });

const ext = name => path.extname(String(name || '')).toLowerCase();
const err = (field, message, code) => ({ field, message, code });
const mb = bytes => `${Math.round(bytes / 1_000_000)} MB`;

const validateAudioMeta = ({ name, mimetype, size }, { maxBytes, field = 'audio' } = {}) => {
  const errors = [];
  if (!AUDIO_EXTENSIONS.has(ext(name))) {
    errors.push(err(field, `Audio must be WAV or FLAC (received "${ext(name) || 'no extension'}"). AIFF, MP3, M4A and other formats are not accepted.`, 'AUDIO_FORMAT'));
  }
  const mime = String(mimetype || '').toLowerCase();
  if (!AUDIO_MIME.has(mime) && !GENERIC_MIME.has(mime)) {
    errors.push(err(field, `Audio MIME type "${mime}" is not allowed; use audio/wav or audio/flac.`, 'AUDIO_MIME'));
  }
  if (!Number.isFinite(Number(size)) || Number(size) <= 0) errors.push(err(field, 'Audio file is empty.', 'AUDIO_EMPTY'));
  else if (maxBytes && Number(size) > maxBytes) {
    errors.push(err(field, `Audio file is ${mb(Number(size))}; the DistriBeats limit is ${mb(maxBytes)} (${maxBytes.toLocaleString('en-US')} bytes).`, 'AUDIO_TOO_LARGE'));
  }
  return errors;
};

/** 'wav' | 'flac' | null from the leading bytes. */
const sniffAudio = buffer => {
  if (!buffer || buffer.length < 4) return null;
  if (buffer.toString('latin1', 0, 4) === 'fLaC') return 'flac';
  if (buffer.length >= 12 && buffer.toString('latin1', 0, 4) === 'RIFF' && buffer.toString('latin1', 8, 12) === 'WAVE') return 'wav';
  return null;
};

const readHead = async (filePath, bytes) => {
  const handle = await fs.promises.open(filePath, 'r');
  try {
    const buffer = Buffer.alloc(bytes);
    const { bytesRead } = await handle.read(buffer, 0, bytes, 0);
    return buffer.subarray(0, bytesRead);
  } finally { await handle.close(); }
};

const validateAudioFile = async (filePath, meta, options = {}) => {
  const errors = validateAudioMeta(meta, options);
  if (errors.length) return errors;
  const kind = sniffAudio(await readHead(filePath, 12));
  const claimed = ext(meta.name).slice(1);
  if (!kind) errors.push(err(options.field || 'audio', 'File contents are not a valid WAV or FLAC stream.', 'AUDIO_SIGNATURE'));
  else if (kind !== claimed) errors.push(err(options.field || 'audio', `File extension says ${claimed.toUpperCase()} but the contents are ${kind.toUpperCase()}.`, 'AUDIO_SIGNATURE_MISMATCH'));
  return errors;
};

/* ── Artwork ────────────────────────────────────────────────────────────── */

const validateArtworkMeta = ({ name, mimetype, size }, { maxBytes, field = 'cover' } = {}) => {
  const errors = [];
  if (!IMAGE_EXTENSIONS.has(ext(name))) errors.push(err(field, `Artwork must be JPG or PNG (received "${ext(name) || 'no extension'}").`, 'ART_FORMAT'));
  if (!IMAGE_MIME.has(String(mimetype || '').toLowerCase())) errors.push(err(field, `Artwork MIME type "${mimetype || 'unknown'}" is not allowed; use image/jpeg or image/png.`, 'ART_MIME'));
  if (!Number.isFinite(Number(size)) || Number(size) <= 0) errors.push(err(field, 'Artwork file is empty.', 'ART_EMPTY'));
  else if (maxBytes && Number(size) > maxBytes) errors.push(err(field, `Artwork is ${(Number(size) / 1048576).toFixed(1)} MiB; the limit is ${(maxBytes / 1048576).toFixed(0)} MiB.`, 'ART_TOO_LARGE'));
  return errors;
};

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** { format, width, height, colorSpace } or null when the bytes are not a readable PNG/JPEG. */
const parseImageInfo = buffer => {
  if (!buffer || buffer.length < 24) return null;
  if (buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    if (buffer.toString('latin1', 12, 16) !== 'IHDR') return null;
    const colorType = buffer[25];
    const colorSpace = colorType === 2 || colorType === 6 ? 'RGB' : colorType === 0 || colorType === 4 ? 'Grayscale' : 'Indexed';
    return { format: 'PNG', width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20), colorSpace };
  }
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) { offset += 1; continue; }
      const marker = buffer[offset + 1];
      if (marker === 0xff) { offset += 1; continue; }
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { offset += 2; continue; }
      const length = buffer.readUInt16BE(offset + 2);
      const isSof = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
      if (isSof) {
        const components = buffer[offset + 9];
        return {
          format: 'JPG',
          height: buffer.readUInt16BE(offset + 5),
          width: buffer.readUInt16BE(offset + 7),
          colorSpace: components === 3 ? 'RGB' : components === 4 ? 'CMYK' : 'Grayscale',
        };
      }
      offset += 2 + length;
    }
  }
  return null;
};

const validateImageInfo = (info, { field = 'cover', required = REQUIRED_ARTWORK } = {}) => {
  if (!info) return [err(field, 'Artwork contents are not a valid JPG or PNG image.', 'ART_UNREADABLE')];
  const errors = [];
  if (info.width !== required.width || info.height !== required.height) {
    errors.push(err(field, `Artwork must be exactly ${required.width}x${required.height} px (received ${info.width}x${info.height}).`, 'ART_DIMENSIONS'));
  }
  if (info.colorSpace !== 'RGB') errors.push(err(field, `Artwork must use the RGB colour space (received ${info.colorSpace}).`, 'ART_COLOR_SPACE'));
  return errors;
};

const validateArtworkFile = async (filePath, meta, options = {}) => {
  const errors = validateArtworkMeta(meta, options);
  if (errors.length) return { errors, info: null };
  const buffer = await fs.promises.readFile(filePath);
  const info = parseImageInfo(buffer);
  const claimed = ext(meta.name) === '.png' ? 'PNG' : 'JPG';
  const problems = validateImageInfo(info, options);
  if (info && info.format !== claimed) problems.push(err(options.field || 'cover', `File extension says ${claimed} but the contents are ${info.format}.`, 'ART_SIGNATURE_MISMATCH'));
  return { errors: problems, info };
};

/**
 * Chunk plan for the provider multipart upload.
 * Every part except the last must be between 5 MiB and 95 MiB; 50 MiB is recommended.
 */
const MIN_PART = 5 * 1024 * 1024;
const MAX_PART = 95 * 1024 * 1024;
const planParts = (size, partSize = 50 * 1024 * 1024) => {
  const effective = Math.min(Math.max(Number(partSize) || 50 * 1024 * 1024, MIN_PART), MAX_PART);
  const parts = [];
  for (let start = 0, number = 1; start < size; start += effective, number += 1) {
    parts.push({ partNumber: number, start, end: Math.min(start + effective, size) });
  }
  return parts;
};

module.exports = {
  AUDIO_EXTENSIONS, IMAGE_EXTENSIONS, REQUIRED_ARTWORK,
  validateAudioMeta, validateAudioFile, sniffAudio,
  validateArtworkMeta, validateArtworkFile, parseImageInfo, validateImageInfo,
  planParts, MIN_PART, MAX_PART,
};

