/**
 * Draft parsing + merging.
 *
 * `parseReleaseBody` returns ONLY the fields present in the request, so an update never blanks data the client did not send.
 * `mergeDraft` applies those fields on top of the stored draft, preserving files, server-managed state and any track
 * field the client omitted. Audio/cover are only replaced when a new file was actually uploaded.
 */
const { list, normalizeCompositionType, normalizeRecordingRights, normalizeAiUsage } = require('./distribeatsMapper');

const has = (body, key) => Object.prototype.hasOwnProperty.call(body || {}, key);
const parseJson = (value, fallback) => {
  if (typeof value !== 'string') return value ?? fallback;
  try { return JSON.parse(value); } catch { return fallback; }
};
const bool = value => value === true || String(value).toLowerCase() === 'true';
const text = value => String(value ?? '').trim();

const SCALARS = ['title', 'type', 'genre', 'subGenre', 'language', 'upc', 'copyright', 'producer', 'spotifyArtistUrl', 'aiDocumentUrl', 'catalogNumber', 'publishingCopyright', 'artworkAiUsage', 'distributionMode', 'sourceDistributor', 'sourceReleaseUrl', 'bulkImportKey', 'bulkReleaseKey'];
const LISTS = ['featuringArtists', 'songwriters', 'composers', 'territories', 'excludedTerritories', 'mixingEngineers', 'masteringEngineers', 'dspOutletIds'];

// Fields only the server may set; never accepted from a client track payload.
const SERVER_TRACK_FIELDS = ['distribeatsTrackId', 'uploadStatus', 'audioQcResult', 'duplicateQcResult', 'fingerprintResult', 'audioStreamHash', 'internalFingerprint', 'audioSizeBytes', 'audioUrl', 'audioFileName'];
const AUDIO_FIELDS = ['audioUrl', 'audioFileName', 'audioSizeBytes'];
const QC_RESET_FIELDS = ['audioQcResult', 'duplicateQcResult', 'fingerprintResult', 'audioStreamHash', 'internalFingerprint'];

const sanitizeTrack = raw => {
  const t = { ...raw };
  SERVER_TRACK_FIELDS.forEach(field => delete t[field]);
  for (const field of ['writers', 'composers', 'producers', 'mixingEngineers', 'masteringEngineers', 'featuredArtists']) {
    if (has(t, field)) t[field] = list(t[field]);
  }
  for (const field of ['explicit', 'instrumental']) if (has(t, field)) t[field] = bool(t[field]);
  for (const field of ['title', 'version', 'isrc', 'iswc', 'language', 'rightsProofUrl', 'previewStart']) if (has(t, field)) t[field] = text(t[field]);
  if (has(t, 'isrc')) t.isrc = t.isrc.replace(/[\s-]/g, '').toUpperCase();
  if (has(t, 'iswc')) t.iswc = t.iswc.toUpperCase();
  if (has(t, 'compositionType')) t.compositionType = normalizeCompositionType(t.compositionType);
  if (has(t, 'copyrightType')) t.copyrightType = normalizeRecordingRights(t.copyrightType);
  if (has(t, 'aiUsage')) t.aiUsage = normalizeAiUsage(t);
  if (has(t, 'durationSeconds')) t.durationSeconds = Math.max(0, Math.round(Number(t.durationSeconds) || 0));
  if (has(t, 'performers')) t.performers = (Array.isArray(t.performers) ? t.performers : []).map(item => ({ name: text(item?.name), role: text(item?.role) })).filter(item => item.name || item.role);
  if (has(t, 'contributors')) t.contributors = parseJson(t.contributors, []);
  return t;
};

/** Parse a multipart/JSON request body into only the fields it actually contains. */
const parseReleaseBody = body => {
  const out = {};
  SCALARS.forEach(key => { if (has(body, key)) out[key] = text(body[key]); });
  if (has(out, 'upc')) out.upc = out.upc.replace(/[\s-]/g, '');
  LISTS.forEach(key => { if (has(body, key)) out[key] = list(parseJson(body[key], body[key])); });
  if (has(body, 'explicit')) out.explicit = bool(body.explicit);
  if (has(body, 'worldwide')) out.worldwide = bool(body.worldwide);
  if (has(body, 'transferAcknowledged')) out.transferAcknowledged = bool(body.transferAcknowledged);
  if (has(body, 'releaseDate')) out.releaseDate = body.releaseDate;
  if (has(body, 'originalReleaseDate')) out.originalReleaseDate = body.originalReleaseDate || undefined;
  if (has(body, 'artist')) out.artist = body.artist;
  if (has(body, 'attestations')) {
    const a = parseJson(body.attestations, {});
    out.attestations = { age: bool(a?.age), rights: bool(a?.rights) };
  }
  if (has(body, 'tracks')) {
    const parsed = parseJson(body.tracks, []);
    out.tracks = (Array.isArray(parsed) ? parsed : []).map(track => ({ ...sanitizeTrack(track), _clientId: track?._id ? String(track._id) : undefined }));
  }
  return out;
};

/**
 * @param existing  plain stored draft (or null when creating)
 * @param incoming  output of parseReleaseBody (+ optional coverArtUrl/coverArtFileName/coverArtMeta from an upload)
 * @param uploads   { audio: { [trackIndex]: { audioUrl, audioFileName, audioSizeBytes } } }
 */
const mergeDraft = (existing, incoming, uploads = {}) => {
  const base = existing ? { ...existing } : {};
  const { tracks: incomingTracks, ...rest } = incoming;
  Object.entries(rest).forEach(([key, value]) => { if (value !== undefined) base[key] = value; });

  if (incomingTracks) {
    const stored = Array.isArray(existing?.tracks) ? existing.tracks : [];
    const anyIds = incomingTracks.some(track => track._clientId);
    base.tracks = incomingTracks.map((track, index) => {
      const { _clientId, ...fields } = track;
      const matched = _clientId
        ? stored.find(item => String(item._id) === _clientId)
        : (!anyIds ? stored[index] : undefined);
      const merged = { ...(matched || {}) };
      Object.entries(fields).forEach(([key, value]) => { if (value !== undefined) merged[key] = value; });
      const upload = uploads.audio?.[index];
      if (upload) {
        AUDIO_FIELDS.forEach(field => { merged[field] = upload[field]; });
        QC_RESET_FIELDS.forEach(field => { merged[field] = undefined; });
        merged.uploadStatus = 'preparing';
      }
      return merged;
    });
  }
  return base;
};

module.exports = { parseReleaseBody, mergeDraft, sanitizeTrack, SERVER_TRACK_FIELDS };

