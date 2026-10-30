/**
 * Structured release validation against the official DistriBeats rules.
 *
 * Source of truth: GET /catalogue (genres, languages, stores, release types, performer roles,
 * AI values, composition types, recording rights, master size limit) and the OpenAPI/llms.txt rules.
 * Nothing provider-controlled is hardcoded here; the catalogue passed in `ctx.catalogue` decides.
 *
 * Modes
 *  - 'draft'  : rejects unsupported / malformed / contradictory values so they can never be saved.
 *  - 'submit' : everything in draft mode plus completeness (all provider-required fields, files, attestations, lead time).
 *
 * Every error is { field, message, code } where `field` is a path such as "tracks[1].writers".
 */
const { ISO_CODES } = require('../../lib/isoTerritories');
const { validateAudioMeta } = require('../../lib/mediaValidation');
const policy = require('./distribeatsPolicy');
const { resolveTrack, effectiveStores, isWorldwide, list, normalizeReleaseType, normalizeAiUsage, normalizeCompositionType, normalizeRecordingRights } = require('./distribeatsMapper');

const HTTPS_URL = /^https:\/\/[^\s/$.?#][^\s]*$/i;
const HTTPS_PDF = /^https:\/\/.*\.pdf(?:\?|$)/i;
const SPOTIFY_ARTIST = /^https:\/\/open\.spotify\.com\/(?:intl-[a-z]{2}\/)?artist\/[A-Za-z0-9]+(?:\?.*)?$/i;
const ISRC = /^[A-Z]{2}[A-Z0-9]{3}\d{7}$/;
const ISWC = /^T-?\d{3}\.?\d{3}\.?\d{3}-?\d$/;
const PREVIEW = /^\d{1,2}:[0-5]\d$/;
const UPC = /^\d{12,14}$/;
const CONTENT_ID = 'YouTube Content ID';

const err = (field, message, code = 'INVALID') => ({ field, message, code });
const asNames = value => (Array.isArray(value) ? value : []).map(item => (typeof item === 'string' ? item : item?.value ?? item?.name ?? item?.label)).filter(Boolean);

const catalogueSets = (catalogue = {}) => {
  const unavailable = new Set(asNames(catalogue.unavailableStores));
  return {
    genres: new Set(asNames(catalogue.genres)),
    languages: new Set(asNames(catalogue.languages)),
    stores: new Set(asNames(catalogue.stores).filter(store => !unavailable.has(store))),
    unavailableStores: unavailable,
    performerRoles: new Set(asNames(catalogue.performerRoles)),
    releaseTypes: new Set(asNames(catalogue.releaseTypes)),
    aiUsage: new Set(asNames(catalogue.aiUsage)),
    compositionTypes: new Set(asNames(catalogue.compositionTypes)),
    recordingRights: new Set(asNames(catalogue.recordingRights)),
  };
};

const timeToSeconds = value => { const [m, s] = value.split(':').map(Number); return m * 60 + s; };

const validateTrack = (track, index, release, sets, { mode, maxAudioBytes }) => {
  const errors = [];
  const p = `tracks[${index}]`;
  const submit = mode === 'submit';
  const t = resolveTrack(track, release);
  const raw = typeof track?.toObject === 'function' ? track.toObject() : track || {};
  const needs = (field, ok, message, code = 'REQUIRED') => { if (submit && !ok) errors.push(err(`${p}.${field}`, message, code)); };

  needs('title', Boolean(String(t.ownTitle || '').trim()), 'Track title is required.');
  if (t.ownTitle && String(t.ownTitle).length > 120) errors.push(err(`${p}.title`, 'Track title must be 120 characters or fewer.', 'TOO_LONG'));

  // Provider-controlled values: always checked, even in draft mode, so unsupported values are never saved.
  if (t.language && sets.languages.size && !sets.languages.has(t.language)) errors.push(err(`${p}.language`, `Language "${t.language}" is not supported by DistriBeats.`, 'UNSUPPORTED_VALUE'));
  needs('language', Boolean(t.language), 'Track language is required.');
  if (raw.compositionType && sets.compositionTypes.size && !sets.compositionTypes.has(normalizeCompositionType(raw.compositionType))) {
    errors.push(err(`${p}.compositionType`, `Composition type "${raw.compositionType}" is not supported by DistriBeats.`, 'UNSUPPORTED_VALUE'));
  }
  if (raw.compositionType === 'public_domain') errors.push(err(`${p}.compositionType`, 'DistriBeats does not offer a public-domain composition type (only Original or Cover).', 'UNSUPPORTED_VALUE'));
  if (raw.copyrightType && sets.recordingRights.size && !sets.recordingRights.has(normalizeRecordingRights(raw.copyrightType))) {
    errors.push(err(`${p}.copyrightType`, `Recording rights "${raw.copyrightType}" are not supported by DistriBeats.`, 'UNSUPPORTED_VALUE'));
  }
  if (sets.aiUsage.size && !sets.aiUsage.has(normalizeAiUsage(raw))) errors.push(err(`${p}.aiUsage`, `AI usage "${raw.aiUsage}" is not supported by DistriBeats.`, 'UNSUPPORTED_VALUE'));

  // Identifier formats.
  if (t.isrc && !ISRC.test(t.isrc)) errors.push(err(`${p}.isrc`, 'ISRC must look like USABC2600001 (12 characters, no hyphens needed).', 'FORMAT'));
  if (t.iswc && !ISWC.test(t.iswc)) errors.push(err(`${p}.iswc`, 'ISWC must look like T-123.456.789-0.', 'FORMAT'));

  // Credits.
  needs('composers', t.composers.length > 0, 'Composers (full legal names) are required.');
  needs('writers', t.instrumental || t.writers.length > 0, 'Writers are required unless the track is instrumental.');
  needs('producers', t.producers.length > 0, 'Producers are required.');
  needs('mixingEngineers', t.mixingEngineers.length > 0, 'Mixing engineers are required.');
  needs('masteringEngineers', t.masteringEngineers.length > 0, 'Mastering engineers are required.');
  needs('performers', t.performers.length > 0, 'Add at least one performer with a role (for example the lead artist as "Lead Vocals").', 'REQUIRED');
  t.performers.forEach((performer, i) => {
    if (!performer.name) errors.push(err(`${p}.performers[${i}].name`, 'Performer name is required.', 'REQUIRED'));
    if (!performer.role) errors.push(err(`${p}.performers[${i}].role`, 'Performer role is required.', 'REQUIRED'));
    else if (sets.performerRoles.size && !sets.performerRoles.has(performer.role)) errors.push(err(`${p}.performers[${i}].role`, `Role "${performer.role}" is not a DistriBeats performer role.`, 'UNSUPPORTED_VALUE'));
  });

  // Rights evidence.
  if (t.rightsProofRequired) {
    if (!t.rightsProofUrl) { if (submit) errors.push(err(`${p}.rightsProofUrl`, 'A rights-proof URL is required for cover or licensed tracks.', 'REQUIRED')); }
  }
  if (t.rightsProofUrl && !HTTPS_URL.test(t.rightsProofUrl)) errors.push(err(`${p}.rightsProofUrl`, 'Rights proof must be an HTTPS URL.', 'FORMAT'));

  // Preview (DistriBeats documents previewStart as m:ss; there is no documented preview duration).
  if (t.previewStart) {
    if (!PREVIEW.test(t.previewStart)) errors.push(err(`${p}.previewStart`, 'Preview start must look like 0:45.', 'FORMAT'));
    else if (t.durationSeconds && timeToSeconds(t.previewStart) >= t.durationSeconds) errors.push(err(`${p}.previewStart`, 'Preview start must be before the end of the track.', 'RANGE'));
  }

  // Audio file.
  if (submit) {
    if (!t.audioUrl) errors.push(err(`${p}.audio`, 'An audio file (WAV or FLAC) is required.', 'REQUIRED'));
  }
  if (t.audioUrl || t.audioFileName) {
    validateAudioMeta({ name: t.audioFileName || t.audioUrl, mimetype: '', size: t.audioSizeBytes || 1 }, { maxBytes: maxAudioBytes, field: `${p}.audio` })
      .forEach(item => errors.push(item));
  }
  return errors;
};

const validateRelease = (input, ctx = {}) => {
  const release = typeof input?.toObject === 'function' ? input.toObject() : input || {};
  const mode = ctx.mode === 'submit' ? 'submit' : 'draft';
  const submit = mode === 'submit';
  const sets = catalogueSets(ctx.catalogue);
  const maxAudioBytes = ctx.maxAudioBytes || policy.maxAudioBytes(ctx.catalogue);
  const errors = [];
  const warnings = [];
  const needs = (field, ok, message, code = 'REQUIRED') => { if (submit && !ok) errors.push(err(field, message, code)); };

  const tracks = Array.isArray(release.tracks) ? release.tracks : [];
  const releaseType = normalizeReleaseType(release.type);

  needs('title', Boolean(String(release.title || '').trim()), 'Release title is required.');
  if (release.title && String(release.title).length > 120) errors.push(err('title', 'Release title must be 120 characters or fewer.', 'TOO_LONG'));
  needs('artist', Boolean(release.artist), 'Artist is required.');
  if (sets.releaseTypes.size && !sets.releaseTypes.has(releaseType)) errors.push(err('type', `Release type "${release.type}" is not supported by DistriBeats.`, 'UNSUPPORTED_VALUE'));

  // Genre / language come from the catalogue.
  for (const field of ['genre', 'subGenre']) {
    const value = release[field];
    needs(field, Boolean(value), `${field === 'genre' ? 'Genre' : 'Sub-genre'} is required.`);
    if (value && sets.genres.size && !sets.genres.has(value)) errors.push(err(field, `${field === 'genre' ? 'Genre' : 'Sub-genre'} "${value}" is not in the DistriBeats catalogue.`, 'UNSUPPORTED_VALUE'));
  }
  needs('language', Boolean(release.language), 'Release language is required.');
  if (release.language && sets.languages.size && !sets.languages.has(release.language)) errors.push(err('language', `Language "${release.language}" is not supported by DistriBeats.`, 'UNSUPPORTED_VALUE'));

  // Release date + lead time (server-side configurable, never browser-only).
  if (release.releaseDate) {
    const date = policy.parseDateOnly(release.releaseDate);
    if (!date) errors.push(err('releaseDate', 'Release date is not a valid date.', 'FORMAT'));
    else if (submit || ctx.enforceLeadTime) {
      const leadError = policy.releaseDateError(release.releaseDate, { now: ctx.now, config: ctx.leadTime });
      if (leadError) errors.push(err('releaseDate', leadError, 'LEAD_TIME'));
    }
  } else needs('releaseDate', false, 'Release date is required.');

  needs('copyright', Boolean(String(release.copyright || '').trim()), 'Copyright owner (c-line) is required.');
  if (release.upc && !UPC.test(String(release.upc))) errors.push(err('upc', 'UPC/EAN must be 12–14 digits.', 'FORMAT'));

  // Stores: provider-controlled, never free text.
  const stores = effectiveStores(release);
  needs('dspOutletIds', stores.length > 0, 'Select at least one store.');
  stores.forEach(store => {
    if (sets.unavailableStores.has(store)) errors.push(err('dspOutletIds', `Store "${store}" is currently unavailable on DistriBeats.`, 'UNSUPPORTED_VALUE'));
    else if (sets.stores.size && !sets.stores.has(store)) errors.push(err('dspOutletIds', `Store "${store}" is not supported by DistriBeats.`, 'UNSUPPORTED_VALUE'));
  });

  // Territories: worldwide or explicit ISO list, plus exclusions.
  const worldwide = isWorldwide(release);
  const territories = list(release.territories).filter(code => String(code).toUpperCase() !== 'WORLDWIDE').map(code => code.toUpperCase());
  const excluded = list(release.excludedTerritories).map(code => code.toUpperCase());
  [...territories.map(code => ['territories', code]), ...excluded.map(code => ['excludedTerritories', code])].forEach(([field, code]) => {
    if (!ISO_CODES.has(code)) errors.push(err(field, `"${code}" is not a supported ISO 3166-1 territory code.`, 'UNSUPPORTED_VALUE'));
  });
  if (!worldwide && territories.length === 0) needs('territories', false, 'Select at least one territory, or choose worldwide distribution.');
  if (!worldwide && excluded.length) errors.push(err('excludedTerritories', 'Excluded territories only apply to worldwide distribution.', 'CONFLICT'));
  const overlap = territories.filter(code => excluded.includes(code));
  if (overlap.length) errors.push(err('excludedTerritories', `Territories cannot be both included and excluded: ${overlap.join(', ')}.`, 'CONFLICT'));

  // Spotify artist: exactly one of an existing URL or "new artist" (blank URL = new artist).
  if (release.spotifyArtistUrl && !SPOTIFY_ARTIST.test(release.spotifyArtistUrl)) errors.push(err('spotifyArtistUrl', 'Spotify artist URL must look like https://open.spotify.com/artist/<id>.', 'FORMAT'));

  // Attestations.
  needs('attestations.age', Boolean(release.attestations?.age), 'The age attestation must be accepted.');
  needs('attestations.rights', Boolean(release.attestations?.rights), 'The rights attestation must be accepted.');

  // Artwork.
  needs('cover', Boolean(release.coverArtUrl), 'Cover artwork (JPG/PNG, RGB, 3000x3000 px) is required.');

  // Tracks.
  if (!tracks.length) needs('tracks', false, 'At least one track is required.');
  const aiTracks = tracks.map(track => normalizeAiUsage(typeof track?.toObject === 'function' ? track.toObject() : track || {})).map((value, index) => ({ value, index })).filter(item => item.value !== 'None');
  if (aiTracks.length) {
    if (!release.aiDocumentUrl) { if (submit) errors.push(err('aiDocumentUrl', 'An HTTPS PDF documenting AI commercial-use rights is required when any track uses AI.', 'REQUIRED')); }
    else if (!HTTPS_PDF.test(release.aiDocumentUrl)) errors.push(err('aiDocumentUrl', 'The AI document must be an HTTPS URL to a PDF.', 'FORMAT'));
    if (stores.includes(CONTENT_ID)) errors.push(err('dspOutletIds', `${CONTENT_ID} cannot be selected when any track uses Partial or Full AI.`, 'CONFLICT'));
  } else if (release.aiDocumentUrl && !HTTPS_PDF.test(release.aiDocumentUrl)) {
    errors.push(err('aiDocumentUrl', 'The AI document must be an HTTPS URL to a PDF.', 'FORMAT'));
  }

  if (releaseType === 'Single') {
    if (tracks.length > 1) errors.push(err('tracks', 'A Single contains exactly one track; choose EP or Album for more.', 'CONFLICT'));
    if (tracks.length === 1) {
      const trackTitle = String((tracks[0].toObject?.() || tracks[0]).title || '').trim();
      if (trackTitle && release.title && trackTitle !== String(release.title).trim()) {
        errors.push(err('tracks[0].title', `For a Single, the track title must match the release title ("${release.title}").`, 'CONFLICT'));
      }
    }
  }

  tracks.forEach((track, index) => errors.push(...validateTrack(track, index, release, sets, { mode, maxAudioBytes })));

  return { errors, warnings, ready: errors.length === 0, mode };
};

/** Validate the exact mapped POST /releases body once more before any network request. */
const validateMappedPayload = (payload, catalogue) => {
  const sets = catalogueSets(catalogue);
  const errors = [];
  for (const field of ['title', 'displayArtist', 'releaseType', 'genre', 'subGenre', 'language', 'releaseDate', 'pLine', 'cLine']) {
    if (!payload[field]) errors.push(err(field, `${field} is required by DistriBeats.`, 'REQUIRED'));
  }
  if (!payload.stores?.length) errors.push(err('stores', 'At least one store is required.', 'REQUIRED'));
  if (Boolean(payload.spotifyArtistUrl) === Boolean(payload.newSpotifyArtist)) errors.push(err('spotifyArtistUrl', 'Send exactly one of spotifyArtistUrl or newSpotifyArtist.', 'CONFLICT'));
  if (!payload.attestations?.age || !payload.attestations?.rights) errors.push(err('attestations', 'Age and rights attestations must both be true.', 'REQUIRED'));
  if (sets.stores.size) (payload.stores || []).forEach(store => { if (!sets.stores.has(store)) errors.push(err('stores', `Store "${store}" is not supported.`, 'UNSUPPORTED_VALUE')); });
  const hasAi = (payload.tracks || []).some(track => track.aiUsage !== 'None');
  if (hasAi && !HTTPS_PDF.test(String(payload.aiDocumentUrl || ''))) errors.push(err('aiDocumentUrl', 'An HTTPS PDF aiDocumentUrl is required when any track uses AI.', 'REQUIRED'));
  if (hasAi && payload.stores?.includes(CONTENT_ID)) errors.push(err('stores', 'YouTube Content ID cannot be used with AI tracks.', 'CONFLICT'));
  if (payload.releaseType === 'Single' && (payload.tracks || []).some(track => track.title !== payload.title)) errors.push(err('tracks[0].title', 'For a Single, the track title must equal the release title.', 'CONFLICT'));
  (payload.tracks || []).forEach((track, index) => {
    const p = `tracks[${index}]`;
    for (const field of ['title', 'language', 'compositionType', 'copyrightType', 'aiUsage', 'composers', 'producers', 'mixingEngineers', 'masteringEngineers']) {
      if (!track[field]) errors.push(err(`${p}.${field}`, `${field} is required.`, 'REQUIRED'));
    }
    if (!track.instrumental && !track.writers) errors.push(err(`${p}.writers`, 'writers is required unless instrumental.', 'REQUIRED'));
    if ((track.compositionType === 'Cover' || track.copyrightType === 'Licensed') && !track.rightsProofUrl) errors.push(err(`${p}.rightsProofUrl`, 'rightsProofUrl is required for Cover or Licensed tracks.', 'REQUIRED'));
    if (!Array.isArray(track.contributors) || !track.contributors.length) errors.push(err(`${p}.contributors`, 'At least one performer is required.', 'REQUIRED'));
    else if (sets.performerRoles.size && !track.contributors.some(item => sets.performerRoles.has(item.role))) errors.push(err(`${p}.contributors`, 'At least one contributor must use a DistriBeats performer role.', 'REQUIRED'));
  });
  return errors;
};

module.exports = { validateRelease, validateMappedPayload, catalogueSets, CONTENT_ID };

