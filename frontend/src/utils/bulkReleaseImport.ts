export type BulkCsvRow = Record<string, string> & { __line: string };

export const BULK_RELEASE_HEADERS = [
  'release_key', 'mode', 'release_title', 'artist', 'release_type', 'genre', 'sub_genre', 'language',
  'delivery_date', 'original_release_date', 'upc', 'copyright', 'publishing_copyright', 'catalog_number',
  'source_distributor', 'source_release_url', 'spotify_artist_url', 'ai_document_url', 'artwork_ai_usage', 'stores', 'territories', 'cover_file',
  'track_number', 'track_title', 'version', 'isrc', 'explicit', 'instrumental', 'composition_type',
  'copyright_type', 'rights_proof_url', 'ai_usage', 'writers', 'composers', 'producers',
  'mixing_engineers', 'mastering_engineers', 'featured_artists', 'performers', 'audio_file',
] as const;

const normalizeHeader = (value: string) => value.trim().toLowerCase().replace(/[\s-]+/g, '_');

/** RFC-4180 compatible parser for the small, user-supplied manifests used by bulk distribution. */
export const parseBulkCsv = (source: string): BulkCsvRow[] => {
  const text = source.replace(/^\uFEFF/, '');
  const matrix: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { cell += '"'; index += 1; }
      else if (char === '"') quoted = false;
      else cell += char;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === ',') { row.push(cell.trim()); cell = ''; }
    else if (char === '\n') { row.push(cell.trim()); matrix.push(row); row = []; cell = ''; }
    else if (char !== '\r') cell += char;
  }
  if (quoted) throw new Error('CSV contains an unclosed quoted value.');
  if (cell || row.length) { row.push(cell.trim()); matrix.push(row); }
  const nonEmpty = matrix.filter(values => values.some(Boolean));
  if (nonEmpty.length < 2) throw new Error('CSV must contain a header and at least one track row.');
  const headers = nonEmpty[0].map(normalizeHeader);
  if (new Set(headers).size !== headers.length) throw new Error('CSV contains duplicate column names.');
  for (const required of ['release_key', 'release_title', 'track_number', 'track_title', 'audio_file', 'cover_file']) {
    if (!headers.includes(required)) throw new Error(`CSV is missing the required "${required}" column.`);
  }
  return nonEmpty.slice(1).map((values, rowIndex) => {
    const result: BulkCsvRow = { __line: String(rowIndex + 2) };
    headers.forEach((header, columnIndex) => { result[header] = String(values[columnIndex] || '').trim(); });
    return result;
  });
};

export const splitBulkList = (value = '') => value.split('|').map(item => item.trim()).filter(Boolean);
export const bulkBoolean = (value = '') => ['1', 'true', 'yes', 'y'].includes(value.trim().toLowerCase());

export const parseBulkPerformers = (value = '') => splitBulkList(value).map(entry => {
  const [name, ...roleParts] = entry.split('::');
  return { name: String(name || '').trim(), role: roleParts.join('::').trim() };
}).filter(item => item.name || item.role);

