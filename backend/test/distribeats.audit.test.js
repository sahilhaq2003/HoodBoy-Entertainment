const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { DistribeatsClient } = require('../services/distribeats/distribeatsClient');
const { uploadFile, findArtistInPage, remoteArtistCandidates } = require('../services/distribeats/distribeatsService');
const { mapRelease } = require('../services/distribeats/distribeatsMapper');
const { validateRelease, validateMappedPayload } = require('../services/distribeats/distribeatsValidation');
const { parseReleaseBody, mergeDraft } = require('../services/distribeats/distributionDraft');
const { buildImport } = require('../services/distribeats/distributionImport');
const {
  keyMode,
  assertKeyAllowed,
  describeMode,
  earliestReleaseDate,
  releaseDateError,
  maxAudioBytes,
} = require('../services/distribeats/distribeatsPolicy');
const {
  validateAudioMeta,
  validateAudioFile,
  validateImageInfo,
  parseImageInfo,
  planParts,
} = require('../lib/mediaValidation');
const distributionUpload = require('../middleware/distributionUpload');

// Snapshot of the official GET /catalogue structure from DistriBeats Public API v1
const CATALOGUE = {
  object: 'catalogue',
  genres: ['Electronic', 'Electronic/House', 'Hip-Hop/Rap', 'Pop', 'Rock', 'Ambient', 'Classical'],
  languages: [
    { value: 'English', label: 'English' },
    { value: 'Hindi', label: 'Hindi / हिन्दी' },
    { value: 'Spanish', label: 'Spanish / Español' },
    { value: 'Instrumental', label: 'Instrumental' },
  ],
  stores: [
    'Spotify',
    'Apple Music',
    'YouTube Music',
    'TIDAL',
    'Amazon',
    'Deezer',
    'YouTube Content ID',
    'TikTok',
  ],
  generalStores: ['Spotify', 'Apple Music', 'YouTube Music', 'TIDAL', 'Amazon', 'Deezer'],
  unavailableStores: ['Beatport', 'Traxsource'],
  performerRoles: ['Lead Vocals', 'Vocals', 'Guitar', 'Synthesizer', 'Drums', 'Piano', 'Bass'],
  contributorRoles: ['Composer', 'Remixer', 'Mixer', 'Engineer', 'Mastering Engineer'],
  releaseTypes: ['Single', 'EP', 'Album'],
  aiUsage: ['None', 'Partial', 'Full'],
  compositionTypes: ['Original', 'Cover'],
  recordingRights: ['Original', 'Licensed'],
  masterLimitBytes: 150000000,
};

test('DistriBeats artist matching supports roster profile fields and nested API pages', () => {
  const localArtist = {
    artistName: 'HBE JODI',
    legalName: 'Frankie Davis',
    email: 'frankiesdavis@gmail.com',
  };
  const page = {
    data: {
      artists: [{
        artistId: 'artist_hbe_jodi',
        profile: {
          artistName: 'HBE  JODI',
          email: 'FRANKIESDAVIS@GMAIL.COM',
        },
      }],
      hasMore: false,
    },
  };

  assert.deepEqual(findArtistInPage(page, localArtist), {
    artistId: 'artist_hbe_jodi',
    profile: {
      artistName: 'HBE  JODI',
      email: 'FRANKIESDAVIS@GMAIL.COM',
    },
    id: 'artist_hbe_jodi',
  });
});

test('DistriBeats artist matching does not link an unrelated roster entry', () => {
  const page = { data: [{ id: 'artist_other', artistName: 'Another Artist', email: 'other@example.com' }] };
  assert.equal(findArtistInPage(page, { artistName: 'HBE JODI', email: 'frankiesdavis@gmail.com' }), null);
});

test('DistriBeats artist matching discovers deeply nested live profile shapes', () => {
  const page = {
    object: 'list',
    results: [{
      membership: {
        artist_profile: {
          uuid: 'artist_live_hbe_jodi',
          public_title: 'HBE JODI',
          contact: { primary_email: 'frankiesdavis@gmail.com' },
        },
      },
    }],
  };
  assert.equal(remoteArtistCandidates(page).length, 1);
  assert.equal(findArtistInPage(page, {
    artistName: 'HBE JODI',
    email: 'frankiesdavis@gmail.com',
  })?.id, 'artist_live_hbe_jodi');
});

const futureDate = (daysAhead = 14) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysAhead);
  return d.toISOString().slice(0, 10);
};

const makeValidTrack = (overrides = {}) => ({
  trackNumber: 1,
  title: 'Midnight Horizon',
  version: '',
  isrc: 'USRC17607839',
  iswc: 'T-034.524.680-1',
  explicit: false,
  instrumental: false,
  language: 'English',
  compositionType: 'Original',
  copyrightType: 'Original',
  rightsProofUrl: '',
  aiUsage: 'None',
  writers: ['Riya Kapoor'],
  composers: ['Aarav Sen'],
  producers: ['Kiran Rao'],
  mixingEngineers: ['Dev Malhotra'],
  masteringEngineers: ['Meera Nair'],
  featuredArtists: [],
  performers: [{ name: 'Aarav Sen', role: 'Lead Vocals' }],
  audioUrl: '/uploads/distribution/audio/midnight.wav',
  audioFileName: 'midnight.wav',
  audioSizeBytes: 24 * 1024 * 1024,
  previewStart: '0:30',
  durationSeconds: 215,
  ...overrides,
});

