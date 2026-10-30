/**
 * Builds an editable distribution track/release prefill from existing Music Catalog records.
 * Pure: it only reads the records passed in and never mutates them. Users review/override everything in the form.
 */
const path = require('path');
const { displayName, list } = require('./distribeatsMapper');
const { catalogueSets } = require('./distribeatsValidation');

const unique = items => {
  const seen = new Set();
  return items.map(item => String(item || '').trim()).filter(item => {
    const key = item.toLowerCase();
    if (!item || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};
const plain = value => (value && typeof value.toObject === 'function' ? value.toObject() : value) || {};
const AUDIO_EXT = /\.(wav|flac)$/i;
const AUDIO_VERSION_PRIORITY = ['wav_high_quality', 'explicit_master', 'clean_master', 'performance_version', 'radio_edit'];

const matchCatalogue = (value, values) => {
  const wanted = String(value || '').trim().toLowerCase();
  if (!wanted) return '';
  for (const candidate of values) if (candidate.toLowerCase() === wanted) return candidate;
  return '';
};
const matchLanguage = (value, catalogue) => {
  const wanted = String(value || '').trim().toLowerCase();
  if (!wanted) return '';
  const found = (catalogue?.languages || []).find(item => {
    const v = String(item.value ?? item).toLowerCase();
    return v === wanted || String(item.label || '').toLowerCase().startsWith(`${wanted} `) || String(item.label || '').toLowerCase() === wanted;
  });
  return found ? String(found.value ?? found) : '';
};

const pickAudio = song => {
  const candidates = [];
  const versions = Array.isArray(song.versions) ? song.versions : [];
  AUDIO_VERSION_PRIORITY.forEach(type => versions.filter(version => version.type === type).forEach(version => candidates.push({ type, fileUrl: version.fileUrl, fileName: version.fileName })));
  versions.forEach(version => candidates.push({ type: version.type, fileUrl: version.fileUrl, fileName: version.fileName }));
  if (song.fileUrl) candidates.push({ type: 'master', fileUrl: song.fileUrl, fileName: path.basename(song.fileUrl) });
  const hit = candidates.find(item => item.fileUrl && AUDIO_EXT.test(item.fileName || item.fileUrl));
  return hit ? { ...hit, fileName: hit.fileName || path.basename(hit.fileUrl) } : null;
};

const buildImport = ({ song: songInput, metadata: metadataInput, ownership: ownershipInput, artist: artistInput }, catalogue) => {
  const song = plain(songInput);
  const metadata = plain(metadataInput);
  const ownership = plain(ownershipInput);
  const artist = plain(artistInput);
  const sets = catalogueSets(catalogue);
  const warnings = [];

  const credits = [
    ...(Array.isArray(song.credits) ? song.credits : []),
    ...(Array.isArray(metadata.credits) ? metadata.credits : []),
  ];
  const byRole = (...roles) => credits.filter(credit => credit && roles.includes(credit.role)).map(credit => credit.name);
  const ownWriters = (ownership.writers || []).filter(writer => !writer.role || ['songwriter', 'lyricist'].includes(writer.role)).map(writer => writer.name);
  const ownComposers = (ownership.writers || []).filter(writer => writer.role === 'composer').map(writer => writer.name);

  const writers = unique([...ownWriters, ...byRole('songwriter', 'lyricist'), ...list(song.writtenBy)]);
  const composers = unique([...ownComposers, ...byRole('composer')]);
  const producers = unique([ownership.producer, ...byRole('producer'), ...list(song.producedBy), song.beatInfo?.producer]);
  const mixingEngineers = unique(byRole('mixer'));
  const masteringEngineers = unique(byRole('masterer'));
  const featuredArtists = unique([...(ownership.featuredArtists || []).map(item => item.name), ...byRole('featured_artist')]);

  if (!composers.length) warnings.push('No composer is recorded for this song; add the composer(s) before submission.');
  if (!writers.length) warnings.push('No writer is recorded for this song; add writers unless the track is instrumental.');
  if (!producers.length) warnings.push('No producer is recorded for this song.');
  if (!mixingEngineers.length) warnings.push('No mixing engineer is recorded for this song.');
  if (!masteringEngineers.length) warnings.push('No mastering engineer is recorded for this song.');

  const genre = matchCatalogue(metadata.genre || song.genre, sets.genres);
  const subGenre = matchCatalogue(metadata.subgenre, sets.genres);
  if ((metadata.genre || song.genre) && !genre) warnings.push(`Genre "${metadata.genre || song.genre}" is not in the DistriBeats catalogue; choose a supported genre.`);
  const language = matchLanguage(metadata.language, catalogue);
  if (metadata.language && !language) warnings.push(`Language "${metadata.language}" is not in the DistriBeats catalogue; choose a supported language.`);

  const documents = [
    ownership.beatLicense?.documentUrl && { label: 'Beat license', url: ownership.beatLicense.documentUrl },
    ...(ownership.samples || []).map(sample => sample.clearanceDocumentUrl && { label: `Sample clearance: ${sample.title || 'sample'}`, url: sample.clearanceDocumentUrl }),
    ...(ownership.signatures || []).map(signature => signature.documentUrl && { label: `Signed by ${signature.partyName}`, url: signature.documentUrl }),
  ].filter(Boolean);
  const httpsDocuments = documents.filter(doc => /^https:\/\//i.test(doc.url));
  if (documents.length > httpsDocuments.length) warnings.push(`${documents.length - httpsDocuments.length} rights document(s) are stored locally; DistriBeats needs a public HTTPS URL for rights proof.`);

  const artistName = displayName(artist);
  const instrumental = (song.versions || []).some(version => version.type === 'instrumental') && !writers.length;
  const owner = metadata.copyrightOwner || ownership.masterOwner || '';
  const publisher = metadata.publisher || (ownership.publishers || []).find(item => item?.name)?.name || '';

  return {
    release: {
      artist: song.artist ? String(song.artist._id || song.artist) : '',
      ...(genre ? { genre } : {}),
      ...(subGenre ? { subGenre } : {}),
      ...(language ? { language } : {}),
      explicit: Boolean(metadata.isExplicit),
      ...(owner ? { copyright: owner } : {}),
      ...(publisher ? { publishingCopyright: publisher } : {}),
      ...(metadata.upc ? { upc: metadata.upc } : {}),
    },
    track: {
      title: metadata.title || song.title || '',
      version: metadata.version || 'Original',
      isrc: metadata.isrc || song.isrc || '',
      iswc: metadata.iswc || '',
      explicit: Boolean(metadata.isExplicit),
      instrumental,
      ...(language ? { language } : {}),
      writers: instrumental ? [] : writers,
      composers,
      producers,
      mixingEngineers,
      masteringEngineers,
      featuredArtists,
      performers: [
        ...(artistName ? [{ name: artistName, role: 'Lead Vocals' }] : []),
        ...featuredArtists.map(name => ({ name, role: 'Vocals' })),
      ],
      durationSeconds: Math.round(Number(song.duration) || 0),
      compositionType: 'Original',
      copyrightType: 'Original',
      aiUsage: 'None',
      sourceSong: String(song._id || ''),
    },
    suggestions: {
      rightsProofUrls: httpsDocuments,
      ownership: {
        masterOwner: ownership.masterOwner || '',
        publishers: (ownership.publishers || []).map(item => ({ name: item.name, percentage: item.percentage })),
        sampleCount: (ownership.samples || []).length,
        copyrightStatus: ownership.copyrightStatus || '',
      },
    },
    audioCandidate: pickAudio(song),
    warnings,
  };
};

const UPLOADS_ROOT = path.resolve(__dirname, '..', '..', 'uploads');

/** Resolve a stored `/uploads/...` URL to an absolute path, refusing anything outside the uploads directory. */
const resolveUploadPath = url => {
  const relative = String(url || '').replace(/^\/+/, '').replace(/^uploads[\\/]/, '');
  const absolute = path.resolve(UPLOADS_ROOT, relative);
  return absolute.startsWith(UPLOADS_ROOT + path.sep) ? absolute : null;
};

module.exports = { buildImport, pickAudio, resolveUploadPath, UPLOADS_ROOT };

