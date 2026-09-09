const ArtistDevelopment = require('../models/ArtistDevelopment');
const Artist = require('../models/Artist');

const SKILL_FIELDS = [
  'musicQuality', 'songwriting', 'vocalAbility', 'stagePerformance',
  'branding', 'visualIdentity', 'socialMediaConsistency', 'interviewSkills',
  'fanEngagement', 'professionalBehavior',
];

const METRIC_FIELDS = [
  'songsCompleted', 'contentPosted', 'engagementGrowth', 'rehearsalsCompleted',
  'deadlinesMet', 'revenueGenerated', 'audienceGrowth', 'teamCooperation',
];

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const normalizeMonth = (month) => {
  if (MONTHS.includes(month)) return month;
  const numericMonth = Number(month);
  return Number.isInteger(numericMonth) && numericMonth >= 0 && numericMonth <= 11
    ? MONTHS[numericMonth]
    : null;
};

const validatePlanGoals = (goals) => {
  if (!Array.isArray(goals) || goals.length === 0) return 'At least one development goal is required';
  const invalid = goals.find(goal => !SKILL_FIELDS.includes(goal.category) || !goal.title?.trim());
  return invalid ? 'Every development goal requires a valid category and title' : null;
};

const normalizePlanGoals = (goals) => goals.map(goal => {
  const progress = Math.min(100, Math.max(0, Number(goal.progress) || 0));
  const completed = Boolean(goal.completed) || progress === 100;
  return {
    ...goal,
    title: goal.title.trim(),
    progress,
    completed,
    completedAt: completed ? (goal.completedAt || new Date()) : undefined,
  };
});

const calcOverall = (skillRatings) => {
  const vals = SKILL_FIELDS.map(k => skillRatings[k] || 5);
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
};

