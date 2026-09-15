const Artist = require('../models/Artist');
const User = require('../models/User');
const crypto = require('crypto');
const { removePreviousArtistImage } = require('../services/legacyUploadCleanup');

const REQUIRED_ONBOARDING_DOCUMENTS = [
  'artist_agreement',
  'tax_form',
  'nda',
  'image_release',
  'payment_instructions',
  'code_of_conduct',
  'social_media_expectations',
  'recording_delivery_requirements',
];

const getOnboardingMissingItems = (artist, requirePackageAcknowledgement = true) => {
  const missing = [];
  const hasText = (value) => typeof value === 'string' && value.trim().length > 0;

  if (!hasText(artist.legalName)) missing.push('Legal name');
  if (!hasText(artist.artistName)) missing.push('Artist name');
  if (!validateEmail(artist.email)) missing.push('Valid email');
  if (!validatePhone(artist.phone)) missing.push('Valid phone number');
  if (!hasText(artist.address?.street) || !hasText(artist.address?.city) ||
      !hasText(artist.address?.state) || !hasText(artist.address?.zipCode) ||
      !hasText(artist.address?.country)) {
    missing.push('Complete address');
  }
  if (!hasText(artist.emergencyContact?.name) || !hasText(artist.emergencyContact?.relationship) ||
      !validatePhone(artist.emergencyContact?.phone)) {
    missing.push('Complete emergency contact');
  }
  if (!hasText(artist.bio)) missing.push('Biography');
  if (!artist.image) missing.push('Profile photo');

  const hasSocialLink = ['instagram', 'tiktok', 'youtube', 'spotify', 'twitter']
    .some(platform => hasText(artist.socialLinks?.[platform]));
  if (!hasSocialLink) missing.push('At least one social-media account');
  if (!artist.musicLinks?.some(link => hasText(link))) missing.push('At least one music link');
  if (!hasText(artist.genre)) missing.push('Genre');
  if (!hasText(artist.previousReleases)) missing.push('Prior release history (enter "None" if not applicable)');
  if (!hasText(artist.catalogOwnership)) missing.push('Prior music ownership statement');
  if (!hasText(artist.proAffiliation)) missing.push('PRO affiliation (select "None" if not applicable)');
  if (!hasText(artist.publisher?.name)) missing.push('Publisher information (enter "None" if not applicable)');

  if (!hasText(artist.paymentInfo?.method)) {
    missing.push('Payment method');
  } else if (['bank_transfer', 'wire'].includes(artist.paymentInfo.method) &&
      (!hasText(artist.paymentInfo.bankName) || !hasText(artist.paymentInfo.accountNumber))) {
    missing.push('Bank payment details');
  } else if (artist.paymentInfo.method === 'paypal' && !validateEmail(artist.paymentInfo.paypalEmail)) {
    missing.push('Valid PayPal email');
  }

  const uploadedTypes = new Set((artist.documents || []).map(document => document.type));
  REQUIRED_ONBOARDING_DOCUMENTS.forEach(type => {
    if (!uploadedTypes.has(type)) missing.push(`Document: ${type.replace(/_/g, ' ')}`);
  });

  if (requirePackageAcknowledgement && !artist.onboardingPackage?.acknowledgedAt) {
    missing.push('HBE onboarding package acknowledgement');
  }

  return missing;
};

