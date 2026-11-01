const displayName = artist => artist?.artistName || artist?.stageName || artist?.legalName || artist?.name || '';
const list = value => (Array.isArray(value) ? value : String(value || '').split(',')).map(item => String(item ?? '').trim()).filter(Boolean);
const plain = value => (value && typeof value.toObject === 'function' ? value.toObject() : value);
const isoDate = value => new Date(value).toISOString().slice(0, 10);

// Offline fallback only. The live source of truth is GET /catalogue (performerRoles); validation uses that.
const PERFORMER_ROLES = new Set([
  'Accompaniment', 'Accordion', 'Acoustic Guitar', 'Additional Vocals', 'African Percussion', 'All Instruments',
  'Alto Saxophone', 'Assistant Programming', 'Background Vocals', 'Bagpipes', 'Band', 'Banjo', 'Baritone Saxophone',
  'Bass', 'Bass Clarinet', 'Bass Guitar', 'Bass Trombone', 'Bassoon', 'Beatbox', 'Beats', 'Bells', 'Bongos', 'Brass',
  'Brass Ensemble', 'Cello', 'Choir', 'Clarinet', 'Clavinet', 'Conductor', 'Congas', 'Contrabass', 'Cornet', 'Cowbell',
  'DJ', 'Didgeridoo', 'Dobro', 'Double Bass', 'Drum Programming', 'Drums', 'Dulcimer', 'Electric Bass',
  'Electric Guitar', 'Electric Piano', 'Electronics', 'English Horn', 'Ensemble', 'Fiddle', 'Flute', 'French Horn',
  'Glockenspiel', 'Gospel Choir', 'Guitar', 'Harmonica', 'Harmonium', 'Harmony Vocals', 'Harp', 'Harpsichord', 'Horns',
  'Kalimba', 'Kazoo', 'Keyboards', 'Lead Vocals', 'Loops', 'MC', 'Mandolin', 'Marimba', 'Melodica',
  'Multi-Instrumentalist', 'Music Director', 'Oboe', 'Orchestra', 'Organ', 'Oud', 'Pedal Steel Guitar', 'Percussion',
  'Piano', 'Piccolo Flute', 'Pipe Organ', 'Programming', 'Rhythm Guitar', 'Rhythm Programming', 'Sampled Artist',
  'Saxophone', 'Sitar', 'Solo', 'Soprano Saxophone', 'Sousaphone', 'Spoken Word', 'Steel Drum', 'String Ensemble',
  'Strings', 'Surdo', 'Symphony Orchestra', 'Synthesizer', 'Synthesizer Programming', 'Tabla', 'Tamborim', 'Tambourine',
  'Tenor Saxophone', 'Theremin', 'Timbales', 'Timpani', 'Trombone', 'Trumpet', 'Tuba', 'Turntables', 'Ukulele', 'Vibes',
  'Vibraphone', 'Viola', 'Violin', 'Vocals', 'Whistle', 'Whistling', 'Woodwinds',
]);

/* ── Normalisers (accept legacy stored values, always emit documented ones) ── */

const normalizeAiUsage = track => {
  if (['None', 'Partial', 'Full'].includes(track.aiUsage)) return track.aiUsage;
  const legacy = [track.audioAiUsage, track.compositionAiUsage].filter(Boolean);
  if (legacy.includes('all')) return 'Full';
  if (legacy.some(value => value === 'some' || value === 'material')) return 'Partial';
  return 'None';
};
const normalizeCompositionType = value => (value === 'Cover' || value === 'cover_song' ? 'Cover' : 'Original');
const normalizeRecordingRights = value => (value === 'Licensed' ? 'Licensed' : 'Original');
const normalizeReleaseType = value => ({ single: 'Single', ep: 'EP', album: 'Album', Single: 'Single', EP: 'EP', Album: 'Album' })[value] || 'Single';