const escapeCsv = (value: unknown) => {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export const buildBulkTemplate = (artist = '') => {
  const delivery = new Date();
  delivery.setUTCDate(delivery.getUTCDate() + 21);
  const deliveryDate = delivery.toISOString().slice(0, 10);
  const values: Record<string, string>[] = [
    {
      release_key: 'release-001', mode: 'catalog_transfer', release_title: 'Existing Single', artist,
      release_type: 'single', genre: 'Hip-Hop', sub_genre: 'Hip-Hop', language: 'English',
      delivery_date: deliveryDate, original_release_date: '2024-06-14', upc: '123456789012',
      copyright: '2024 HoodBoy Entertainment', publishing_copyright: '2024 HoodBoy Entertainment',
      source_distributor: 'DistroKid', source_release_url: 'https://open.spotify.com/album/replace-me',
      spotify_artist_url: 'https://open.spotify.com/artist/replace-me', stores: 'Spotify|Apple Music|YouTube Music',
      territories: 'WORLDWIDE', cover_file: 'release-001-cover.jpg', track_number: '1',
      track_title: 'Existing Single', version: 'Original', isrc: 'USABC2400001', explicit: 'false',
      instrumental: 'false', composition_type: 'Original', copyright_type: 'Original', ai_usage: 'None',
      writers: 'Writer Legal Name', composers: 'Composer Legal Name', producers: 'Producer Legal Name',
      mixing_engineers: 'Mixing Engineer', mastering_engineers: 'Mastering Engineer',
      performers: 'Artist Name::Lead Vocals', audio_file: 'release-001-track-01.wav',
    },
    {
      release_key: 'release-002', mode: 'new_release', release_title: 'New Single', artist,
      release_type: 'single', genre: 'Hip-Hop', sub_genre: 'Hip-Hop', language: 'English',
      delivery_date: deliveryDate, copyright: `${delivery.getUTCFullYear()} HoodBoy Entertainment`,
      stores: 'Spotify|Apple Music', territories: 'WORLDWIDE', cover_file: 'release-002-cover.jpg',
      track_number: '1', track_title: 'New Single', version: 'Original', explicit: 'false', instrumental: 'false',
      composition_type: 'Original', copyright_type: 'Original', ai_usage: 'None', writers: 'Writer Legal Name',
      composers: 'Composer Legal Name', producers: 'Producer Legal Name', mixing_engineers: 'Mixing Engineer',
      mastering_engineers: 'Mastering Engineer', performers: 'Artist Name::Lead Vocals',
      audio_file: 'release-002-track-01.wav',
    },
  ];
  return [BULK_RELEASE_HEADERS.join(','), ...values.map(row => BULK_RELEASE_HEADERS.map(header => escapeCsv(row[header] || '')).join(','))].join('\r\n');
};

export const buildDistroKidTransferTemplate = (artist = '') => {
  const delivery = new Date();
  delivery.setUTCDate(delivery.getUTCDate() + 14);
  const deliveryDate = delivery.toISOString().slice(0, 10);
  const values: Record<string, string>[] = [
    {
      release_key: 'dk-single-001', mode: 'catalog_transfer', release_title: 'Midnight Drive', artist,
      release_type: 'single', genre: 'Hip-Hop', sub_genre: 'Hip-Hop', language: 'English',
      delivery_date: deliveryDate, original_release_date: '2024-03-15', upc: '198588123456',
      copyright: '2024 HoodBoy Entertainment', publishing_copyright: '2024 HoodBoy Entertainment',
      source_distributor: 'DistroKid', source_release_url: 'https://open.spotify.com/album/4EXAMPLEALBUM1',
      spotify_artist_url: 'https://open.spotify.com/artist/4EXAMPLEARTIST', stores: 'Spotify|Apple Music|YouTube Music|TIDAL|Amazon|Deezer|TikTok',
      territories: 'WORLDWIDE', cover_file: 'dk-single-001-cover.jpg', track_number: '1',
      track_title: 'Midnight Drive', version: 'Original', isrc: 'QZK6L2400001', explicit: 'false',
      instrumental: 'false', composition_type: 'Original', copyright_type: 'Original', ai_usage: 'None',
      writers: 'First Last', composers: 'First Last', producers: 'Producer Legal Name',
      mixing_engineers: 'Mixing Engineer Name', mastering_engineers: 'Mastering Engineer Name',
      performers: 'Artist Legal Name::Lead Vocals', audio_file: 'dk-single-001-track-01.wav',
    },
    {
      release_key: 'dk-ep-002', mode: 'catalog_transfer', release_title: 'City Lights EP', artist,
      release_type: 'ep', genre: 'Hip-Hop', sub_genre: 'Hip-Hop', language: 'English',
      delivery_date: deliveryDate, original_release_date: '2023-11-10', upc: '198588654321',
      copyright: '2023 HoodBoy Entertainment', publishing_copyright: '2023 HoodBoy Entertainment',
      source_distributor: 'DistroKid', source_release_url: 'https://open.spotify.com/album/4EXAMPLEALBUM2',
      spotify_artist_url: 'https://open.spotify.com/artist/4EXAMPLEARTIST', stores: 'Spotify|Apple Music|YouTube Music|TIDAL|Amazon|Deezer|TikTok',
      territories: 'WORLDWIDE', cover_file: 'dk-ep-002-cover.jpg', track_number: '1',
      track_title: 'City Lights Intro', version: 'Original', isrc: 'QZK6L2300101', explicit: 'false',
      instrumental: 'false', composition_type: 'Original', copyright_type: 'Original', ai_usage: 'None',
      writers: 'First Last', composers: 'First Last', producers: 'Producer Legal Name',
      mixing_engineers: 'Mixing Engineer Name', mastering_engineers: 'Mastering Engineer Name',
      performers: 'Artist Legal Name::Lead Vocals', audio_file: 'dk-ep-002-track-01.wav',
    },
    {
      release_key: 'dk-ep-002', mode: 'catalog_transfer', release_title: 'City Lights EP', artist,
      release_type: 'ep', genre: 'Hip-Hop', sub_genre: 'Hip-Hop', language: 'English',
      delivery_date: deliveryDate, original_release_date: '2023-11-10', upc: '198588654321',
      copyright: '2023 HoodBoy Entertainment', publishing_copyright: '2023 HoodBoy Entertainment',
      source_distributor: 'DistroKid', source_release_url: 'https://open.spotify.com/album/4EXAMPLEALBUM2',
      spotify_artist_url: 'https://open.spotify.com/artist/4EXAMPLEARTIST', stores: 'Spotify|Apple Music|YouTube Music|TIDAL|Amazon|Deezer|TikTok',
      territories: 'WORLDWIDE', cover_file: 'dk-ep-002-cover.jpg', track_number: '2',
      track_title: 'Skyline Views', version: 'Original', isrc: 'QZK6L2300102', explicit: 'true',
      instrumental: 'false', composition_type: 'Original', copyright_type: 'Original', ai_usage: 'None',
      writers: 'First Last', composers: 'First Last', producers: 'Producer Legal Name',
      mixing_engineers: 'Mixing Engineer Name', mastering_engineers: 'Mastering Engineer Name',
      performers: 'Artist Legal Name::Lead Vocals', audio_file: 'dk-ep-002-track-02.wav',
    },
  ];
  return [BULK_RELEASE_HEADERS.join(','), ...values.map(row => BULK_RELEASE_HEADERS.map(header => escapeCsv(row[header] || '')).join(','))].join('\r\n');
};

/**
 * Ensures any cover image (such as a 1400x1400 or 2000x2000 px cover downloaded from DistroKid Vault)
 * is automatically center-cropped and converted to DistriBeats' required 3000x3000 px RGB JPEG.
 */
export const ensureCover3000x3000 = async (file: File): Promise<File> => {
  const img = await new Promise<HTMLImageElement | null>(resolve => {
    const url = URL.createObjectURL(file);
    const el = new Image();
    el.onload = () => { URL.revokeObjectURL(url); resolve(el); };
    el.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    el.src = url;
  });
  if (!img || !img.naturalWidth || !img.naturalHeight) return file;
  const origW = img.naturalWidth;
  const origH = img.naturalHeight;
  const ext = file.name.toLowerCase().split('.').pop() || '';
  if (
    origW === 3000 &&
    origH === 3000 &&
    ['jpg', 'jpeg', 'png'].includes(ext) &&
    ['image/jpeg', 'image/png'].includes(file.type) &&
    file.size <= 24 * 1024 * 1024
  ) {
    return file;
  }

  const canvas = document.createElement('canvas');
  canvas.width = 3000;
  canvas.height = 3000;
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  ctx.fillStyle = '#09090b';
  ctx.fillRect(0, 0, 3000, 3000);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  const scale = Math.max(3000 / origW, 3000 / origH);
  const drawW = origW * scale;
  const drawH = origH * scale;
  ctx.drawImage(img, (3000 - drawW) / 2, (3000 - drawH) / 2, drawW, drawH);

  const baseName = file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9-_]+/g, '-') || 'cover';
  const adjusted = await new Promise<File | null>(resolve => {
    canvas.toBlob(blob => {
      if (!blob) return resolve(null);
      resolve(new File([blob], `${baseName}-3000x3000.jpg`, { type: 'image/jpeg' }));
    }, 'image/jpeg', 0.94);
  });
  return adjusted || file;
};
