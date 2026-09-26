const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const crypto = require('crypto');
const DistributionRelease = require('../models/DistributionRelease');
const ffmpegStatic = require('ffmpeg-static');
const ffprobeStatic = require('ffprobe-static');

// Configure ffmpeg to use static binaries
ffmpeg.setFfmpegPath(ffmpegStatic);
ffmpeg.setFfprobePath(ffprobeStatic.path);

const getAudioMetadata = (filePath) => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      resolve(metadata);
    });
  });
};

const getAudioStreamHash = (filePath) => {
  return new Promise((resolve, reject) => {
    // We use ffmpeg to output raw PCM data (excluding metadata/ID3) and hash it
    const hash = crypto.createHash('sha256');
    const command = ffmpeg(filePath)
      .outputFormat('f32le')
      .audioCodec('pcm_f32le')
      .on('error', (err) => reject(err));
    
    const stream = command.pipe();
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
};

const getInternalFingerprint = (filePath) => {
  // A simple fallback fingerprint: generating an MD5 of a specific segment (middle 10s)
  // or a string combining duration and exact raw size.
  // We'll generate a hash of the raw audio stream which acts as a robust exact match.
  // Real acoustic fingerprinting (like Chromaprint) requires fpcalc, which might not be installed.
  return new Promise((resolve, reject) => {
     const hash = crypto.createHash('md5');
     const command = ffmpeg(filePath)
       .setStartTime(10) // skip first 10s to avoid intro silence
       .setDuration(15)  // take 15s of audio
       .outputFormat('s16le')
       .audioCodec('pcm_s16le')
       .audioChannels(1)
       .audioFrequency(8000)
       .on('error', (err) => resolve('fingerprint_failed_or_too_short')); // Don't reject, just handle gracefully
       
     const stream = command.pipe();
     stream.on('data', (chunk) => hash.update(chunk));
     stream.on('end', () => resolve(hash.digest('hex')));
  });
};

exports.runTechnicalQc = async (filePath) => {
  try {
    if (!fs.existsSync(filePath)) {
      return { status: 'FAIL', messages: ['Audio file is missing from server.'] };
    }
    const meta = await getAudioMetadata(filePath);
    const format = meta.format;
    const stream = meta.streams.find(s => s.codec_type === 'audio');
    
    if (!stream) return { status: 'FAIL', messages: ['No audio stream detected.'] };
    
    const duration = parseFloat(format.duration);
    const messages = [];
    let status = 'PASS';
    
    if (duration < 30) {
      status = 'WARNING';
      messages.push(`Very short duration (${duration.toFixed(2)}s). Cover/remix or snippet?`);
    }
    
    const sampleRate = parseInt(stream.sample_rate);
    if (sampleRate < 44100) {
      status = 'WARNING';
      messages.push(`Low sample rate: ${sampleRate}Hz (Standard is 44.1kHz).`);
    }
    
    return {
      status,
      duration,
      sampleRate,
      codec: stream.codec_name,
      channels: stream.channels,
      messages
    };
  } catch (error) {
    return { status: 'FAIL', messages: ['Audio file is corrupted or unreadable.', error.message] };
  }
};

exports.checkDuplicates = async (track, releaseId, audioHash) => {
  const messages = [];
  let duplicateLevel = 'none'; // none, possible, exact
  
  // 1. Exact Audio Hash Match
  const sameAudio = await DistributionRelease.findOne({
    _id: { $ne: releaseId },
    'tracks.audioStreamHash': audioHash
  });
  
  if (sameAudio) {
    duplicateLevel = 'exact';
    messages.push('Exact audio stream match found in another release.');
  }
  
  // 2. ISRC Match
  if (track.isrc) {
    const sameIsrc = await DistributionRelease.findOne({
      _id: { $ne: releaseId },
      'tracks.isrc': track.isrc
    });
    if (sameIsrc) {
      if (duplicateLevel !== 'exact') duplicateLevel = 'possible';
      messages.push(`ISRC ${track.isrc} already exists in another release.`);
    }
  }
  
  return {
    status: duplicateLevel === 'none' ? 'PASS' : (duplicateLevel === 'exact' ? 'FAIL' : 'WARNING'),
    duplicateLevel,
    messages
  };
};

exports.processReleaseQc = async (releaseId) => {
  const release = await DistributionRelease.findById(releaseId);
  if (!release || release.qcStatus === 'qc_processing') return;
  
  release.qcStatus = 'qc_processing';
  await release.save();
  
  let overallStatus = 'qc_passed';
  let hasManualReviewFlags = false;
  
  try {
    // Validate Metadata
    const mdErrors = validateMetadata(release);
    if (mdErrors.length > 0) {
      overallStatus = 'action_required';
    }
    
    // Process Tracks
    for (let i = 0; i < release.tracks.length; i++) {
      const track = release.tracks[i];
      if (!track.audioUrl) continue;
      
      const filePath = path.join(process.cwd(), track.audioUrl);
      
      // Technical QC
      const techQc = await exports.runTechnicalQc(filePath);
      track.audioQcResult = techQc;
      if (techQc.status === 'FAIL') overallStatus = 'action_required';
      if (techQc.status === 'WARNING') hasManualReviewFlags = true;
      
      if (techQc.status !== 'FAIL') {
        // Hash & Fingerprint
        track.audioStreamHash = await getAudioStreamHash(filePath);
        track.internalFingerprint = await getInternalFingerprint(filePath);
        
        // Duplicate Check
        const dupQc = await exports.checkDuplicates(track, release._id, track.audioStreamHash);
        track.duplicateQcResult = dupQc;
        if (dupQc.status === 'FAIL') {
            overallStatus = 'action_required';
            hasManualReviewFlags = true;
        }
        if (dupQc.status === 'WARNING') hasManualReviewFlags = true;
      }
      
      // Check High Risk flags
      if (['cover_song', 'public_domain'].includes(track.compositionType) || track.sampleStatus !== 'no') {
        hasManualReviewFlags = true;
      }
    }
    
    if (hasManualReviewFlags && overallStatus === 'qc_passed') {
      overallStatus = 'manual_review';
    }
    
    if (release.rightsStatus === 'rejected') {
        overallStatus = 'qc_failed';
    } else if (release.rightsStatus === 'documents_required') {
        overallStatus = 'action_required';
    } else if (release.rightsStatus !== 'approved' && ['manual_review', 'qc_passed'].includes(overallStatus)) {
        overallStatus = 'manual_review';
    }
    
    release.qcStatus = overallStatus;
    release.qcHistory.push({
      action: 'Automated QC Run',
      status: overallStatus,
      notes: 'Background QC process completed.'
    });
    
    await release.save();
    
    // Emit socket update
    const emitRelease = require('../controllers/distributionController').emitRelease;
    if (typeof emitRelease === 'function') {
        // emitRelease(release); 
        // Need to require correctly, maybe just standard global emit
        global.io?.to(`release:${release._id}`).emit('labelgrid:release_updated', {
          releaseId: String(release._id),
          qcStatus: release.qcStatus,
          status: release.status
        });
    }
    
  } catch (err) {
    console.error('QC processing error:', err);
    release.qcStatus = 'qc_failed';
    await release.save();
  }
};

function validateMetadata(release) {
    const errors = [];
    if (!release.title) errors.push('Release title is required');
    if (!release.genre) errors.push('Genre is required');
    if (!release.releaseDate) errors.push('Release date is required');
    return errors;
}

// Simple background queue
const qcQueue = [];
let isProcessingQc = false;

const processNextQc = async () => {
    if (isProcessingQc || qcQueue.length === 0) return;
    isProcessingQc = true;
    const releaseId = qcQueue.shift();
    try {
        await exports.processReleaseQc(releaseId);
    } catch (e) {
        console.error("Queue process error", e);
    }
    isProcessingQc = false;
    processNextQc();
};

exports.queueReleaseForQc = (releaseId) => {
    if (!qcQueue.includes(releaseId.toString())) {
        qcQueue.push(releaseId.toString());
        processNextQc();
    }
};
