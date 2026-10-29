const displayName = artist => artist?.artistName || artist?.stageName || artist?.legalName || artist?.name || '';
const titleCase = value => String(value || '').replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
const list = value => Array.isArray(value) ? value.filter(Boolean) : String(value || '').split(',').map(item => item.trim()).filter(Boolean);
const names = value => list(value).join(', ');

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

const contributorRole = role => {
  const mapped = ({
    primary_artist: 'Lead Vocals',
    featured_artist: 'Vocals',
    producer: 'Programming',
    songwriter: 'Vocals',
    composer: 'Keyboards',
  })[role] || titleCase(role);
  return PERFORMER_ROLES.has(mapped) ? mapped : 'Lead Vocals';
};

const mapTrack = (track, release, artist) => {
  const artistName = displayName(artist);
  const contributors = (track.contributors || []).map(item => ({ name: item.name, role: contributorRole(item.role) }));
  if (!contributors.some(item => PERFORMER_ROLES.has(item.role))) {
    contributors.unshift({ name: artistName || 'Artist', role: 'Lead Vocals' });
  }
  const composers = names(track.composers?.length ? track.composers : release.composers?.length ? release.composers : release.songwriters);
  const writers = track.instrumental ? undefined : names(track.writers?.length ? track.writers : release.songwriters?.length ? release.songwriters : release.composers);
  const featuring = names(track.featuring?.length ? track.featuring : release.featuringArtists);
  return {
    title: release.type === 'single' ? release.title : track.title,
    ...(track.version && track.version !== 'Original' ? { version: track.version } : {}),
    ...(track.isrc ? { isrc: track.isrc } : {}),
    ...(track.iswc ? { iswc: track.iswc } : {}),
    displayArtist: artistName,
    ...(featuring ? { featuring } : {}),
    ...(track.durationSeconds ? { durationSeconds: track.durationSeconds } : {}),
    ...(track.previewStart ? { previewStart: track.previewStart } : {}),
    explicit: Boolean(track.explicit || release.explicit),
    instrumental: Boolean(track.instrumental),
    language: track.language || release.language || 'English',
    compositionType: track.compositionType === 'cover_song' || track.compositionType === 'Cover' ? 'Cover' : 'Original',
    copyrightType: track.copyrightType || (track.compositionType === 'cover_song' || track.compositionType === 'Cover' ? 'Licensed' : 'Original'),
    ...(track.rightsProofUrl ? { rightsProofUrl: track.rightsProofUrl } : {}),
    aiUsage: track.audioAiUsage === 'none' || track.aiUsage === 'None' ? 'None' : track.audioAiUsage === 'all' || track.aiUsage === 'Full' ? 'Full' : track.audioAiUsage ? 'Partial' : 'None',
    composers,
    ...(writers ? { writers } : {}),
    producers: names(track.producers?.length ? track.producers : release.producer),
    mixingEngineers: names(track.mixingEngineers?.length ? track.mixingEngineers : release.mixingEngineers),
    masteringEngineers: names(track.masteringEngineers?.length ? track.masteringEngineers : release.masteringEngineers),
    contributors,
    ...(track.audioFileName ? { audioFileName: track.audioFileName } : {}),
  };
};

const mapRelease = (release, artist) => {
  const year = new Date(release.releaseDate).getUTCFullYear();
  const owner = String(release.copyright || process.env.DISTRIBEATS_LABEL_NAME || 'HoodBoy Entertainment').replace(/^[©℗]\s*/, '').replace(/^\d{4}\s+/, '');
  const pLineOwner = String(release.publishingCopyright || owner).replace(/^[©℗]\s*/, '').replace(/^\d{4}\s+/, '');
  const stores = (release.dspOutletIds || []).filter(s => s && s !== 'all_dsps');
  const spotifyUrl = release.spotifyArtistUrl || artist?.socialLinks?.spotify || '';
  return {
    title: release.title,
    displayArtist: displayName(artist),
    ...(artist?.distribeatsArtistId ? { artistId: artist.distribeatsArtistId } : {}),
    releaseType: ({ single: 'Single', ep: 'EP', album: 'Album', Single: 'Single', EP: 'EP', Album: 'Album' })[release.type] || 'Single',
    genre: release.genre,
    subGenre: release.subGenre || release.genre,
    language: release.language || 'English',
    releaseDate: new Date(release.releaseDate).toISOString().slice(0, 10),
    ...(release.originalReleaseDate ? { originalReleaseDate: new Date(release.originalReleaseDate).toISOString().slice(0, 10) } : {}),
    ...(release.upc ? { upc: release.upc } : {}),
    ...(release.catalogNumber ? { catalogNumber: release.catalogNumber } : {}),
    ...(process.env.DISTRIBEATS_LABEL_NAME ? { label: process.env.DISTRIBEATS_LABEL_NAME } : {}),
    pLine: /^\d{4}\s+/.test(String(release.publishingCopyright || '')) ? release.publishingCopyright.replace(/^[©℗]\s*/, '') : `${year} ${pLineOwner}`,
    cLine: `${year} ${owner}`,
    explicit: Boolean(release.explicit),
    territories: (release.territories || []).filter(value => value && value !== 'WORLDWIDE'),
    excludedTerritories: release.excludedTerritories || [],
    stores: stores.length ? stores : ['Spotify', 'Apple Music', 'YouTube Music'],
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

module.exports = { mapRelease, mapTrack, normalizeStatus, displayName, PERFORMER_ROLES };