const makeValidRelease = (overrides = {}) => ({
  title: 'Midnight Horizon',
  artist: '507f1f77bcf86cd799439011',
  artistName: 'Aarav Sen',
  type: 'single',
  releaseDate: futureDate(14),
  genre: 'Electronic',
  subGenre: 'Electronic/House',
  language: 'English',
  label: 'HoodBoy Ent.',
  copyright: '2026 HoodBoy Ent.',
  publishingCopyright: '2026 HoodBoy Ent.',
  coverArtUrl: '/uploads/distribution/covers/cover.png',
  dspOutletIds: ['Spotify', 'Apple Music', 'YouTube Music'],
  worldwide: true,
  territories: ['WORLDWIDE'],
  excludedTerritories: [],
  aiDocumentUrl: '',
  attestations: { age: true, rights: true },
  tracks: [makeValidTrack()],
  ...overrides,
});

test('1. Valid original track passes submission validation with zero errors', () => {
  const release = makeValidRelease();
  const result = validateRelease(release, { catalogue: CATALOGUE, mode: 'submit' });
  assert.equal(result.ready, true, `Expected valid release, got errors: ${JSON.stringify(result.errors)}`);
  assert.equal(result.errors.length, 0);
});

test('2. Instrumental track does not require writers, while non-instrumental tracks require writers', () => {
  const release = makeValidRelease({
    tracks: [
      makeValidTrack({
        instrumental: true,
        writers: [],
        language: 'Instrumental',
      }),
    ],
  });
  const result = validateRelease(release, { catalogue: CATALOGUE, mode: 'submit' });
  assert.equal(result.ready, true, `Instrumental track without writers should be valid: ${JSON.stringify(result.errors)}`);

  const mapped = mapRelease(release, { artistName: 'Aarav Sen', distribeatsArtistId: 'usr_test_1' });
  assert.equal(mapped.tracks[0].instrumental, true);
  assert.equal(mapped.tracks[0].language, 'Instrumental');
  assert.equal(mapped.tracks[0].writers, undefined);

  // Conversely, non-instrumental track without writers fails
  const nonInstrumentalNoWriters = makeValidRelease({
    tracks: [makeValidTrack({ instrumental: false, writers: [] })],
  });
  const badResult = validateRelease(nonInstrumentalNoWriters, { catalogue: CATALOGUE, mode: 'submit' });
  assert.equal(badResult.ready, false);
  assert.ok(badResult.errors.some((e) => e.field === 'tracks[0].writers'));
});

test('3. Cover song requires an HTTPS rights-proof URL and passes when provided', () => {
  const withoutProof = makeValidRelease({
    tracks: [makeValidTrack({ compositionType: 'Cover', rightsProofUrl: '' })],
  });
  const resMissing = validateRelease(withoutProof, { catalogue: CATALOGUE, mode: 'submit' });
  assert.equal(resMissing.ready, false);
  assert.ok(resMissing.errors.some((e) => e.field === 'tracks[0].rightsProofUrl'));

  const insecureProof = makeValidRelease({
    tracks: [makeValidTrack({ compositionType: 'Cover', rightsProofUrl: 'http://example.com/license.pdf' })],
  });
  const resInsecure = validateRelease(insecureProof, { catalogue: CATALOGUE, mode: 'submit' });
  assert.equal(resInsecure.ready, false);
  assert.ok(resInsecure.errors.some((e) => e.field === 'tracks[0].rightsProofUrl'));

  const withHttpsProof = makeValidRelease({
    tracks: [makeValidTrack({ compositionType: 'Cover', rightsProofUrl: 'https://rights.example.com/cover-license.pdf' })],
  });
  const resValid = validateRelease(withHttpsProof, { catalogue: CATALOGUE, mode: 'submit' });
  assert.equal(resValid.ready, true, `Cover with HTTPS rightsProofUrl should pass: ${JSON.stringify(resValid.errors)}`);

  const mapped = mapRelease(withHttpsProof, { artistName: 'Aarav Sen', distribeatsArtistId: 'usr_test_1' });
  assert.equal(mapped.tracks[0].compositionType, 'Cover');
  assert.equal(mapped.tracks[0].rightsProofUrl, 'https://rights.example.com/cover-license.pdf');
});

