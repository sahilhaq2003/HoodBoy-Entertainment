const CONTENT_TYPES = { single: 'Single', ep: 'EP', album: 'Album' };
const languageCode = value => ({ english: 'en', spanish: 'es', french: 'fr', german: 'de', italian: 'it', portuguese: 'pt', japanese: 'ja-Jpan', korean: 'ko', instrumental: 'zxx' }[String(value || '').toLowerCase()] || value || 'en');
const displayName = artist => artist.artistName || artist.stageName || artist.legalName || artist.name;

const mapArtist = artist => ({
  artist_name: displayName(artist), full_name: artist.legalName || artist.name || null,
  email: artist.email || null, location: [artist.address?.city, artist.address?.country].filter(Boolean).join(', ') || null,
  bio_full: artist.bio || null, instagram_url: artist.socialLinks?.instagram || null,
  twitter_url: artist.socialLinks?.twitter || null, youtube_url: artist.socialLinks?.youtube || null,
  spotify_url: artist.socialLinks?.spotify || null,
});

const mapRelease = (release, artist, genreId) => ({
  content_type: CONTENT_TYPES[release.type] || 'Single',
  label_id: Number(process.env.LABELGRID_LABEL_ID),
  artists: [{ artist_id: Number(artist.labelgridArtistId), artistic_role: 'Primary Artist', position: 1 }],
  titles: [{ iso_code: languageCode(release.language), text: release.title }],
  cat: release.catalogNumber || `HBE-${String(release._id).slice(-10).toUpperCase()}`,
  release_date: new Date(release.releaseDate).toISOString(), artwork_ai_usage: release.artworkAiUsage || 'none',
  preferred_localization: languageCode(release.language), primary_genre_id: Number(genreId),
  barcode_number: release.upc || null, cline_year: new Date(release.releaseDate).getUTCFullYear(),
  cline_name: release.copyright.replace(/^\s*©?\s*\d{4}\s*/u, '') || release.copyright,
  pline_year: new Date(release.releaseDate).getUTCFullYear(),
  pline_name: release.publishingCopyright || release.copyright.replace(/^\s*[℗©]?\s*\d{4}\s*/u, '') || release.copyright,
  explicit: release.explicit ? 'on' : 'off',
  dsp_configs: (release.dspOutletIds?.length ? release.dspOutletIds : ['all_dsps']).map(id => ({ distro_outlet_id: String(id), enabled: true })),
});

const mapTrack = (track, release, artist, index, genreId) => ({
  release_id: Number(release.labelgridReleaseId), titles: [{ iso_code: languageCode(track.language || release.language), text: track.title }],
  ...(track.version && track.version !== 'Original' ? { mix_versions: [{ iso_code: languageCode(track.language || release.language), text: track.version }] } : {}),
  disc: track.discNumber || 1, track_num: track.trackNumber || index + 1, composition_type: track.compositionType || 'original_composition',
  artists: [{ artist_id: Number(artist.labelgridArtistId), artistic_role: 'Primary Artist', position: 1 }],
  audio_ai_usage: track.audioAiUsage || 'none', composition_ai_usage: track.compositionAiUsage || 'none',
  commercial_samples: track.commercialSamples || 'no', audio_language: languageCode(track.language || release.language),
  primary_genre_id: Number(genreId), preferred_localization: languageCode(track.language || release.language),
  isrc: track.isrc || null, explicit: track.explicit ? 'on' : 'off', contributors: [],
  cline_year: new Date(release.releaseDate).getUTCFullYear(), cline_name: track.copyright || release.copyright,
  pline_year: new Date(release.releaseDate).getUTCFullYear(), pline_name: track.copyright || release.copyright,
});

const normalizeStatus = data => {
  const state = data?.state || data?.delivery_status || data?.review_status;
  return ({ not_submitted: 'draft', draft: 'draft', pending: 'submitted', to_review: 'processing', in_progress: 'processing', audit: 'processing', pending_customer_review: 'processing', approved: 'approved', distributed: 'delivered', live: 'live', require_changes: 'rejected', rejected: 'rejected', removing: 'takedown_requested', takedown: 'takedown_requested', removed: 'removed', action_needed: 'error' })[state] || 'processing';
};

module.exports = { mapArtist, mapRelease, mapTrack, normalizeStatus, languageCode, displayName };