exports.createPlan = async (req, res) => {
  try {
    const { artistId, title, description, goals, focusAreas, notes } = req.body;
    if (!artistId || !title) {
      return res.status(400).json({ success: false, message: 'artistId and title are required' });
    }
    const goalError = validatePlanGoals(goals);
    if (goalError) return res.status(400).json({ success: false, message: goalError });
    const artist = await Artist.findById(artistId);
    if (!artist) {
      return res.status(404).json({ success: false, message: 'Artist not found' });
    }
    const plan = await ArtistDevelopment.create({
      artistId, title, description, goals: normalizePlanGoals(goals), focusAreas: focusAreas || [], notes,
      createdBy: req.user._id,
    });
    const populated = await plan.populate('artistId', 'name artistName stageName image genre');
    res.status(201).json({ success: true, data: populated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getAllPlans = async (req, res) => {
  try {
    const { status, artistId } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (artistId) filter.artistId = artistId;
    const plans = await ArtistDevelopment.find(filter)
      .populate('artistId', 'name artistName stageName image genre totalStreams totalRevenue')
      .populate('createdBy', 'name')
      .sort({ updatedAt: -1 });
    res.json({ success: true, data: plans });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getPlan = async (req, res) => {
  try {
    const plan = await ArtistDevelopment.findById(req.params.id)
      .populate('artistId', 'name artistName stageName image genre totalStreams totalRevenue socialLinks')
      .populate('createdBy', 'name');
    if (!plan) {
      return res.status(404).json({ success: false, message: 'Plan not found' });
    }
    res.json({ success: true, data: plan });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updatePlan = async (req, res) => {
  try {
    const updates = { ...req.body };
    if (updates.goals) {
      const goalError = validatePlanGoals(updates.goals);
      if (goalError) return res.status(400).json({ success: false, message: goalError });
      updates.goals = normalizePlanGoals(updates.goals);
    }
    const plan = await ArtistDevelopment.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true })
      .populate('artistId', 'name artistName stageName image genre totalStreams totalRevenue')
      .populate('createdBy', 'name');
    if (!plan) {
      return res.status(404).json({ success: false, message: 'Plan not found' });
    }
    res.json({ success: true, data: plan });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deletePlan = async (req, res) => {
  try {
    const plan = await ArtistDevelopment.findByIdAndDelete(req.params.id);
    if (!plan) {
      return res.status(404).json({ success: false, message: 'Plan not found' });
    }
    res.json({ success: true, message: 'Plan deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.addScorecard = async (req, res) => {
  try {
    const plan = await ArtistDevelopment.findById(req.params.id);
    if (!plan) {
      return res.status(404).json({ success: false, message: 'Plan not found' });
    }
    const { month, year, skillRatings, metricScores, goals, improvements, comments } = req.body;
    const normalizedMonth = normalizeMonth(month);
    const normalizedYear = Number(year);
    if (!normalizedMonth || !Number.isInteger(normalizedYear) || normalizedYear < 2000 || normalizedYear > 2100) {
      return res.status(400).json({ success: false, message: 'month and year are required' });
    }
    const invalidSkill = SKILL_FIELDS.find(field => {
      const value = skillRatings?.[field];
      return value !== undefined && (!Number.isFinite(Number(value)) || Number(value) < 1 || Number(value) > 10);
    });
    if (invalidSkill) {
      return res.status(400).json({ success: false, message: `${invalidSkill} must be scored from 1 to 10` });
    }
    const invalidMetric = METRIC_FIELDS.find(field => {
      const value = metricScores?.[field];
      if (value === undefined) return false;
      if (!Number.isFinite(Number(value)) || Number(value) < 0) return true;
      return field === 'teamCooperation' && Number(value) > 10;
    });
    if (invalidMetric) {
      return res.status(400).json({ success: false, message: `${invalidMetric} has an invalid value` });
    }
    const existing = plan.scorecards.find(s => normalizeMonth(s.month) === normalizedMonth && s.year === normalizedYear);
    if (existing) {
      return res.status(400).json({ success: false, message: 'Scorecard already exists for this month. Use update instead.' });
    }
    const overallScore = calcOverall(skillRatings || {});
    plan.scorecards.push({
      month: normalizedMonth, year: normalizedYear, skillRatings, metricScores, goals, improvements, comments,
      overallScore, scoredBy: req.user._id,
    });
    await plan.save();
    const updated = await ArtistDevelopment.findById(plan._id)
      .populate('artistId', 'name artistName stageName image genre');
    res.status(201).json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateScorecard = async (req, res) => {
  try {
    const plan = await ArtistDevelopment.findById(req.params.id);
    if (!plan) {
      return res.status(404).json({ success: false, message: 'Plan not found' });
    }
    const sc = plan.scorecards.id(req.params.scorecardId);
    if (!sc) {
      return res.status(404).json({ success: false, message: 'Scorecard not found' });
    }
    const { skillRatings, metricScores, goals, improvements, comments } = req.body;
    if (skillRatings) sc.skillRatings = skillRatings;
    if (metricScores) sc.metricScores = metricScores;
    if (goals) sc.goals = goals;
    if (improvements) sc.improvements = improvements;
    if (comments !== undefined) sc.comments = comments;
    if (skillRatings) sc.overallScore = calcOverall(skillRatings);
    await plan.save();
    const updated = await ArtistDevelopment.findById(plan._id)
      .populate('artistId', 'name artistName stageName image genre');
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getArtistProgress = async (req, res) => {
  try {
    const { artistId } = req.params;
    const plans = await ArtistDevelopment.find({ artistId })
      .populate('artistId', 'name artistName stageName image genre totalStreams totalRevenue')
      .sort({ updatedAt: -1 });
    if (!plans.length) {
      return res.json({ success: true, data: { plans: [], summary: null } });
    }
    const allScorecards = plans.flatMap(p => p.scorecards.map(sc => ({
      ...sc.toObject(),
      planTitle: p.title,
      planId: p._id,
    })));
    allScorecards.sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
      return months.indexOf(a.month) - months.indexOf(b.month);
    });

    const skillAverages = {};
    SKILL_FIELDS.forEach(field => {
      const vals = allScorecards.map(sc => sc.skillRatings?.[field]).filter(Boolean);
      skillAverages[field] = vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : 5;
    });

    const latestScorecard = allScorecards[allScorecards.length - 1] || null;
    const previousScorecard = allScorecards.length >= 2 ? allScorecards[allScorecards.length - 2] : null;

    const growth = {};
    if (latestScorecard && previousScorecard) {
      SKILL_FIELDS.forEach(field => {
        const curr = latestScorecard.skillRatings?.[field] || 5;
        const prev = previousScorecard.skillRatings?.[field] || 5;
        growth[field] = Math.round((curr - prev) * 10) / 10;
      });
    }

    res.json({
      success: true,
      data: {
        plans,
        scorecards: allScorecards,
        summary: {
          totalScorecards: allScorecards.length,
          skillAverages,
          latestScorecard,
          previousScorecard,
          growth,
          overallAverage: latestScorecard?.overallScore || 5,
        },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getDashboardStats = async (req, res) => {
  try {
    const plans = await ArtistDevelopment.find().populate('artistId', 'name artistName stageName image');
    const activePlans = plans.filter(p => p.status === 'active');
    const allScorecards = plans.flatMap(p => p.scorecards);

    const totalArtistsTracked = new Set(plans.map(p => p.artistId._id.toString())).size;

    const skillAverages = {};
    SKILL_FIELDS.forEach(field => {
      const vals = allScorecards.map(sc => sc.skillRatings?.[field]).filter(Boolean);
      skillAverages[field] = vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : 5;
    });

    const latestPerArtist = {};
    plans.forEach(p => {
      const artistId = p.artistId._id.toString();
      const sorted = [...p.scorecards].sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
        return months.indexOf(a.month) - months.indexOf(b.month);
      });
      if (sorted.length) {
        latestPerArtist[artistId] = {
          artist: p.artistId,
          scorecard: sorted[sorted.length - 1],
          plan: p,
        };
      }
    });

    const monthlyTrend = {};
    allScorecards.forEach(sc => {
      const key = `${sc.month} ${sc.year}`;
      if (!monthlyTrend[key]) monthlyTrend[key] = { month: key, scores: [], count: 0 };
      monthlyTrend[key].scores.push(sc.overallScore || 5);
      monthlyTrend[key].count++;
    });
    const trendData = Object.values(monthlyTrend)
      .map(t => ({
        month: t.month,
        avgScore: Math.round((t.scores.reduce((a, b) => a + b, 0) / t.scores.length) * 10) / 10,
        count: t.count,
      }))
      .sort((a, b) => {
        const [aMonth, aYear] = a.month.split(' ');
        const [bMonth, bYear] = b.month.split(' ');
        return Number(aYear) - Number(bYear) || MONTHS.indexOf(aMonth) - MONTHS.indexOf(bMonth);
      });

    res.json({
      success: true,
      data: {
        totalPlans: plans.length,
        activePlans: activePlans.length,
        totalScorecards: allScorecards.length,
        totalArtistsTracked,
        skillAverages,
        latestPerArtist: Object.values(latestPerArtist),
        monthlyTrend: trendData,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