test('4. Licensed recording requires an HTTPS rights-proof URL and passes when provided', () => {
  const licensedMissingProof = makeValidRelease({
    tracks: [makeValidTrack({ copyrightType: 'Licensed', rightsProofUrl: '' })],
  });
  const bad = validateRelease(licensedMissingProof, { catalogue: CATALOGUE, mode: 'submit' });
  assert.equal(bad.ready, false);
  assert.ok(bad.errors.some((e) => e.field === 'tracks[0].rightsProofUrl'));

  const licensedWithProof = makeValidRelease({
    tracks: [makeValidTrack({ copyrightType: 'Licensed', rightsProofUrl: 'https://cdn.example.com/master-license.pdf' })],
  });
  const ok = validateRelease(licensedWithProof, { catalogue: CATALOGUE, mode: 'submit' });
  assert.equal(ok.ready, true, `Licensed recording with HTTPS proof should pass: ${JSON.stringify(ok.errors)}`);

  const mapped = mapRelease(licensedWithProof, { artistName: 'Aarav Sen', distribeatsArtistId: 'usr_test_1' });
  assert.equal(mapped.tracks[0].copyrightType, 'Licensed');
  assert.equal(mapped.tracks[0].rightsProofUrl, 'https://cdn.example.com/master-license.pdf');
});

test('5. AI-assisted track (Partial or Full) requires an HTTPS PDF aiDocumentUrl', () => {
  const aiWithoutDoc = makeValidRelease({
    aiDocumentUrl: '',
    tracks: [makeValidTrack({ aiUsage: 'Partial' })],
  });
  const resNoDoc = validateRelease(aiWithoutDoc, { catalogue: CATALOGUE, mode: 'submit' });
  assert.equal(resNoDoc.ready, false);
  assert.ok(resNoDoc.errors.some((e) => e.field === 'aiDocumentUrl'));

  const aiNonPdfDoc = makeValidRelease({
    aiDocumentUrl: 'https://docs.example.com/ai-attestation.docx',
    tracks: [makeValidTrack({ aiUsage: 'Full' })],
  });
  const resNonPdf = validateRelease(aiNonPdfDoc, { catalogue: CATALOGUE, mode: 'submit' });
  assert.equal(resNonPdf.ready, false);
  assert.ok(resNonPdf.errors.some((e) => e.field === 'aiDocumentUrl'));

  const aiWithPdf = makeValidRelease({
    aiDocumentUrl: 'https://docs.example.com/ai-attestation.pdf',
    tracks: [makeValidTrack({ aiUsage: 'Partial' })],
  });
  const resOk = validateRelease(aiWithPdf, { catalogue: CATALOGUE, mode: 'submit' });
  assert.equal(resOk.ready, true, `AI track with HTTPS PDF should pass: ${JSON.stringify(resOk.errors)}`);

  const mapped = mapRelease(aiWithPdf, { artistName: 'Aarav Sen', distribeatsArtistId: 'usr_test_1' });
  assert.equal(mapped.aiDocumentUrl, 'https://docs.example.com/ai-attestation.pdf');
  assert.equal(mapped.tracks[0].aiUsage, 'Partial');
});

test('6. AI track selecting YouTube Content ID is rejected in both release and mapped payload validation', () => {
  const aiWithCid = makeValidRelease({
    dspOutletIds: ['Spotify', 'YouTube Content ID'],
    aiDocumentUrl: 'https://docs.example.com/ai-attestation.pdf',
    tracks: [makeValidTrack({ aiUsage: 'Partial' })],
  });
  const res = validateRelease(aiWithCid, { catalogue: CATALOGUE, mode: 'submit' });
  assert.equal(res.ready, false);
  assert.ok(res.errors.some((e) => e.field === 'dspOutletIds' && /YouTube Content ID/i.test(e.message)));

  const mapped = mapRelease(aiWithCid, { artistName: 'Aarav Sen', distribeatsArtistId: 'usr_test_1' });
  const mappedErrors = validateMappedPayload(mapped, CATALOGUE);
  assert.ok(mappedErrors.length > 0);
  assert.ok(mappedErrors.some((e) => e.field === 'stores' && /YouTube Content ID/i.test(e.message)));
});