/** Performers = catalogue performer roles only. Legacy contributor roles are translated, never invented. */
const effectivePerformers = track => {
  if (Array.isArray(track.performers) && track.performers.length) {
    return track.performers.map(item => ({ name: String(item.name || '').trim(), role: String(item.role || '').trim() })).filter(item => item.name || item.role);
  }
  return (track.contributors || [])
    .map(item => ({ name: String(item.name || '').trim(), role: ({ primary_artist: 'Lead Vocals', featured_artist: 'Vocals' })[item.role] || (PERFORMER_ROLES.has(item.role) ? item.role : '') }))
    .filter(item => item.name && item.role);
};

/**
 * Effective per-track values used by BOTH the validator and the mapper, so what is validated is exactly what is sent.
 * Track-level credits win; release-level credits are only a legacy fallback for drafts created before per-track credits.
 */
const resolveTrack = (track, release) => {
  const t = plain(track) || {};
  const r = plain(release) || {};
  const instrumental = Boolean(t.instrumental);
  const pick = (own, fallback) => (list(own).length ? list(own) : list(fallback));
  const compositionType = normalizeCompositionType(t.compositionType);
  const copyrightType = normalizeRecordingRights(t.copyrightType);
  return {
    title: r.type === 'single' || r.releaseType === 'Single' ? r.title : t.title,
    ownTitle: t.title,
    version: t.version && t.version !== 'Original' ? t.version : '',
    isrc: String(t.isrc || '').replace(/[\s-]/g, '').toUpperCase(),
    iswc: String(t.iswc || '').trim().toUpperCase(),
    featuring: pick(t.featuredArtists?.length ? t.featuredArtists : t.featuring, r.featuringArtists),
    composers: pick(t.composers, r.composers?.length ? r.composers : r.songwriters),
    writers: instrumental ? [] : pick(t.writers, r.songwriters?.length ? r.songwriters : r.composers),
    producers: pick(t.producers, r.producer),
    mixingEngineers: pick(t.mixingEngineers, r.mixingEngineers),
    masteringEngineers: pick(t.masteringEngineers, r.masteringEngineers),
    performers: effectivePerformers(t),
    language: t.language || r.language || '',
    compositionType,
    copyrightType,
    rightsProofUrl: String(t.rightsProofUrl || '').trim(),
    rightsProofRequired: compositionType === 'Cover' || copyrightType === 'Licensed',
    aiUsage: normalizeAiUsage(t),
    explicit: Boolean(t.explicit || r.explicit),
    instrumental,
    previewStart: String(t.previewStart || '').trim(),
    durationSeconds: Number.isFinite(Number(t.durationSeconds)) && Number(t.durationSeconds) > 0 ? Math.round(Number(t.durationSeconds)) : 0,
    audioUrl: t.audioUrl || '',
    audioFileName: t.audioFileName || '',
    audioSizeBytes: Number(t.audioSizeBytes) || 0,
  };
};

/** One track in the exact shape documented by POST /releases (tracks[]). */
const mapTrack = (track, release, artist) => {
  const t = resolveTrack(track, release);
  return {
    title: t.title,
    ...(t.version ? { version: t.version } : {}),
    ...(t.isrc ? { isrc: t.isrc } : {}),
    ...(t.iswc ? { iswc: t.iswc } : {}),
    displayArtist: displayName(artist),
    ...(t.featuring.length ? { featuring: t.featuring.join(', ') } : {}),
    ...(t.durationSeconds ? { durationSeconds: t.durationSeconds } : {}),
    ...(t.previewStart ? { previewStart: t.previewStart } : {}),
    explicit: t.explicit,
    instrumental: t.instrumental,
    language: t.language,
    compositionType: t.compositionType,
    copyrightType: t.copyrightType,
    ...(t.rightsProofRequired && t.rightsProofUrl ? { rightsProofUrl: t.rightsProofUrl } : {}),
    aiUsage: t.aiUsage,
    composers: t.composers.join(', '),
    ...(t.writers.length ? { writers: t.writers.join(', ') } : {}),
    producers: t.producers.join(', '),
    mixingEngineers: t.mixingEngineers.join(', '),
    masteringEngineers: t.masteringEngineers.join(', '),
    contributors: t.performers.map(item => ({ name: item.name, role: item.role })),
    ...(t.audioFileName ? { audioFileName: t.audioFileName } : {}),
  };
};

