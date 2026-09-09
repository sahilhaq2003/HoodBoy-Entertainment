const Campaign = require('../models/Campaign');

const CAMPAIGN_FIELDS = ['name', 'type', 'artist', 'project', 'release', 'status', 'startDate', 'endDate', 'budget', 'spent', 'reach', 'impressions', 'clicks', 'conversions', 'engagement', 'attributedRevenue', 'assignedTo', 'goals', 'objective', 'targetAudience', 'mainStory', 'contentThemes', 'callsToAction', 'releaseDate', 'platforms', 'contentCategories', 'approvalRequired', 'approvedBy', 'approvedAt', 'approvalNotes', 'contentTarget', 'budgetAlertThreshold', 'notes', 'tags'];
const CONTENT_ITEM_FIELDS = ['title', 'platform', 'contentType', 'category', 'scheduledDate', 'publishedDate', 'status', 'caption', 'mediaUrl', 'link', 'impressions', 'clicks', 'likes', 'shares', 'comments', 'conversions'];
const pick = (obj, keys) => keys.reduce((o, k) => { if (obj[k] !== undefined) o[k] = obj[k]; return o; }, {});

exports.getCampaigns = async (req, res) => {
  try {
    const { search, status, type, artist, startDate, endDate, page = 1, limit = 20 } = req.query;
    const query = {};
    if (status) query.status = status;
    if (type) query.type = type;
    if (artist) query.artist = artist;
    if (startDate || endDate) {
      query.startDate = {};
      if (startDate) query.startDate.$gte = new Date(startDate);
      if (endDate) query.startDate.$lte = new Date(endDate);
    }
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { notes: { $regex: search, $options: 'i' } },
      ];
    }
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [campaigns, total] = await Promise.all([
      Campaign.find(query)
        .populate('artist', 'name stageName artistName image')
        .populate('assignedTo', 'name')
        .sort('-startDate')
        .skip(skip)
        .limit(parseInt(limit)),
      Campaign.countDocuments(query),
    ]);
    res.json({ success: true, data: campaigns, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getCampaignById = async (req, res) => {
  try {
    const campaign = await Campaign.findById(req.params.id)
      .populate('artist', 'name stageName artistName image')
      .populate('project', 'name')
      .populate('release', 'title')
      .populate('assignedTo', 'name');
    if (!campaign) return res.status(404).json({ success: false, message: 'Campaign not found' });
    res.json({ success: true, data: campaign });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createCampaign = async (req, res) => {
  try {
    if (!String(req.body.objective || '').trim() || !String(req.body.targetAudience || '').trim()) {
      return res.status(400).json({ success: false, message: 'Campaign objective and target audience are required' });
    }
    const campaign = await Campaign.create(pick(req.body, CAMPAIGN_FIELDS));
    res.status(201).json({ success: true, data: campaign });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.updateCampaign = async (req, res) => {
  try {
    const campaign = await Campaign.findById(req.params.id);
    if (!campaign) return res.status(404).json({ success: false, message: 'Campaign not found' });
    Object.assign(campaign, pick(req.body, CAMPAIGN_FIELDS));
    await campaign.save();
    res.json({ success: true, data: campaign });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.deleteCampaign = async (req, res) => {
  try {
    const campaign = await Campaign.findByIdAndDelete(req.params.id);
    if (!campaign) return res.status(404).json({ success: false, message: 'Campaign not found' });
    res.json({ success: true, message: 'Campaign deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getCalendar = async (req, res) => {
  try {
    const month = parseInt(req.query.month) || new Date().getMonth() + 1;
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59, 999);
    const campaigns = await Campaign.find({
      'contentItems.scheduledDate': { $gte: start, $lte: end },
    })
      .populate('artist', 'name stageName')
      .select('name artist contentItems');
    const items = [];
    campaigns.forEach(c => {
      c.contentItems.forEach(ci => {
        if (ci.scheduledDate && ci.scheduledDate >= start && ci.scheduledDate <= end) {
          items.push({
            _id: ci._id,
            campaignId: c._id,
            campaignName: c.name,
            artist: c.artist,
            title: ci.title,
            platform: ci.platform,
            contentType: ci.contentType,
            scheduledDate: ci.scheduledDate,
            status: ci.status,
            caption: ci.caption,
          });
        }
      });
    });
    items.sort((a, b) => new Date(a.scheduledDate) - new Date(b.scheduledDate));
    res.json({ success: true, data: items });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.addContentItem = async (req, res) => {
  try {
    const campaign = await Campaign.findById(req.params.id);
    if (!campaign) return res.status(404).json({ success: false, message: 'Campaign not found' });
    campaign.contentItems.push(pick(req.body, CONTENT_ITEM_FIELDS));
    await campaign.save();
    res.status(201).json({ success: true, data: campaign });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.updateContentItem = async (req, res) => {
  try {
    const campaign = await Campaign.findById(req.params.id);
    if (!campaign) return res.status(404).json({ success: false, message: 'Campaign not found' });
    const item = campaign.contentItems.id(req.params.contentId);
    if (!item) return res.status(404).json({ success: false, message: 'Content item not found' });
    Object.assign(item, pick(req.body, CONTENT_ITEM_FIELDS));
    await campaign.save();
    res.json({ success: true, data: campaign });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.deleteContentItem = async (req, res) => {
  try {
    const campaign = await Campaign.findById(req.params.id);
    if (!campaign) return res.status(404).json({ success: false, message: 'Campaign not found' });
    const item = campaign.contentItems.id(req.params.contentId);
    if (!item) return res.status(404).json({ success: false, message: 'Content item not found' });
    campaign.contentItems.pull(req.params.contentId);
    await campaign.save();
    res.json({ success: true, data: campaign });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getCampaignPerformance = async (req, res) => {
  try {
    const campaign = await Campaign.findById(req.params.id)
      .populate('artist', 'name stageName');
    if (!campaign) return res.status(404).json({ success: false, message: 'Campaign not found' });
    let contentImpressions = 0;
    let contentClicks = 0;
    let contentConversions = 0;
    let totalLikes = 0;
    let totalShares = 0;
    let totalComments = 0;
    const byPlatform = {};
    const byStatus = {};
    campaign.contentItems.forEach(ci => {
      contentImpressions += ci.impressions || 0;
      contentClicks += ci.clicks || 0;
      contentConversions += ci.conversions || 0;
      totalLikes += ci.likes || 0;
      totalShares += ci.shares || 0;
      totalComments += ci.comments || 0;
      if (!byPlatform[ci.platform]) byPlatform[ci.platform] = { impressions: 0, clicks: 0, conversions: 0, count: 0 };
      byPlatform[ci.platform].impressions += ci.impressions || 0;
      byPlatform[ci.platform].clicks += ci.clicks || 0;
      byPlatform[ci.platform].conversions += ci.conversions || 0;
      byPlatform[ci.platform].count += 1;
      if (!byStatus[ci.status]) byStatus[ci.status] = 0;
      byStatus[ci.status] += 1;
    });
    const totalImpressions = contentImpressions || campaign.impressions;
    const totalClicks = contentClicks || campaign.clicks;
    const totalConversions = contentConversions || campaign.conversions;
    const costPerClick = totalClicks > 0 ? campaign.spent / totalClicks : 0;
    const costPerConversion = totalConversions > 0 ? campaign.spent / totalConversions : 0;
    const profit = (campaign.attributedRevenue || 0) - campaign.spent;
    const roi = campaign.spent > 0 ? (profit / campaign.spent) * 100 : 0;
    res.json({
      success: true,
      data: {
        campaign: { _id: campaign._id, name: campaign.name, artist: campaign.artist },
        totalImpressions,
        totalClicks,
        totalConversions,
        totalLikes,
        totalShares,
        totalComments,
        costPerClick: Math.round(costPerClick * 100) / 100,
        costPerConversion: Math.round(costPerConversion * 100) / 100,
        roi: Math.round(roi * 100) / 100,
        attributedRevenue: campaign.attributedRevenue || 0,
        profit,
        budget: campaign.budget,
        spent: campaign.spent,
        byPlatform,
        byStatus,
        contentItems: campaign.contentItems,
        advertisingTests: campaign.advertisingTests,
        contentTarget: campaign.contentTarget,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getCampaignStats = async (req, res) => {
  try {
    const [total, active, planned, completed, paused, cancelled, budgetAgg, byType] = await Promise.all([
      Campaign.countDocuments(),
      Campaign.countDocuments({ status: 'active' }),
      Campaign.countDocuments({ status: 'planned' }),
      Campaign.countDocuments({ status: 'completed' }),
      Campaign.countDocuments({ status: 'paused' }),
      Campaign.countDocuments({ status: 'cancelled' }),
      Campaign.aggregate([{ $group: { _id: null, totalBudget: { $sum: '$budget' }, totalSpent: { $sum: '$spent' } } }]),
      Campaign.aggregate([{ $group: { _id: '$type', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
    ]);
    const roiAgg = await Campaign.aggregate([
      { $match: { spent: { $gt: 0 } } },
      { $group: { _id: null, avgRoi: { $avg: '$roi' } } },
    ]);
    res.json({
      success: true,
      data: {
        total,
        active,
        planned,
        completed,
        paused,
        cancelled,
        totalBudget: budgetAgg[0]?.totalBudget || 0,
        totalSpent: budgetAgg[0]?.totalSpent || 0,
        avgRoi: roiAgg[0]?.avgRoi ? Math.round(roiAgg[0].avgRoi * 100) / 100 : 0,
        byType,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