test('7. Multiple tracks with different credits preserve distinct per-track writers, composers, producers, engineers, and performers', () => {
  const release = makeValidRelease({
    title: 'Dual Horizons EP',
    type: 'ep',
    tracks: [
      makeValidTrack({
        trackNumber: 1,
        title: 'Horizon One',
        writers: ['Writer Alpha'],
        composers: ['Composer Alpha'],
        producers: ['Producer Alpha'],
        mixingEngineers: ['Mixer Alpha'],
        masteringEngineers: ['Master Alpha'],
        featuredArtists: ['Feat Alpha'],
        performers: [{ name: 'Aarav Sen', role: 'Lead Vocals' }],
      }),
      makeValidTrack({
        trackNumber: 2,
        title: 'Horizon Two',
        writers: ['Writer Beta', 'Writer Gamma'],
        composers: ['Composer Beta'],
        producers: ['Producer Beta'],
        mixingEngineers: ['Mixer Beta'],
        masteringEngineers: ['Master Beta'],
        featuredArtists: ['Feat Beta'],
        performers: [{ name: 'Session Guitarist', role: 'Guitar' }],
      }),
    ],
  });

  const val = validateRelease(release, { catalogue: CATALOGUE, mode: 'submit' });
  assert.equal(val.ready, true, `Multi-track EP should pass validation: ${JSON.stringify(val.errors)}`);

  const mapped = mapRelease(release, { artistName: 'Aarav Sen', distribeatsArtistId: 'usr_test_1' });
  assert.equal(mapped.tracks.length, 2);

  assert.equal(mapped.tracks[0].writers, 'Writer Alpha');
  assert.equal(mapped.tracks[0].composers, 'Composer Alpha');
  assert.equal(mapped.tracks[0].producers, 'Producer Alpha');
  assert.equal(mapped.tracks[0].mixingEngineers, 'Mixer Alpha');
  assert.equal(mapped.tracks[0].masteringEngineers, 'Master Alpha');
  assert.equal(mapped.tracks[0].featuring, 'Feat Alpha');
  assert.deepEqual(mapped.tracks[0].contributors, [{ name: 'Aarav Sen', role: 'Lead Vocals' }]);

  assert.equal(mapped.tracks[1].writers, 'Writer Beta, Writer Gamma');
  assert.equal(mapped.tracks[1].composers, 'Composer Beta');
  assert.equal(mapped.tracks[1].producers, 'Producer Beta');
  assert.equal(mapped.tracks[1].mixingEngineers, 'Mixer Beta');
  assert.equal(mapped.tracks[1].masteringEngineers, 'Master Beta');
  assert.equal(mapped.tracks[1].featuring, 'Feat Beta');
  assert.deepEqual(mapped.tracks[1].contributors, [{ name: 'Session Guitarist', role: 'Guitar' }]);
});

test('8. Single release title and track title must match and only 1 track is allowed on a Single', () => {
  const mismatch = makeValidRelease({
    title: 'Release Title A',
    type: 'single',
    tracks: [makeValidTrack({ title: 'Different Track Title' })],
  });
  const resMismatch = validateRelease(mismatch, { catalogue: CATALOGUE, mode: 'submit' });
  assert.equal(resMismatch.ready, false);
  assert.ok(resMismatch.errors.some((e) => e.field === 'tracks[0].title' && /match/i.test(e.message)));

  const twoTracksSingle = makeValidRelease({
    title: 'Release Title A',
    type: 'single',
    tracks: [
      makeValidTrack({ trackNumber: 1, title: 'Release Title A' }),
      makeValidTrack({ trackNumber: 2, title: 'Second Track' }),
    ],
  });
  const resTwoTracks = validateRelease(twoTracksSingle, { catalogue: CATALOGUE, mode: 'submit' });
  assert.equal(resTwoTracks.ready, false);
  assert.ok(resTwoTracks.errors.some((e) => e.field === 'tracks'));

  const matching = makeValidRelease({
    title: 'Exact Match',
    type: 'single',
    tracks: [makeValidTrack({ title: 'Exact Match' })],
  });
  const resMatch = validateRelease(matching, { catalogue: CATALOGUE, mode: 'submit' });
  assert.equal(resMatch.ready, true);
});

