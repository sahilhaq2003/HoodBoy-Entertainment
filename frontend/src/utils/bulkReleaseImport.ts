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
