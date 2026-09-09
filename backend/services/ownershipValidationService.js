const Ownership = require('../models/Ownership');

const normalizedName = (value) => String(value || '').trim().toLowerCase();

const requiredSignatureParties = (ownership) => {
  const parties = [];
  const add = (partyName, role) => {
    const name = String(partyName || '').trim();
    if (!name) return;
    if (!parties.some(party => normalizedName(party.partyName) === normalizedName(name))) {
      parties.push({ partyName: name, role });
    }
  };

  add(ownership.masterOwner, 'master_owner');
  for (const writer of ownership.writers || []) add(writer.name, 'songwriter');
  for (const publisher of ownership.publishers || []) {
    if ((publisher.percentage || 0) > 0) add(publisher.name, 'publisher');
  }
  if ((ownership.producerPercentage || 0) > 0 || ownership.beatLicense?.type !== 'none') {
    add(ownership.producer || ownership.beatLicense?.producer, 'producer');
  }
  for (const featured of ownership.featuredArtists || []) {
    if ((featured.percentage || 0) > 0) add(featured.name, 'featured_artist');
  }
  for (const sample of ownership.samples || []) {
    if ((sample.percentage || 0) > 0 || sample.clearanceStatus === 'cleared') add(sample.owner, 'sample_owner');
  }
  return parties;
};

const validateOwnershipRecord = (ownership) => {
  ownership.calculateTotal();
  const errors = [];

  if (!ownership.isComplete) errors.push(`Total ownership is ${ownership.totalPercentage}%, must be 100%`);
  if (!String(ownership.masterOwner || '').trim()) errors.push('Master owner is required');
  if (!ownership.writers?.length) errors.push('At least one songwriter is required');

  (ownership.writers || []).forEach((writer, index) => {
    if (!String(writer.name || '').trim()) errors.push(`Writer ${index + 1} name is required`);
  });
  (ownership.publishers || []).forEach((publisher, index) => {
    if ((publisher.percentage || 0) > 0 && !String(publisher.name || '').trim()) {
      errors.push(`Publisher ${index + 1} name is required when it has a percentage`);
    }
  });
  if ((ownership.producerPercentage || 0) > 0 && !String(ownership.producer || '').trim()) {
    errors.push('Producer name is required when the producer percentage is greater than 0');
  }
  (ownership.featuredArtists || []).forEach((featured, index) => {
    if ((featured.percentage || 0) > 0 && !String(featured.name || '').trim()) {
      errors.push(`Featured artist ${index + 1} name is required when it has a percentage`);
    }
  });

  const beatLicense = ownership.beatLicense || {};
  if (beatLicense.type && beatLicense.type !== 'none') {
    if (!String(beatLicense.producer || ownership.producer || '').trim()) errors.push('Beat-license producer is required');
    if (!String(beatLicense.terms || '').trim()) errors.push('Beat-license terms are required');
    if (!String(beatLicense.documentUrl || '').trim()) errors.push('Signed beat-license document is required');
    if (beatLicense.expirationDate && new Date(beatLicense.expirationDate) < new Date()) errors.push('Beat license has expired');
  } else if (String(ownership.producer || '').trim() || (ownership.producerPercentage || 0) > 0) {
    errors.push('Beat-license type must be recorded when a producer is credited');
  }

  (ownership.samples || []).forEach((sample, index) => {
    const label = sample.title || `Sample ${index + 1}`;
    if (!String(sample.title || '').trim()) errors.push(`Sample ${index + 1} title is required`);
    if (!String(sample.owner || '').trim()) errors.push(`${label} owner is required`);
    if (sample.clearanceStatus === 'pending') errors.push(`${label} clearance is pending`);
    if (sample.clearanceStatus === 'denied') errors.push(`${label} clearance was denied`);
    if (sample.clearanceStatus === 'cleared' && !String(sample.clearanceDocumentUrl || '').trim()) {
      errors.push(`${label} clearance document is required`);
    }
  });

  if (ownership.copyrightStatus === 'disputed') errors.push('Copyright status is disputed');
  if (ownership.distributionStatus === 'on_hold') errors.push('Distribution is on hold');

  const requiredParties = requiredSignatureParties(ownership);
  for (const requiredParty of requiredParties) {
    const signature = (ownership.signatures || []).find(item =>
      normalizedName(item.partyName) === normalizedName(requiredParty.partyName));
    if (!signature || signature.status !== 'signed') {
      errors.push(`${requiredParty.partyName} signature is required`);
    } else {
      if (!signature.signedAt) errors.push(`${requiredParty.partyName} signature date is required`);
      if (!String(signature.documentUrl || '').trim()) errors.push(`${requiredParty.partyName} signed document is required`);
    }
  }

  const signatureErrors = errors.filter(error => /signature|signed document/i.test(error));
  ownership.signaturesComplete = requiredParties.length > 0 && signatureErrors.length === 0;
  ownership.validationErrors = errors;
  ownership.isReadyForRelease = errors.length === 0;
  if (errors.length > 0 && ownership.releaseApproved) {
    ownership.releaseApproved = false;
    ownership.approvedBy = undefined;
    ownership.approvedAt = undefined;
  }
  return { valid: errors.length === 0, errors, requiredParties };
};

const validateSongsForRelease = async (songIds) => {
  const ids = (songIds || []).map(song => String(song?._id || song)).filter(Boolean);
  if (!ids.length) return { valid: false, errors: ['Release must contain at least one song'], ownerships: [] };

  const ownerships = await Ownership.find({ songId: { $in: ids } });
  const bySong = new Map(ownerships.map(ownership => [String(ownership.songId), ownership]));
  const errors = [];

  for (const songId of ids) {
    const ownership = bySong.get(songId);
    if (!ownership) {
      errors.push(`Song ${songId} has no ownership record`);
      continue;
    }
    const result = validateOwnershipRecord(ownership);
    await ownership.save();
    if (!result.valid) errors.push(`Song ${songId}: ${result.errors.join('; ')}`);
    if (!ownership.releaseApproved) errors.push(`Song ${songId}: ownership has not been approved for release`);
  }

  return { valid: errors.length === 0, errors, ownerships };
};

module.exports = { requiredSignatureParties, validateOwnershipRecord, validateSongsForRelease };