test('9. Safe draft editing preserves all saved fields, credits, rights, AI data, stores, territories, and files unless replaced', () => {
  const existingDraft = {
    title: 'Original Draft',
    artist: 'artist_1',
    artistName: 'Aarav Sen',
    type: 'ep',
    releaseDate: new Date(futureDate(20)),
    genre: 'Electronic',
    subGenre: 'Electronic/House',
    language: 'English',
    label: 'HoodBoy Ent.',
    copyright: '2026 HoodBoy Ent.',
    publishingCopyright: '2026 HoodBoy Ent.',
    upc: '123456789012',
    coverArt: '/uploads/distribution/covers/existing-cover.png',
    coverMimeType: 'image/png',
    coverWidth: 3000,
    coverHeight: 3000,
    coverColorSpace: 'RGB',
    coverSize: 1900000,
    dspOutletIds: ['Spotify', 'Apple Music'],
    worldwide: false,
    territories: ['US', 'GB', 'IN'],
    excludedTerritories: ['RU'],
    aiDocumentUrl: 'https://docs.example.com/ai-doc.pdf',
    featuredArtists: ['Guest Star'],
    producer: 'Lead Producer',
    songwriters: ['Main Writer'],
    composers: ['Main Composer'],
    mixingEngineers: ['Main Mixer'],
    masteringEngineers: ['Main Master'],
    contributors: [{ name: 'Aarav Sen', role: 'Lead Vocals' }],
    attestations: { age: true, rights: true },
    tracks: [
      {
        trackNumber: 1,
        title: 'Track One',
        version: 'Club Mix',
        isrc: 'USRC17607839',
        iswc: 'T-034.524.680-1',
        explicit: true,
        instrumental: false,
        language: 'English',
        compositionType: 'Cover',
        copyrightType: 'Licensed',
        rightsProofUrl: 'https://rights.example.com/proof.pdf',
        aiUsage: 'Partial',
        writers: ['Track Writer'],
        composers: ['Track Composer'],
        producers: ['Track Producer'],
        mixingEngineers: ['Track Mixer'],
        masteringEngineers: ['Track Master'],
        featuredArtists: ['Track Guest'],
        contributors: [{ name: 'Aarav Sen', role: 'Lead Vocals' }],
        audioUrl: '/uploads/distribution/audio/existing-track-1.wav',
        audioFormat: 'wav',
        audioMimeType: 'audio/wav',
        audioSize: 33000000,
        previewStart: '0:45',
        durationSeconds: 210,
        sourceSong: 'song_123',
      },
    ],
  };

  // Partial update changing only the release title and track version without re-uploading cover or audio
  const incomingBody = parseReleaseBody({
    title: 'Updated Draft Title',
    tracks: JSON.stringify([
      {
        trackNumber: 1,
        title: 'Track One',
        version: 'Extended Mix',
        sourceSong: 'song_123',
      },
    ]),
  });

  const merged = mergeDraft(existingDraft, incomingBody, {});

  assert.equal(merged.title, 'Updated Draft Title');
  // Preserved release-level fields
  assert.equal(merged.coverArt, '/uploads/distribution/covers/existing-cover.png');
  assert.equal(merged.coverWidth, 3000);
  assert.equal(merged.coverHeight, 3000);
  assert.deepEqual(merged.dspOutletIds, ['Spotify', 'Apple Music']);
  assert.equal(merged.worldwide, false);
  assert.deepEqual(merged.territories, ['US', 'GB', 'IN']);
  assert.deepEqual(merged.excludedTerritories, ['RU']);
  assert.equal(merged.aiDocumentUrl, 'https://docs.example.com/ai-doc.pdf');
  assert.deepEqual(merged.featuredArtists, ['Guest Star']);
  assert.equal(merged.producer, 'Lead Producer');
  assert.deepEqual(merged.songwriters, ['Main Writer']);
  assert.deepEqual(merged.composers, ['Main Composer']);

  // Preserved track-level fields + updated version
  const t = merged.tracks[0];
  assert.equal(t.version, 'Extended Mix');
  assert.equal(t.audioUrl, '/uploads/distribution/audio/existing-track-1.wav');
  assert.equal(t.audioFormat, 'wav');
  assert.equal(t.audioSize, 33000000);
  assert.equal(t.compositionType, 'Cover');
  assert.equal(t.copyrightType, 'Licensed');
  assert.equal(t.rightsProofUrl, 'https://rights.example.com/proof.pdf');
  assert.equal(t.aiUsage, 'Partial');
  assert.deepEqual(t.writers, ['Track Writer']);
  assert.deepEqual(t.composers, ['Track Composer']);
  assert.deepEqual(t.producers, ['Track Producer']);
  assert.deepEqual(t.mixingEngineers, ['Track Mixer']);
  assert.deepEqual(t.masteringEngineers, ['Track Master']);
  assert.deepEqual(t.featuredArtists, ['Track Guest']);
  assert.deepEqual(t.contributors, [{ name: 'Aarav Sen', role: 'Lead Vocals' }]);
  assert.equal(t.previewStart, '0:45');
  assert.equal(t.durationSeconds, 210);
  assert.equal(t.sourceSong, 'song_123');
});

test('10. Unsupported stores, territories, audio formats, and artwork specs are rejected', async () => {
  // Unavailable/unsupported stores & territories
  const badStores = makeValidRelease({
    dspOutletIds: ['Spotify', 'Beatport', 'CustomFakeStore'],
    worldwide: false,
    territories: ['US', 'INVALID_ISO'],
  });
  const storeRes = validateRelease(badStores, { catalogue: CATALOGUE, mode: 'submit' });
  assert.equal(storeRes.ready, false);
  assert.ok(storeRes.errors.some((e) => e.field === 'dspOutletIds' && /Beatport/.test(e.message)));
  assert.ok(storeRes.errors.some((e) => e.field === 'dspOutletIds' && /CustomFakeStore/.test(e.message)));
  assert.ok(storeRes.errors.some((e) => e.field === 'territories' && /INVALID_ISO/.test(e.message)));

  // Unsupported audio formats (MP3, M4A, AIFF) rejected in metadata & multer fileFilter
  for (const [filename, mime] of [
    ['song.mp3', 'audio/mpeg'],
    ['song.m4a', 'audio/mp4'],
    ['song.aiff', 'audio/aiff'],
  ]) {
    const metaErrors = validateAudioMeta({ name: filename, mimetype: mime, size: 1024 });
    assert.ok(metaErrors.length > 0, `${filename} should be rejected by validateAudioMeta`);

    const filterRes = await new Promise((resolve) => {
      distributionUpload.fileFilter({}, { fieldname: 'audio_0', originalname: filename, mimetype: mime }, (err, ok) => {
        resolve({ err, ok });
      });
    });
    assert.ok(filterRes.err, `${filename} should be rejected by multer fileFilter`);
  }

  // WAV and FLAC accepted by multer fileFilter
  for (const [filename, mime] of [
    ['master.wav', 'audio/wav'],
    ['master.flac', 'audio/flac'],
  ]) {
    const filterRes = await new Promise((resolve) => {
      distributionUpload.fileFilter({}, { fieldname: 'audio_0', originalname: filename, mimetype: mime }, (err, ok) => {
        resolve({ err, ok });
      });
    });
    assert.equal(filterRes.err, null);
    assert.equal(filterRes.ok, true);
  }

  // Artwork validation: must be 3000x3000 RGB JPG/PNG
  const wrongSizeErrors = validateImageInfo({ format: 'PNG', width: 1400, height: 1400, colorSpace: 'RGB' });
  assert.ok(wrongSizeErrors.length > 0);
  assert.match(wrongSizeErrors[0].message, /3000x3000/);

  const cmykErrors = validateImageInfo({ format: 'JPG', width: 3000, height: 3000, colorSpace: 'CMYK' });
  assert.ok(cmykErrors.length > 0);
  assert.match(cmykErrors[0].message, /RGB/);

  // Real binary PNG header test for 3000x3000 RGB
  const pngHeader = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(pngHeader, 0);
  pngHeader.writeUInt32BE(13, 8);
  pngHeader.write('IHDR', 12, 'ascii');
  pngHeader.writeUInt32BE(3000, 16);
  pngHeader.writeUInt32BE(3000, 20);
  pngHeader[24] = 8; // bit depth
  pngHeader[25] = 2; // colorType 2 = RGB
  const parsedPng = parseImageInfo(pngHeader);
  assert.equal(parsedPng.width, 3000);
  assert.equal(parsedPng.height, 3000);
  assert.equal(parsedPng.colorSpace, 'RGB');
  assert.equal(validateImageInfo(parsedPng).length, 0);
});