const REAL_TERRITORY = code => code && String(code).toUpperCase() !== 'WORLDWIDE';
const isWorldwide = release => (typeof release.worldwide === 'boolean' ? release.worldwide : list(release.territories).filter(REAL_TERRITORY).length === 0);
const effectiveStores = release => list(release.dspOutletIds).filter(store => store !== 'all_dsps');

/** The release in the exact shape documented by POST /releases. */
const mapRelease = (releaseInput, artist) => {
  const release = plain(releaseInput);
  const year = new Date(release.originalReleaseDate || release.releaseDate).getUTCFullYear();
  const cleanCopyright = String(release.copyright || '').replace(/^[©℗]\s*/, '').trim();
  const cleanPublishing = String(release.publishingCopyright || '').replace(/^[©℗]\s*/, '').trim();
  const owner = cleanCopyright.replace(/^\d{4}\s+/, '') || process.env.DISTRIBEATS_LABEL_NAME || 'HoodBoy Entertainment';
  const pLineOwner = cleanPublishing.replace(/^\d{4}\s+/, '') || owner;
  const spotifyUrl = release.spotifyArtistUrl || artist?.socialLinks?.spotify || '';
  const worldwide = isWorldwide(release);
  const territories = list(release.territories).filter(REAL_TERRITORY).map(code => code.toUpperCase());
  const excluded = list(release.excludedTerritories).map(code => code.toUpperCase());
  const cleanUpc = String(release.upc || '').replace(/[\s-]/g, '');
  return {
    title: release.title,
    displayArtist: displayName(artist),
    ...(artist?.distribeatsArtistId ? { artistId: artist.distribeatsArtistId } : {}),
    releaseType: normalizeReleaseType(release.type),
    genre: release.genre,
    subGenre: release.subGenre || release.genre,
    language: release.language || '',
    releaseDate: isoDate(release.releaseDate),
    ...(release.originalReleaseDate ? { originalReleaseDate: isoDate(release.originalReleaseDate) } : {}),
    ...(cleanUpc ? { upc: cleanUpc } : {}),
    ...(release.catalogNumber ? { catalogNumber: release.catalogNumber } : {}),
    ...(process.env.DISTRIBEATS_LABEL_NAME ? { label: process.env.DISTRIBEATS_LABEL_NAME } : {}),
    pLine: /^\d{4}\s+/.test(cleanPublishing) ? cleanPublishing : `${year} ${pLineOwner}`,
    cLine: /^\d{4}\s+/.test(cleanCopyright) ? cleanCopyright : `${year} ${owner}`,
    explicit: Boolean(release.explicit),
    ...(!worldwide && territories.length ? { territories } : {}),
    ...(excluded.length ? { excludedTerritories: excluded } : {}),
    stores: effectiveStores(release),
    ...(spotifyUrl ? { spotifyArtistUrl: spotifyUrl } : { newSpotifyArtist: true }),
    ...(release.aiDocumentUrl ? { aiDocumentUrl: release.aiDocumentUrl } : {}),
    attestations: { age: Boolean(release.attestations?.age), rights: Boolean(release.attestations?.rights) },
    requestUploadUrls: true,
    tracks: (release.tracks || []).map(track => mapTrack(track, release, artist)),
  };
};

const normalizeStatus = value => ({
  draft: 'draft', 'pending upload': 'processing', 'awaiting payment': 'processing', submitted: 'submitted', 'in review': 'processing',
  approved: 'approved', 'sent to stores': 'delivered', live: 'live', rejected: 'rejected', 'taken down': 'removed',
})[String(value?.status || value?.state || value || '').toLowerCase()] || 'processing';

module.exports = {
  mapRelease, mapTrack, resolveTrack, normalizeStatus, displayName, PERFORMER_ROLES,
  normalizeAiUsage, normalizeCompositionType, normalizeRecordingRights, normalizeReleaseType,
  effectivePerformers, effectiveStores, isWorldwide, list,
};