const validateEmail = (email) => {
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

const validatePhone = (phone) => {
  if (!phone) return false;
  return phone.replace(/[\s\-\(\)\+]/g, '').length >= 7;
};

const getArtists = async (req, res) => {
  try {
    const { status, onboardingStatus, page = 1, limit = 20, search } = req.query;
    const query = {};

    if (status) query.status = status;
    if (onboardingStatus) query.onboardingStatus = onboardingStatus;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { stageName: { $regex: search, $options: 'i' } },
        { legalName: { $regex: search, $options: 'i' } },
        { artistName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { genre: { $regex: search, $options: 'i' } },
      ];
    }

    const artists = await Artist.find(query)
      .populate('manager', 'name email')
      .populate('approvedBy', 'name')
      .sort('-createdAt')
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Artist.countDocuments(query);

    res.json({
      success: true,
      data: artists,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getArtist = async (req, res) => {
  try {
    const artist = await Artist.findById(req.params.id)
      .populate('manager', 'name email')
      .populate('approvedBy', 'name')
      .populate('onboardedBy', 'name')
      .populate('onboardingPackage.acknowledgedBy', 'name');
    if (!artist) return res.status(404).json({ success: false, message: 'Artist not found' });
    res.json({ success: true, data: artist });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const createArtist = async (req, res) => {
  try {
    const data = { ...req.body };

    // Validate required fields
    const errors = [];
    if (!data.legalName?.trim()) errors.push('Legal name is required');
    if (!data.artistName?.trim()) errors.push('Artist name is required');
    if (!data.email?.trim()) {
      errors.push('Email is required');
    } else if (!validateEmail(data.email)) {
      errors.push('Invalid email format');
    }
    if (!data.phone?.trim()) {
      errors.push('Phone is required');
    } else if (!validatePhone(data.phone)) {
      errors.push('Invalid phone number');
    }

    if (errors.length > 0) {
      return res.status(400).json({ success: false, message: errors.join('. ') });
    }

    // Sync legacy fields
    if (data.legalName && !data.name) data.name = data.legalName;
    if (data.artistName && !data.stageName) data.stageName = data.artistName;

    data.onboardingStatus = 'in_progress';
    data.onboardingStep = 1;
    data.status = 'upcoming';
    data.onboardedBy = req.user._id;

    const artist = await Artist.create(data);
    res.status(201).json({ success: true, data: artist });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const updateArtist = async (req, res) => {
  try {
    const data = { ...req.body };

    // Sync legacy fields
    if (data.legalName && !data.name) data.name = data.legalName;
    if (data.artistName && !data.stageName) data.stageName = data.artistName;

    const artist = await Artist.findByIdAndUpdate(req.params.id, data, {
      new: true,
      runValidators: true,
    });
    if (!artist) return res.status(404).json({ success: false, message: 'Artist not found' });
    res.json({ success: true, data: artist });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const deleteArtist = async (req, res) => {
  try {
    const artist = await Artist.findByIdAndDelete(req.params.id);
    if (!artist) return res.status(404).json({ success: false, message: 'Artist not found' });
    res.json({ success: true, message: 'Artist deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Onboarding-specific controllers
const updateOnboardingStep = async (req, res) => {
  try {
    const { step, data } = req.body;
    const artist = await Artist.findById(req.params.id);
    if (!artist) return res.status(404).json({ success: false, message: 'Artist not found' });

    // Validate step 1 required fields
    if (step === 1 && data) {
      const errors = [];
      if (!data.legalName?.trim()) errors.push('Legal name is required');
      if (!data.artistName?.trim()) errors.push('Artist name is required');
      if (!data.email?.trim()) {
        errors.push('Email is required');
      } else if (!validateEmail(data.email)) {
        errors.push('Invalid email format');
      }
      if (!data.phone?.trim()) {
        errors.push('Phone is required');
      } else if (!validatePhone(data.phone)) {
        errors.push('Invalid phone number');
      }
      if (errors.length > 0) {
        return res.status(400).json({ success: false, message: errors.join('. ') });
      }
    }

    // Validate step 2 required fields
    if (step === 2 && data) {
      if (!data.genre?.trim()) {
        return res.status(400).json({ success: false, message: 'Genre is required' });
      }
    }

    // Update based on step
    if (step === 1) {
      // Personal Info
      Object.assign(artist, {
        legalName: data.legalName || artist.legalName,
        artistName: data.artistName || artist.artistName,
        email: data.email || artist.email,
        phone: data.phone || artist.phone,
        dateOfBirth: data.dateOfBirth || artist.dateOfBirth,
        address: data.address || artist.address,
        emergencyContact: data.emergencyContact || artist.emergencyContact,
        bio: data.bio !== undefined ? data.bio : artist.bio,
        image: data.image !== undefined ? data.image : artist.image,
        coverPhoto: data.coverPhoto !== undefined ? data.coverPhoto : artist.coverPhoto,
        socialLinks: data.socialLinks || artist.socialLinks,
      });
      if (data.legalName && !data.name) artist.name = data.legalName;
      if (data.artistName && !data.stageName) artist.stageName = data.artistName;
    } else if (step === 2) {
      // Music Info
      Object.assign(artist, {
        genre: data.genre || artist.genre,
        musicLinks: data.musicLinks || artist.musicLinks,
        previousReleases: data.previousReleases !== undefined ? data.previousReleases : artist.previousReleases,
        catalogOwnership: data.catalogOwnership !== undefined ? data.catalogOwnership : artist.catalogOwnership,
        proAffiliation: data.proAffiliation !== undefined ? data.proAffiliation : artist.proAffiliation,
        publisher: data.publisher || artist.publisher,
        paymentInfo: data.paymentInfo || artist.paymentInfo,
        taxInfo: data.taxInfo || artist.taxInfo,
      });
    }

    artist.onboardingStep = Math.max(artist.onboardingStep, step);
    if (artist.onboardingStatus === 'not_started') {
      artist.onboardingStatus = 'in_progress';
    }

    await artist.save();

    res.json({ success: true, data: artist });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const uploadDocument = async (req, res) => {
  try {
    const artist = await Artist.findById(req.params.id);
    if (!artist) return res.status(404).json({ success: false, message: 'Artist not found' });

    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

    const document = {
      name: req.body.name || req.file.originalname,
      type: req.body.type || 'existing_contract',
      fileUrl: `/uploads/documents/${req.file.filename}`,
      fileName: req.file.originalname,
      fileSize: req.file.size,
    };

    artist.documents.push(document);
    artist.onboardingStep = Math.max(artist.onboardingStep, 3);
    if (artist.onboardingStatus === 'not_started') {
      artist.onboardingStatus = 'in_progress';
    }
    await artist.save();

    res.json({ success: true, data: artist });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const uploadImage = async (req, res) => {
  try {
    const artist = await Artist.findById(req.params.id);
    if (!artist) return res.status(404).json({ success: false, message: 'Artist not found' });

    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

    const imageUrl = `/uploads/images/${req.file.filename}`;
    const fieldType = req.body.field || 'image';
    const previousImageUrl = fieldType === 'coverPhoto' ? artist.coverPhoto : artist.image;

    if (fieldType === 'coverPhoto') {
      artist.coverPhoto = imageUrl;
    } else {
      artist.image = imageUrl;
    }

    await artist.save();
    if (previousImageUrl && previousImageUrl !== imageUrl) {
      await removePreviousArtistImage(previousImageUrl);
    }
    res.json({ success: true, data: artist });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const removeDocument = async (req, res) => {
  try {
    const artist = await Artist.findById(req.params.id);
    if (!artist) return res.status(404).json({ success: false, message: 'Artist not found' });

    artist.documents = artist.documents.filter(
      (doc) => doc._id.toString() !== req.params.docId
    );
    await artist.save();

    res.json({ success: true, data: artist });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const approveOnboarding = async (req, res) => {
  try {
    const artist = await Artist.findById(req.params.id);
    if (!artist) return res.status(404).json({ success: false, message: 'Artist not found' });

    const missingItems = getOnboardingMissingItems(artist);
    if (missingItems.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Artist onboarding is incomplete',
        missingItems,
      });
    }

    artist.onboardingStatus = 'approved';
    artist.status = 'active';
    artist.approvedAt = new Date();
    artist.approvedBy = req.user._id;
    artist.onboardingNotes = req.body.notes || '';
    await artist.save();

    // Auto-create a login account for the artist if one doesn't exist yet
    let autoCreatedUser = null;
    if (artist.email) {
      let user = await User.findOne({ email: artist.email.toLowerCase() });
      if (!user) {
        const tempPassword = crypto.randomBytes(8).toString('hex');
        user = await User.create({
          name: artist.artistName || artist.legalName || artist.displayName || 'Artist',
          email: artist.email.toLowerCase(),
          password: tempPassword,
          role: 'artist',
          department: 'Artist',
          phone: artist.phone || '',
          isActive: true,
        });
        autoCreatedUser = { _id: user._id, name: user.name, email: user.email, tempPassword };
      }
    }

    res.json({ success: true, data: artist, autoCreatedUser });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const rejectOnboarding = async (req, res) => {
  try {
    const artist = await Artist.findById(req.params.id);
    if (!artist) return res.status(404).json({ success: false, message: 'Artist not found' });

    artist.onboardingStatus = 'rejected';
    artist.onboardingNotes = req.body.notes || '';
    await artist.save();

    res.json({ success: true, data: artist });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const submitForApproval = async (req, res) => {
  try {
    const artist = await Artist.findById(req.params.id);
    if (!artist) return res.status(404).json({ success: false, message: 'Artist not found' });

    if (req.body.onboardingPackageAcknowledged && !artist.onboardingPackage?.acknowledgedAt) {
      artist.onboardingPackage = {
        version: '1.0',
        deliveredAt: new Date(),
        acknowledgedAt: new Date(),
        acknowledgedBy: req.user._id,
      };
    }

    const missingItems = getOnboardingMissingItems(artist);
    if (missingItems.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Complete all required onboarding items before submission',
        missingItems,
      });
    }

    artist.onboardingStatus = 'pending_approval';
    artist.onboardingStep = 4;
    artist.onboardedBy = req.user._id;
    artist.onboardingNotes = req.body.notes || artist.onboardingNotes;
    await artist.save();

    res.json({ success: true, data: artist });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const getOnboardingStats = async (req, res) => {
  try {
    const stats = await Artist.aggregate([
      {
        $group: {
          _id: '$onboardingStatus',
          count: { $sum: 1 },
        },
      },
    ]);

    const result = {
      not_started: 0,
      in_progress: 0,
      pending_approval: 0,
      approved: 0,
      rejected: 0,
    };

    stats.forEach((s) => {
      result[s._id] = s.count;
    });

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getArtists,
  getArtist,
  createArtist,
  updateArtist,
  deleteArtist,
  updateOnboardingStep,
  uploadDocument,
  uploadImage,
  removeDocument,
  approveOnboarding,
  rejectOnboarding,
  submitForApproval,
  getOnboardingStats,
};