test('11. 300 MB audio upload boundary and multipart chunk planning', async () => {
  const MAX_300_MB = 300 * 1024 * 1024;
  assert.equal(maxAudioBytes(), MAX_300_MB);

  // Exactly 300 MB passes
  const exact300 = validateAudioMeta(
    { name: 'master.wav', mimetype: 'audio/wav', size: MAX_300_MB },
    { maxBytes: MAX_300_MB }
  );
  assert.equal(exact300.length, 0);

  // 300 MB + 1 byte fails
  const over300 = validateAudioMeta(
    { name: 'master.wav', mimetype: 'audio/wav', size: MAX_300_MB + 1 },
    { maxBytes: MAX_300_MB }
  );
  assert.ok(over300.length > 0);
  assert.equal(over300[0].code, 'AUDIO_TOO_LARGE');

  // Release validation also enforces the 300 MB boundary per track
  const oversizedRelease = makeValidRelease({
    tracks: [makeValidTrack({ audioSizeBytes: MAX_300_MB + 1024 })],
  });
  const relRes = validateRelease(oversizedRelease, {
    catalogue: CATALOGUE,
    mode: 'submit',
    maxAudioBytes: MAX_300_MB,
  });
  assert.equal(relRes.ready, false);
  assert.ok(relRes.errors.some((e) => e.field === 'tracks[0].audio' && e.code === 'AUDIO_TOO_LARGE'));

  // Chunk planner: 50 MiB file -> 1 part; 300 MiB file -> 6 parts of 50 MiB each
  const singlePlan = planParts(50 * 1024 * 1024);
  assert.equal(singlePlan.length, 1);

  const multiPlan = planParts(MAX_300_MB);
  assert.equal(multiPlan.length, 6);
  const totalPlanned = multiPlan.reduce((sum, p) => sum + (p.end - p.start), 0);
  assert.equal(totalPlanned, MAX_300_MB);
  assert.equal(multiPlan[0].start, 0);
  assert.equal(multiPlan[multiPlan.length - 1].end, MAX_300_MB);

  // Verify on-disk WAV signature validation and chunked uploadFile with mocked fetch
  const tmpFile = path.join(os.tmpdir(), `distribeats-test-${Date.now()}.wav`);
  const wavBuf = Buffer.alloc(1024);
  wavBuf.write('RIFF', 0, 'ascii');
  wavBuf.writeUInt32LE(1016, 4);
  wavBuf.write('WAVE', 8, 'ascii');
  fs.writeFileSync(tmpFile, wavBuf);

  try {
    const fileErrors = await validateAudioFile(
      tmpFile,
      { name: 'master.wav', mimetype: 'audio/wav', size: 1024 },
      { maxBytes: MAX_300_MB }
    );
    assert.equal(fileErrors.length, 0);

    const putCalls = [];
    const mockHttp = {
      put: async (url, body, opts) => {
        putCalls.push({ url, bytes: body.length, headers: opts.headers });
        return { etag: '"part-etag"' };
      },
    };
    await uploadFile('rel_1', 'trk_1', tmpFile, 'audio/wav', '/releases/rel_1/upload/trk_1', {
      maxBytes: MAX_300_MB,
      http: mockHttp,
    });
    assert.equal(putCalls.length, 1);
    assert.equal(putCalls[0].bytes, 1024);

    // Oversized file is blocked by uploadFile before any HTTP call
    await assert.rejects(
      uploadFile('rel_1', 'trk_1', tmpFile, 'audio/wav', '/releases/rel_1/upload/trk_1', {
        maxBytes: 512,
        http: mockHttp,
      }),
      (err) => err.code === 'DISTRIBEATS_FILE_TOO_LARGE' && err.status === 413
    );
  } finally {
    fs.unlinkSync(tmpFile);
  }
});

test('12. Mapper generates the exact documented DistriBeats ReleaseCreate payload', () => {
  const release = makeValidRelease({
    title: 'Solar Echoes',
    type: 'single',
    genre: 'Electronic',
    subGenre: 'Electronic/House',
    language: 'English',
    releaseDate: '2026-12-01',
    copyright: '© 2026 HoodBoy Ent.',
    publishingCopyright: '℗ 2026 HoodBoy Ent.',
    upc: '123456789012',
    spotifyArtistUrl: 'https://open.spotify.com/artist/4Z8W4fKeB5YxbusRsdQVPb',
    dspOutletIds: ['Spotify', 'Apple Music'],
    worldwide: false,
    territories: ['US', 'CA', 'GB'],
    excludedTerritories: [],
    aiDocumentUrl: 'https://docs.example.com/ai.pdf',
    attestations: { age: true, rights: true },
    tracks: [
      makeValidTrack({
        trackNumber: 1,
        title: 'Solar Echoes',
        version: 'Radio Edit',
        isrc: 'USRC17607839',
        iswc: 'T-034.524.680-1',
        explicit: true,
        instrumental: false,
        language: 'English',
        compositionType: 'Cover',
        copyrightType: 'Licensed',
        rightsProofUrl: 'https://rights.example.com/solar.pdf',
        aiUsage: 'Partial',
        writers: ['Riya Kapoor'],
        composers: ['Aarav Sen'],
        producers: ['Kiran Rao'],
        mixingEngineers: ['Dev Malhotra'],
        masteringEngineers: ['Meera Nair'],
        featuredArtists: ['Zoya Khan'],
        performers: [{ name: 'Aarav Sen', role: 'Lead Vocals' }],
        previewStart: '0:30',
        durationSeconds: 198,
      }),
    ],
  });

  const payload = mapRelease(release, {
    artistName: 'Aarav Sen',
    distribeatsArtistId: 'usr_9f2c',
  });

  assert.equal(payload.title, 'Solar Echoes');
  assert.equal(payload.displayArtist, 'Aarav Sen');
  assert.equal(payload.artistId, 'usr_9f2c');
  assert.equal(payload.releaseType, 'Single');
  assert.equal(payload.genre, 'Electronic');
  assert.equal(payload.subGenre, 'Electronic/House');
  assert.equal(payload.language, 'English');
  assert.equal(payload.releaseDate, '2026-12-01');
  assert.equal(payload.cLine, '2026 HoodBoy Ent.');
  assert.equal(payload.pLine, '2026 HoodBoy Ent.');
  assert.equal(payload.upc, '123456789012');
  assert.deepEqual(payload.stores, ['Spotify', 'Apple Music']);
  assert.deepEqual(payload.territories, ['US', 'CA', 'GB']);
  assert.equal(payload.aiDocumentUrl, 'https://docs.example.com/ai.pdf');
  assert.deepEqual(payload.attestations, { age: true, rights: true });
  assert.equal(payload.requestUploadUrls, true);
  assert.equal(payload.spotifyArtistUrl, 'https://open.spotify.com/artist/4Z8W4fKeB5YxbusRsdQVPb');
  assert.equal(payload.newSpotifyArtist, undefined);

  const track = payload.tracks[0];
  assert.equal(track.title, 'Solar Echoes');
  assert.equal(track.version, 'Radio Edit');
  assert.equal(track.isrc, 'USRC17607839');
  assert.equal(track.iswc, 'T-034.524.680-1');
  assert.equal(track.explicit, true);
  assert.equal(track.instrumental, false);
  assert.equal(track.language, 'English');
  assert.equal(track.compositionType, 'Cover');
  assert.equal(track.copyrightType, 'Licensed');
  assert.equal(track.rightsProofUrl, 'https://rights.example.com/solar.pdf');
  assert.equal(track.aiUsage, 'Partial');
  assert.equal(track.writers, 'Riya Kapoor');
  assert.equal(track.composers, 'Aarav Sen');
  assert.equal(track.producers, 'Kiran Rao');
  assert.equal(track.mixingEngineers, 'Dev Malhotra');
  assert.equal(track.masteringEngineers, 'Meera Nair');
  assert.equal(track.featuring, 'Zoya Khan');
  assert.deepEqual(track.contributors, [{ name: 'Aarav Sen', role: 'Lead Vocals' }]);
  assert.equal(track.previewStart, '0:30');
  assert.equal(track.durationSeconds, 198);

  const payloadErrors = validateMappedPayload(payload, CATALOGUE);
  assert.equal(payloadErrors.length, 0, `Mapped payload should pass pre-flight check: ${JSON.stringify(payloadErrors)}`);
});

test('13. Missing credentials fail closed with DISTRIBEATS_NOT_CONFIGURED', async () => {
  assert.equal(keyMode(''), 'none');
  assert.throws(() => assertKeyAllowed(''), (err) => err.code === 'DISTRIBEATS_NOT_CONFIGURED' && err.status === 503);

  const client = new DistribeatsClient({ token: '', baseUrl: 'https://distribeats.com/api/public/v1' });
  await assert.rejects(client.get('/releases'), (err) => err.code === 'DISTRIBEATS_NOT_CONFIGURED');
});

test('14. Live keys (db_live_) are blocked in test-only mode while db_test_ keys are permitted', async () => {
  const prevAllow = process.env.DISTRIBEATS_ALLOW_LIVE;
  delete process.env.DISTRIBEATS_ALLOW_LIVE;

  try {
    assert.equal(keyMode('db_live_secret12345'), 'live');
    assert.equal(keyMode('db_test_secret12345'), 'test');

    // Live key must throw DISTRIBEATS_LIVE_KEY_BLOCKED when DISTRIBEATS_ALLOW_LIVE is not enabled
    assert.throws(
      () => assertKeyAllowed('db_live_secret12345'),
      (err) => err.code === 'DISTRIBEATS_LIVE_KEY_BLOCKED' && err.status === 403
    );

    const liveClient = new DistribeatsClient({
      token: 'db_live_secret12345',
      baseUrl: 'https://distribeats.com/api/public/v1',
    });
    await assert.rejects(
      liveClient.post('/releases', { title: 'Blocked Live Submission' }),
      (err) => err.code === 'DISTRIBEATS_LIVE_KEY_BLOCKED'
    );

    // Non-prefixed unknown key is rejected in test-only mode
    assert.throws(
      () => assertKeyAllowed('arbitrary_token_value'),
      (err) => err.code === 'DISTRIBEATS_NOT_CONFIGURED' && err.status === 503
    );

    // db_test_ key is allowed
    assert.equal(assertKeyAllowed('db_test_valid_test_key_123'), 'test');
    const modeInfo = describeMode('db_test_valid_test_key_123');
    assert.equal(modeInfo.testMode, true);
    assert.equal(modeInfo.keyMode, 'test');
    assert.equal(modeInfo.liveBlocked, false);
  } finally {
    if (prevAllow !== undefined) process.env.DISTRIBEATS_ALLOW_LIVE = prevAllow;
  }
});

test('15. Music Catalog import prefills track & release fields without mutating source records and release-date lead time is enforced', () => {
  const song = Object.freeze({
    _id: 'song_abc123',
    title: 'Velvet Skyline',
    artist: 'artist_1',
    genre: 'Electronic',
    duration: 204,
    isrc: 'USRC17607839',
    producedBy: 'Kiran Rao',
    writtenBy: 'Riya Kapoor',
    credits: [
      { name: 'Dev Malhotra', role: 'mixer' },
      { name: 'Meera Nair', role: 'masterer' },
      { name: 'Neha Verma', role: 'featured_artist' },
    ],
    fileUrl: '',
  });
  const metadata = Object.freeze({
    title: 'Velvet Skyline',
    isrc: 'USRC17607839',
    iswc: 'T-034.524.680-1',
    upc: '123456789012',
    genre: 'Electronic',
    subgenre: 'Electronic/House',
    language: 'English',
    isExplicit: true,
    copyrightOwner: '2026 HoodBoy Ent.',
    publisher: '2026 HoodBoy Ent.',
    credits: [
      { name: 'Aarav Sen', role: 'composer' },
      { name: 'Riya Kapoor', role: 'songwriter' },
    ],
  });
  const ownership = Object.freeze({
    masterOwner: 'HoodBoy Ent.',
    writers: [{ name: 'Riya Kapoor', percentage: 100, role: 'songwriter' }],
    producer: 'Kiran Rao',
    beatLicense: { type: 'exclusive', documentUrl: 'https://rights.example.com/beat.pdf' },
  });
  const artist = Object.freeze({
    _id: 'artist_1',
    name: 'Aarav Sen',
  });

  const imported = buildImport({ song, metadata, ownership, artist }, CATALOGUE);
  assert.equal(imported.track.sourceSong, 'song_abc123');
  assert.equal(imported.track.title, 'Velvet Skyline');
  assert.equal(imported.track.isrc, 'USRC17607839');
  assert.equal(imported.track.iswc, 'T-034.524.680-1');
  assert.equal(imported.track.explicit, true);
  assert.ok(imported.track.writers.includes('Riya Kapoor'));
  assert.ok(imported.track.composers.includes('Aarav Sen'));
  assert.ok(imported.track.producers.includes('Kiran Rao'));
  assert.ok(imported.track.mixingEngineers.includes('Dev Malhotra'));
  assert.ok(imported.track.masteringEngineers.includes('Meera Nair'));
  assert.ok(imported.track.featuredArtists.includes('Neha Verma'));
  assert.ok(imported.suggestions.rightsProofUrls.some((d) => d.url === 'https://rights.example.com/beat.pdf'));

  // Lead-time validation rejects yesterday/today and accepts >= earliestReleaseDate
  const tooSoon = new Date().toISOString().slice(0, 10);
  assert.ok(releaseDateError(tooSoon));
  assert.equal(releaseDateError(earliestReleaseDate()), null);
});
