const mongoose = require('mongoose');
const Artist = require('../models/Artist');
const Song = require('../models/Song');
const Release = require('../models/Release');
const Contract = require('../models/Contract');
const Finance = require('../models/Finance');
const Task = require('../models/Task');
const Campaign = require('../models/Campaign');
const User = require('../models/User');
const RoyaltyLedger = require('../models/RoyaltyLedger');
const Budget = require('../models/Budget');
const ArtistBalance = require('../models/ArtistBalance');
const PerSongAnalytics = require('../models/PerSongAnalytics');

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

exports.getOverview = async (req, res) => {
  try {
    const now = new Date();
    const currentYear = now.getFullYear();
    const previousYear = currentYear - 1;
    const yearStart = new Date(currentYear, 0, 1);
    const prevYearStart = new Date(previousYear, 0, 1);
    const prevYearEnd = new Date(previousYear, 11, 31, 23, 59, 59);
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const [
      activeArtists,
      songsByStatus,
      releasesByStatus,
      activeContracts,
      expiringContracts,
      currentYearFinances,
      prevYearFinances,
      totalStreamsResult,
      activeCampaigns,
      pendingTasks,
      overdueTasks,
      totalSongs,
      totalReleases,
    ] = await Promise.all([
      Artist.countDocuments({ status: 'active' }),
      Song.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Release.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Contract.countDocuments({ status: 'active' }),
      Contract.countDocuments({
        status: 'active',
        endDate: { $gte: now, $lte: thirtyDaysFromNow },
      }),
      Finance.aggregate([
        { $match: { year: currentYear, type: 'income' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Finance.aggregate([
        { $match: { year: previousYear, type: 'income' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Artist.aggregate([
        { $group: { _id: null, total: { $sum: '$totalStreams' } } },
      ]),
      Campaign.countDocuments({ status: 'active' }),
      Task.countDocuments({ status: { $nin: ['completed'] } }),
      Task.countDocuments({
        status: { $nin: ['completed'] },
        deadline: { $lt: now },
      }),
      Song.countDocuments(),
      Release.countDocuments(),
    ]);

    const totalRevenueYTD = currentYearFinances[0]?.total || 0;
    const totalRevenuePrev = prevYearFinances[0]?.total || 0;
    const revenueGrowth = totalRevenuePrev > 0
      ? ((totalRevenueYTD - totalRevenuePrev) / totalRevenuePrev * 100).toFixed(1)
      : totalRevenueYTD > 0 ? 100 : 0;

    const currentYearExpenses = await Finance.aggregate([
      { $match: { year: currentYear, type: 'expense' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    const totalExpensesYTD = currentYearExpenses[0]?.total || 0;
    const profitYTD = totalRevenueYTD - totalExpensesYTD;

    const totalStreams = totalStreamsResult[0]?.total || 0;

    const songsStatusMap = {};
    songsByStatus.forEach(s => { songsStatusMap[s._id] = s.count; });

    const releasesStatusMap = {};
    releasesByStatus.forEach(s => { releasesStatusMap[s._id] = s.count; });

    res.json({
      success: true,
      data: {
        totalArtists: activeArtists,
        totalSongs: totalSongs,
        songsByStatus: songsStatusMap,
        totalReleases: totalReleases,
        releasesByStatus: releasesStatusMap,
        activeContracts,
        expiringContracts,
        totalRevenueYTD,
        totalExpensesYTD,
        profitYTD,
        revenueGrowth: parseFloat(revenueGrowth),
        totalStreams,
        activeCampaigns,
        pendingTasks,
        overdueTasks,
      },
    });
  } catch (error) {
    console.error('Analytics overview error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch analytics overview' });
  }
};

exports.getRevenueAnalytics = async (req, res) => {
  try {
    const currentYear = parseInt(req.query.year) || new Date().getFullYear();
    const previousYear = currentYear - 1;

    const [currentMonthly, previousMonthly, byCategory, byArtist, byQuarter] = await Promise.all([
      Finance.aggregate([
        { $match: { year: currentYear } },
        {
          $group: {
            _id: { month: '$month', type: '$type' },
            total: { $sum: '$amount' },
          },
        },
      ]),
      Finance.aggregate([
        { $match: { year: previousYear } },
        {
          $group: {
            _id: { month: '$month', type: '$type' },
            total: { $sum: '$amount' },
          },
        },
      ]),
      Finance.aggregate([
        { $match: { year: currentYear, type: 'income' } },
        { $group: { _id: '$category', total: { $sum: '$amount' } } },
        { $sort: { total: -1 } },
      ]),
      Finance.aggregate([
        { $match: { year: currentYear, type: 'income', artist: { $ne: null } } },
        {
          $lookup: {
            from: 'artists',
            localField: 'artist',
            foreignField: '_id',
            as: 'artistData',
          },
        },
        { $unwind: { path: '$artistData', preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: '$artist',
            name: { $first: { $ifNull: ['$artistData.artistName', '$artistData.stageName', '$artistData.name', 'Unknown'] } },
            total: { $sum: '$amount' },
          },
        },
        { $sort: { total: -1 } },
      ]),
      Finance.aggregate([
        { $match: { year: currentYear } },
        {
          $group: {
            _id: { quarter: '$quarter', type: '$type' },
            total: { $sum: '$amount' },
          },
        },
      ]),
    ]);

    const monthlyData = MONTHS.map((name, i) => {
      const month = i + 1;
      const currRev = currentMonthly.find(m => m._id.month === month && m._id.type === 'income')?.total || 0;
      const currExp = currentMonthly.find(m => m._id.month === month && m._id.type === 'expense')?.total || 0;
      const prevRev = previousMonthly.find(m => m._id.month === month && m._id.type === 'income')?.total || 0;
      const prevExp = previousMonthly.find(m => m._id.month === month && m._id.type === 'expense')?.total || 0;
      return { name, currentRevenue: currRev, currentExpenses: currExp, previousRevenue: prevRev, previousExpenses: prevExp };
    });

    const quarterlyData = [1, 2, 3, 4].map(q => {
      const rev = byQuarter.find(b => b._id.quarter === q && b._id.type === 'income')?.total || 0;
      const exp = byQuarter.find(b => b._id.quarter === q && b._id.type === 'expense')?.total || 0;
      return { name: `Q${q}`, revenue: rev, expenses: exp, profit: rev - exp };
    });

    const momGrowth = monthlyData.map((m, i) => {
      const growth = i === 0 ? 0 : m.currentRevenue > 0 && monthlyData[i - 1].currentRevenue > 0
        ? ((m.currentRevenue - monthlyData[i - 1].currentRevenue) / monthlyData[i - 1].currentRevenue * 100).toFixed(1)
        : 0;
      return { month: m.name, current: m.currentRevenue, previous: m.previousRevenue, growth: parseFloat(growth) };
    });

    const categoryData = byCategory.map(c => ({
      name: c._id.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      value: c.total,
    }));

    res.json({
      success: true,
      data: {
        monthly: monthlyData,
        byCategory: categoryData,
        byArtist: byArtist.map(a => ({ name: a.name, value: a.total })),
        quarterly: quarterlyData,
        momGrowth,
        topSources: categoryData.slice(0, 5),
      },
    });
  } catch (error) {
    console.error('Revenue analytics error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch revenue analytics' });
  }
};

exports.getArtistAnalytics = async (req, res) => {
  try {
    const [artistStats, topByStreams, topByRevenue] = await Promise.all([
      Artist.aggregate([
        {
          $lookup: {
            from: 'songs',
            localField: '_id',
            foreignField: 'artist',
            as: 'songs',
          },
        },
        {
          $lookup: {
            from: 'releases',
            localField: '_id',
            foreignField: 'artist',
            as: 'releases',
          },
        },
        {
          $lookup: {
            from: 'contracts',
            localField: '_id',
            foreignField: 'artist',
            as: 'contracts',
          },
        },
        {
          $addFields: {
            displayName: { $ifNull: ['$artistName', { $ifNull: ['$stageName', '$name'] }] },
            songsCount: { $size: '$songs' },
            releasesCount: { $size: '$releases' },
            activeContracts: {
              $size: {
                $filter: {
                  input: '$contracts',
                  cond: { $eq: ['$$this.status', 'active'] },
                },
              },
            },
          },
        },
        {
          $project: {
            displayName: 1,
            totalStreams: 1,
            totalRevenue: 1,
            songsCount: 1,
            releasesCount: 1,
            activeContracts: 1,
            status: 1,
          },
        },
        { $sort: { totalRevenue: -1 } },
      ]),
      Artist.aggregate([
        { $match: { totalStreams: { $gt: 0 } } },
        {
          $addFields: {
            displayName: { $ifNull: ['$artistName', { $ifNull: ['$stageName', '$name'] }] },
          },
        },
        { $project: { displayName: 1, totalStreams: 1 } },
        { $sort: { totalStreams: -1 } },
        { $limit: 10 },
      ]),
      Artist.aggregate([
        { $match: { totalRevenue: { $gt: 0 } } },
        {
          $addFields: {
            displayName: { $ifNull: ['$artistName', { $ifNull: ['$stageName', '$name'] }] },
          },
        },
        { $project: { displayName: 1, totalRevenue: 1 } },
        { $sort: { totalRevenue: -1 } },
        { $limit: 10 },
      ]),
    ]);

    res.json({
      success: true,
      data: {
        artists: artistStats,
        topByStreams,
        topByRevenue,
      },
    });
  } catch (error) {
    console.error('Artist analytics error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch artist analytics' });
  }
};

exports.getReleaseAnalytics = async (req, res) => {
  try {
    const now = new Date();
    const thisMonth = now.getMonth() + 1;
    const thisYear = now.getFullYear();
    const lastMonth = thisMonth === 1 ? 12 : thisMonth - 1;
    const lastMonthYear = thisMonth === 1 ? thisYear - 1 : thisYear;

    const [
      byStatus,
      byType,
      upcomingReleases,
      releasedThisMonth,
      releasedLastMonth,
      avgPrepTime,
    ] = await Promise.all([
      Release.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Release.aggregate([
        { $group: { _id: '$type', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      Release.find({ releaseDate: { $gte: now }, status: { $nin: ['cancelled', 'released'] } })
        .populate('artist', 'artistName stageName name')
        .sort({ releaseDate: 1 })
        .limit(10)
        .lean(),
      Release.countDocuments({
        status: 'released',
        releaseDate: {
          $gte: new Date(thisYear, thisMonth - 1, 1),
          $lt: new Date(thisYear, thisMonth, 1),
        },
      }),
      Release.countDocuments({
        status: 'released',
        releaseDate: {
          $gte: new Date(lastMonthYear, lastMonth - 1, 1),
          $lt: new Date(lastMonthYear, lastMonth, 1),
        },
      }),
      Release.aggregate([
        {
          $match: {
            'phases.preparation.startedAt': { $exists: true },
            'phases.post_release.completedAt': { $exists: true },
          },
        },
        {
          $addFields: {
            prepMs: {
              $subtract: ['$phases.preparation.completedAt', '$phases.preparation.startedAt'],
            },
          },
        },
        {
          $group: {
            _id: null,
            avgMs: { $avg: '$prepMs' },
          },
        },
      ]),
    ]);

    const statusMap = {};
    byStatus.forEach(s => { statusMap[s._id] = s.count; });

    const typeData = byType.map(t => ({
      name: t._id.charAt(0).toUpperCase() + t._id.slice(1),
      count: t.count,
    }));

    const upcoming = upcomingReleases.map(r => ({
      _id: r._id,
      title: r.title,
      artist: r.artist?.artistName || r.artist?.stageName || r.artist?.name || 'Unknown',
      releaseDate: r.releaseDate,
      type: r.type,
      status: r.status,
    }));

    const avgDays = avgPrepTime[0]?.avgMs
      ? Math.round(avgPrepTime[0].avgMs / (1000 * 60 * 60 * 24))
      : 0;

    res.json({
      success: true,
      data: {
        byStatus: statusMap,
        byType: typeData,
        upcomingReleases: upcoming,
        thisMonth: releasedThisMonth,
        lastMonth: releasedLastMonth,
        avgPrepDays: avgDays,
      },
    });
  } catch (error) {
    console.error('Release analytics error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch release analytics' });
  }
};

exports.getOperationalAnalytics = async (req, res) => {
  try {
    const now = new Date();
    const twelveWeeksAgo = new Date(now.getTime() - 12 * 7 * 24 * 60 * 60 * 1000);

    const [
      totalTasks,
      byStatus,
      byPriority,
      completedTasks,
      overdueTasks,
      teamPerformance,
      weeklyCompleted,
      overdueByAssignee,
    ] = await Promise.all([
      Task.countDocuments(),
      Task.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Task.aggregate([
        { $group: { _id: '$priority', count: { $sum: 1 } } },
      ]),
      Task.countDocuments({ status: 'completed' }),
      Task.aggregate([
        {
          $match: {
            status: { $nin: ['completed'] },
            deadline: { $lt: now },
          },
        },
        {
          $lookup: {
            from: 'users',
            localField: 'assignedTo',
            foreignField: '_id',
            as: 'assignee',
          },
        },
        { $unwind: { path: '$assignee', preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: '$assignedTo',
            name: { $first: { $ifNull: ['$assignee.name', 'Unassigned'] } },
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
      ]),
      User.aggregate([
        {
          $lookup: {
            from: 'tasks',
            localField: '_id',
            foreignField: 'assignedTo',
            as: 'tasks',
          },
        },
        {
          $addFields: {
            total: { $size: '$tasks' },
            completed: {
              $size: {
                $filter: { input: '$tasks', cond: { $eq: ['$$this.status', 'completed'] } },
              },
            },
            delayed: {
              $size: {
                $filter: { input: '$tasks', cond: { $eq: ['$$this.status', 'delayed'] } },
              },
            },
          },
        },
        {
          $addFields: {
            completionRate: {
              $cond: [{ $gt: ['$total', 0] }, { $round: [{ $multiply: [{ $divide: ['$completed', '$total'] }, 100] }, 1] }, 0],
            },
          },
        },
        {
          $project: { name: 1, total: 1, completed: 1, delayed: 1, completionRate: 1 },
        },
        { $match: { total: { $gt: 0 } } },
        { $sort: { total: -1 } },
      ]),
      Task.aggregate([
        {
          $match: {
            status: 'completed',
            completedAt: { $gte: twelveWeeksAgo },
          },
        },
        {
          $group: {
            _id: {
              week: { $isoWeek: '$completedAt' },
              year: { $isoWeekYear: '$completedAt' },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { '_id.year': 1, '_id.week': 1 } },
      ]),
    ]);

    const statusMap = {};
    byStatus.forEach(s => { statusMap[s._id] = s.count; });
    const priorityMap = {};
    byPriority.forEach(p => { priorityMap[p._id] = p.count; });

    const completionRate = totalTasks > 0 ? ((completedTasks / totalTasks) * 100).toFixed(1) : 0;

    const weeklyTrend = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
      const weekNum = getISOWeek(d);
      const yearNum = d.getFullYear();
      const found = weeklyCompleted.find(
        w => w._id.week === weekNum && w._id.year === yearNum
      );
      const weekStart = new Date(d.getTime() - d.getDay() * 24 * 60 * 60 * 1000);
      weeklyTrend.push({
        name: `${weekStart.getMonth() + 1}/${weekStart.getDate()}`,
        completed: found?.count || 0,
      });
    }

    res.json({
      success: true,
      data: {
        totalTasks,
        byStatus: statusMap,
        byPriority: priorityMap,
        completionRate: parseFloat(completionRate),
        overdueTasks: overdueTasks.length,
        overdueByAssignee: overdueTasks.map(t => ({ name: t.name, count: t.count })),
        teamPerformance,
        weeklyTrend,
      },
    });
  } catch (error) {
    console.error('Operational analytics error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch operational analytics' });
  }
};

exports.getKPIData = async (req, res) => {
  try {
    const now = new Date();
    const currentYear = now.getFullYear();
    const previousYear = currentYear - 1;

    const [
      totalArtists,
      totalReleases,
      totalSongs,
      totalContracts,
      totalRevenue,
      totalExpenses,
      prevYearRevenue,
      prevYearExpenses,
      completedTasks,
      totalTasks,
      campaignData,
    ] = await Promise.all([
      Artist.countDocuments({ status: 'active' }),
      Release.countDocuments({ releaseDate: { $gte: new Date(currentYear, 0, 1) } }),
      Song.countDocuments(),
      Contract.aggregate([
        { $match: { status: 'active' } },
        { $group: { _id: null, avg: { $avg: '$value' }, total: { $sum: '$value' } } },
      ]),
      Finance.aggregate([
        { $match: { year: currentYear, type: 'income' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Finance.aggregate([
        { $match: { year: currentYear, type: 'expense' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Finance.aggregate([
        { $match: { year: previousYear, type: 'income' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Finance.aggregate([
        { $match: { year: previousYear, type: 'expense' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Task.countDocuments({ status: 'completed' }),
      Task.countDocuments(),
      Campaign.aggregate([
        { $match: { status: { $in: ['active', 'completed'] } } },
        {
          $group: {
            _id: null,
            totalSpent: { $sum: '$spent' },
            totalBudget: { $sum: '$budget' },
          },
        },
      ]),
    ]);

    const revenue = totalRevenue[0]?.total || 0;
    const expenses = totalExpenses[0]?.total || 0;
    const prevRevenue = prevYearRevenue[0]?.total || 0;
    const prevExpenses = prevYearExpenses[0]?.total || 0;

    const revenuePerArtist = totalArtists > 0 ? revenue / totalArtists : 0;
    const revenuePerRelease = totalReleases > 0 ? revenue / totalReleases : 0;
    const costPerSong = totalSongs > 0 ? expenses / totalSongs : 0;
    const avgContractValue = totalContracts[0]?.avg || 0;
    const taskCompletionRate = totalTasks > 0 ? ((completedTasks / totalTasks) * 100).toFixed(1) : 0;

    const campaignSpend = campaignData[0]?.totalSpent || 0;
    const campaignROI = campaignSpend > 0 ? ((revenue / campaignSpend) * 100).toFixed(1) : 0;

    const prevRevenuePerArtist = prevRevenue > 0 && totalArtists > 0 ? prevRevenue / totalArtists : 0;
    const prevCostPerSong = prevExpenses > 0 && totalSongs > 0 ? prevExpenses / totalSongs : 0;
    const prevAvgContract = prevRevenue > 0 ? avgContractValue : 0;

    const kpis = [
      {
        name: 'Revenue Per Artist',
        value: revenuePerArtist,
        previousValue: prevRevenuePerArtist,
        format: 'currency',
      },
      {
        name: 'Revenue Per Release',
        value: revenuePerRelease,
        previousValue: 0,
        format: 'currency',
      },
      {
        name: 'Cost Per Song',
        value: costPerSong,
        previousValue: prevCostPerSong,
        format: 'currency',
        invertTrend: true,
      },
      {
        name: 'Avg Contract Value',
        value: avgContractValue,
        previousValue: prevAvgContract,
        format: 'currency',
      },
      {
        name: 'Task Completion Rate',
        value: parseFloat(taskCompletionRate),
        previousValue: 0,
        format: 'percent',
      },
      {
        name: 'Campaign ROI',
        value: parseFloat(campaignROI),
        previousValue: 0,
        format: 'percent',
      },
    ];

    const enriched = kpis.map(k => {
      const change = k.previousValue > 0
        ? ((k.value - k.previousValue) / k.previousValue * 100).toFixed(1)
        : 0;
      return { ...k, change: parseFloat(change) };
    });

    res.json({
      success: true,
      data: { kpis: enriched },
    });
  } catch (error) {
    console.error('KPI analytics error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch KPI data' });
  }
};

// ─── System 14: Executive Dashboard ───────────────────────────────────────────

exports.getExecutiveDashboard = async (req, res) => {
  try {
    const now = new Date();
    const currentYear = now.getFullYear();
    const previousYear = currentYear - 1;
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const [
      totalRevenueAllTime,
      totalExpensesAllTime,
      currentYearRevenue,
      currentYearExpenses,
      previousYearRevenue,
      previousYearExpenses,
      activeArtists,
      activeReleases,
      upcomingReleases,
      contractStatusSummary,
      overdueTasks,
      outstandingRoyaltyBalances,
      campaignPerformance,
      totalStreamsResult,
      recentRevenueByMonth,
      topRevenueSources,
    ] = await Promise.all([
      Finance.aggregate([
        { $match: { type: 'income' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Finance.aggregate([
        { $match: { type: 'expense' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Finance.aggregate([
        { $match: { year: currentYear, type: 'income' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Finance.aggregate([
        { $match: { year: currentYear, type: 'expense' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Finance.aggregate([
        { $match: { year: previousYear, type: 'income' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Finance.aggregate([
        { $match: { year: previousYear, type: 'expense' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Artist.countDocuments({ status: 'active' }),
      Release.countDocuments({ status: { $in: ['released', 'submitted', 'approved', 'in_preparation'] } }),
      Release.countDocuments({ releaseDate: { $gte: now }, status: { $nin: ['cancelled', 'released'] } }),
      Contract.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 }, totalValue: { $sum: '$value' } } },
      ]),
      Task.countDocuments({ status: { $nin: ['completed'] }, deadline: { $lt: now } }),
      RoyaltyLedger.aggregate([
        { $match: { status: { $in: ['calculated', 'approved'] }, remainingBalance: { $gt: 0 } } },
        {
          $lookup: { from: 'artists', localField: 'artist', foreignField: '_id', as: 'artistData' },
        },
        { $unwind: { path: '$artistData', preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: '$artist',
            artistName: { $first: { $ifNull: ['$artistData.artistName', '$artistData.stageName', 'Unknown'] } },
            totalOwed: { $sum: '$remainingBalance' },
            entryCount: { $sum: 1 },
          },
        },
        { $sort: { totalOwed: -1 } },
      ]),
      Campaign.aggregate([
        { $match: { status: { $in: ['active', 'completed'] } } },
        {
          $group: {
            _id: null,
            totalBudget: { $sum: '$budget' },
            totalSpent: { $sum: '$spent' },
            totalReach: { $sum: '$reach' },
            totalImpressions: { $sum: '$impressions' },
            totalClicks: { $sum: '$clicks' },
            totalConversions: { $sum: '$conversions' },
            totalRevenue: { $sum: '$attributedRevenue' },
            campaignCount: { $sum: 1 },
            avgROI: { $avg: '$roi' },
          },
        },
      ]),
      Artist.aggregate([
        { $group: { _id: null, total: { $sum: '$totalStreams' } } },
      ]),
      Finance.aggregate([
        { $match: { type: 'income', year: currentYear } },
        { $group: { _id: { month: '$month' }, total: { $sum: '$amount' } } },
        { $sort: { '_id.month': 1 } },
      ]),
      Finance.aggregate([
        { $match: { type: 'income', year: currentYear } },
        { $group: { _id: '$category', total: { $sum: '$amount' } } },
        { $sort: { total: -1 } },
        { $limit: 5 },
      ]),
    ]);

    const totalRevenue = totalRevenueAllTime[0]?.total || 0;
    const totalExpenses = totalExpensesAllTime[0]?.total || 0;
    const revenueYTD = currentYearRevenue[0]?.total || 0;
    const expensesYTD = currentYearExpenses[0]?.total || 0;
    const revenuePrevYear = previousYearRevenue[0]?.total || 0;
    const expensesPrevYear = previousYearExpenses[0]?.total || 0;
    const netProfitYTD = revenueYTD - expensesYTD;
    const netProfitAllTime = totalRevenue - totalExpenses;
    const revenueGrowth = revenuePrevYear > 0
      ? ((revenueYTD - revenuePrevYear) / revenuePrevYear * 100)
      : revenueYTD > 0 ? 100 : 0;

    const contractMap = {};
    contractStatusSummary.forEach(c => {
      contractMap[c._id] = { count: c.count, totalValue: c.totalValue };
    });

    const totalOutstandingRoyalties = outstandingRoyaltyBalances.reduce((sum, b) => sum + b.totalOwed, 0);

    const campaign = campaignPerformance[0] || {};
    const campaignROI = campaign.totalSpent > 0
      ? (((campaign.totalRevenue || 0) - campaign.totalSpent) / campaign.totalSpent * 100)
      : 0;

    const topSources = topRevenueSources.map(s => ({
      name: s._id.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      value: s.total,
    }));

    res.json({
      success: true,
      data: {
        revenue: {
          allTime: totalRevenue,
          ytd: revenueYTD,
          previousYear: revenuePrevYear,
          growth: parseFloat(revenueGrowth.toFixed(1)),
          netProfitYTD,
          netProfitAllTime,
          profitMarginYTD: revenueYTD > 0 ? parseFloat((netProfitYTD / revenueYTD * 100).toFixed(1)) : 0,
        },
        expenses: {
          allTime: totalExpenses,
          ytd: expensesYTD,
          previousYear: expensesPrevYear,
        },
        artists: {
          active: activeArtists,
          totalStreams: totalStreamsResult[0]?.total || 0,
        },
        releases: {
          active: activeReleases,
          upcoming: upcomingReleases,
        },
        contracts: {
          summary: contractMap,
          totalActive: contractMap.active?.count || 0,
          totalExpiring: contractMap.active?.count || 0,
        },
        tasks: {
          overdue: overdueTasks,
        },
        royalties: {
          totalOutstanding: totalOutstandingRoyalties,
          byArtist: outstandingRoyaltyBalances,
        },
        campaigns: {
          count: campaign.campaignCount || 0,
          totalBudget: campaign.totalBudget || 0,
          totalSpent: campaign.totalSpent || 0,
          totalReach: campaign.totalReach || 0,
          totalConversions: campaign.totalConversions || 0,
          totalRevenue: campaign.totalRevenue || 0,
          avgROI: parseFloat((campaign.avgROI || 0).toFixed(1)),
          roi: parseFloat(campaignROI.toFixed(1)),
        },
        monthlyRevenue: recentRevenueByMonth.map(m => ({ month: m._id.month, total: m.total })),
        topRevenueSources: topSources,
      },
    });
  } catch (error) {
    console.error('Executive dashboard error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch executive dashboard' });
  }
};

// ─── System 14: Artist Performance Detail ─────────────────────────────────────

exports.getArtistPerformanceDetail = async (req, res) => {
  try {
    const { artistId, startDate, endDate, period } = req.query;
    const now = new Date();
    const currentYear = now.getFullYear();

    let dateFilter = {};
    if (startDate && endDate) {
      dateFilter = { date: { $gte: new Date(startDate), $lte: new Date(endDate) } };
    } else if (period === 'month') {
      dateFilter = { year: currentYear, month: now.getMonth() + 1 };
    } else if (period === 'quarter') {
      dateFilter = { year: currentYear, quarter: Math.ceil((now.getMonth() + 1) / 3) };
    } else if (period === 'year') {
      dateFilter = { year: currentYear };
    }

    const artistMatch = artistId ? { artist: new mongoose.Types.ObjectId(artistId) } : {};

    const [artistRevenue, artistStreams, artistReleases, artistCampaigns, royaltyBalances, recoupmentData, audienceGrowth] = await Promise.all([
      Finance.aggregate([
        { $match: { type: 'income', ...dateFilter, ...artistMatch, artist: { $ne: null } } },
        {
          $lookup: { from: 'artists', localField: 'artist', foreignField: '_id', as: 'artistData' },
        },
        { $unwind: { path: '$artistData', preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: '$artist',
            name: { $first: { $ifNull: ['$artistData.artistName', '$artistData.stageName', 'Unknown'] } },
            totalRevenue: { $sum: '$amount' },
            transactionCount: { $sum: 1 },
          },
        },
        { $sort: { totalRevenue: -1 } },
      ]),
      PerSongAnalytics.aggregate([
        { $match: { ...artistMatch } },
        {
          $lookup: { from: 'artists', localField: 'artist', foreignField: '_id', as: 'artistData' },
        },
        { $unwind: { path: '$artistData', preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: '$artist',
            name: { $first: { $ifNull: ['$artistData.artistName', '$artistData.stageName', 'Unknown'] } },
            totalStreams: { $sum: '$totalStreams' },
            totalListeners: { $sum: '$monthlyListeners' },
            totalSaves: { $sum: '$saves' },
            totalPlaylistAdds: { $sum: '$playlistAdditions' },
            totalRevenue: { $sum: '$revenue' },
            periodsTracked: { $sum: 1 },
          },
        },
        { $sort: { totalStreams: -1 } },
      ]),
      Release.aggregate([
        { $match: { ...artistMatch } },
        {
          $lookup: { from: 'artists', localField: 'artist', foreignField: '_id', as: 'artistData' },
        },
        { $unwind: { path: '$artistData', preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: '$artist',
            name: { $first: { $ifNull: ['$artistData.artistName', '$artistData.stageName', 'Unknown'] } },
            totalReleases: { $sum: 1 },
            released: {
              $sum: { $cond: [{ $eq: ['$status', 'released'] }, 1, 0] },
            },
            inPrep: {
              $sum: { $cond: [{ $eq: ['$status', 'in_preparation'] }, 1, 0] },
            },
          },
        },
      ]),
      Campaign.aggregate([
        { $match: { ...artistMatch, artist: { $ne: null } } },
        {
          $lookup: { from: 'artists', localField: 'artist', foreignField: '_id', as: 'artistData' },
        },
        { $unwind: { path: '$artistData', preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: '$artist',
            name: { $first: { $ifNull: ['$artistData.artistName', '$artistData.stageName', 'Unknown'] } },
            totalBudget: { $sum: '$budget' },
            totalSpent: { $sum: '$spent' },
            totalReach: { $sum: '$reach' },
            totalConversions: { $sum: '$conversions' },
            totalRevenue: { $sum: '$attributedRevenue' },
            campaignCount: { $sum: 1 },
            avgROI: { $avg: '$roi' },
          },
        },
      ]),
      RoyaltyLedger.aggregate([
        { $match: { ...artistMatch, remainingBalance: { $gt: 0 } } },
        {
          $lookup: { from: 'artists', localField: 'artist', foreignField: '_id', as: 'artistData' },
        },
        { $unwind: { path: '$artistData', preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: '$artist',
            name: { $first: { $ifNull: ['$artistData.artistName', '$artistData.stageName', 'Unknown'] } },
            totalOwed: { $sum: '$remainingBalance' },
            totalPaid: { $sum: '$totalPaid' },
            totalGross: { $sum: '$grossIncome' },
            entryCount: { $sum: 1 },
          },
        },
        { $sort: { totalOwed: -1 } },
      ]),
      RoyaltyLedger.aggregate([
        { $match: { ...artistMatch } },
        {
          $group: {
            _id: '$artist',
            totalRecoupable: { $sum: '$recoupableExpenses' },
            totalRecouped: { $sum: '$totalRecouped' },
          },
        },
        {
          $addFields: {
            remainingRecoupable: { $subtract: ['$totalRecoupable', '$totalRecouped'] },
            recoupmentProgress: {
              $cond: [
                { $gt: ['$totalRecoupable', 0] },
                { $round: [{ $multiply: [{ $divide: ['$totalRecouped', '$totalRecoupable'] }, 100] }, 1] },
                0,
              ],
            },
          },
        },
      ]),
      PerSongAnalytics.aggregate([
        { $match: { ...artistMatch, period: { $ne: '' } } },
        {
          $group: {
            _id: { artist: '$artist', period: '$period' },
            totalStreams: { $sum: '$totalStreams' },
            totalListeners: { $sum: '$monthlyListeners' },
          },
        },
        { $sort: { '_id.period': 1 } },
        {
          $group: {
            _id: '$_id.artist',
            periods: { $push: { period: '$_id.period', streams: '$totalStreams', listeners: '$totalListeners' } },
          },
        },
      ]),
    ]);

    const revenueMap = {};
    artistRevenue.forEach(a => { revenueMap[a._id] = a; });
    const streamsMap = {};
    artistStreams.forEach(a => { streamsMap[a._id] = a; });
    const releasesMap = {};
    artistReleases.forEach(a => { releasesMap[a._id] = a; });
    const campaignsMap = {};
    artistCampaigns.forEach(a => { campaignsMap[a._id] = a; });
    const royaltyMap = {};
    royaltyBalances.forEach(a => { royaltyMap[a._id] = a; });
    const recoupMap = {};
    recoupmentData.forEach(a => { recoupMap[a._id] = a; });
    const growthMap = {};
    audienceGrowth.forEach(a => { growthMap[a._id] = a.periods; });

    const allArtistIds = new Set([
      ...artistRevenue.map(a => String(a._id)),
      ...artistStreams.map(a => String(a._id)),
      ...artistReleases.map(a => String(a._id)),
      ...royaltyBalances.map(a => String(a._id)),
    ]);

    const artists = Array.from(allArtistIds).map(id => {
      const rev = revenueMap[id] || {};
      const str = streamsMap[id] || {};
      const rel = releasesMap[id] || {};
      const cmp = campaignsMap[id] || {};
      const roy = royaltyMap[id] || {};
      const rec = recoupMap[id] || {};
      const growth = growthMap[id] || [];
      return {
        _id: id,
        name: rev.name || str.name || rel.name || roy.name || 'Unknown',
        revenue: rev.totalRevenue || 0,
        streams: str.totalStreams || 0,
        listeners: str.totalListeners || 0,
        saves: str.totalSaves || 0,
        playlistAdds: str.totalPlaylistAdds || 0,
        streamingRevenue: str.totalRevenue || 0,
        releases: rel.totalReleases || 0,
        releasedReleases: rel.released || 0,
        campaigns: cmp.campaignCount || 0,
        campaignSpent: cmp.totalSpent || 0,
        campaignRevenue: cmp.totalRevenue || 0,
        campaignROI: cmp.avgROI || 0,
        royaltyOwed: roy.totalOwed || 0,
        royaltyPaid: roy.totalPaid || 0,
        royaltyGross: roy.totalGross || 0,
        recoupableExpenses: rec.totalRecoupable || 0,
        recoupedAmount: rec.totalRecouped || 0,
        recoupmentProgress: rec.recoupmentProgress || 0,
        audienceGrowthTrend: growth,
      };
    });

    artists.sort((a, b) => b.revenue - a.revenue);

    res.json({
      success: true,
      data: {
        artists,
        totals: {
          revenue: artists.reduce((s, a) => s + a.revenue, 0),
          streams: artists.reduce((s, a) => s + a.streams, 0),
          royaltyOwed: artists.reduce((s, a) => s + a.royaltyOwed, 0),
          royaltyPaid: artists.reduce((s, a) => s + a.royaltyPaid, 0),
        },
      },
    });
  } catch (error) {
    console.error('Artist performance detail error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch artist performance detail' });
  }
};

// ─── System 14: Release Performance Detail ────────────────────────────────────

exports.getReleasePerformanceDetail = async (req, res) => {
  try {
    const { releaseId, artistId, startDate, endDate, period } = req.query;
    const now = new Date();
    const currentYear = now.getFullYear();

    let dateFilter = {};
    if (startDate && endDate) {
      dateFilter = { periodStart: { $gte: new Date(startDate) }, periodEnd: { $lte: new Date(endDate) } };
    }

    const songMatch = {};
    if (artistId) songMatch.artist = new mongoose.Types.ObjectId(artistId);

    const [releaseRevenue, platformRevenue, sourceRevenue, songPerformance, releaseComparisons] = await Promise.all([
      PerSongAnalytics.aggregate([
        { $match: { ...dateFilter } },
        {
          $lookup: { from: 'releases', localField: 'release', foreignField: '_id', as: 'releaseData' },
        },
        { $unwind: { path: '$releaseData', preserveNullAndEmptyArrays: true } },
        {
          $lookup: { from: 'artists', localField: 'artist', foreignField: '_id', as: 'artistData' },
        },
        { $unwind: { path: '$artistData', preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: { release: '$release', song: '$song' },
            releaseTitle: { $first: { $ifNull: ['$releaseData.title', 'Unknown Release'] } },
            artistName: { $first: { $ifNull: ['$artistData.artistName', '$artistData.stageName', 'Unknown'] } },
            totalStreams: { $sum: '$totalStreams' },
            totalRevenue: { $sum: '$revenue' },
            totalSaves: { $sum: '$saves' },
            totalPlaylistAdds: { $sum: '$playlistAdditions' },
            totalListeners: { $sum: '$monthlyListeners' },
            periodsTracked: { $sum: 1 },
          },
        },
        { $sort: { totalStreams: -1 } },
      ]),
      PerSongAnalytics.aggregate([
        { $match: { ...dateFilter } },
        { $unwind: '$platforms' },
        {
          $group: {
            _id: '$platforms.name',
            totalStreams: { $sum: '$platforms.streams' },
            totalRevenue: { $sum: '$platforms.revenue' },
            totalListeners: { $sum: '$platforms.listeners' },
            totalSaves: { $sum: '$platforms.saves' },
            totalPlaylistAdds: { $sum: '$platforms.playlistAdds' },
          },
        },
        { $sort: { totalStreams: -1 } },
      ]),
      Finance.aggregate([
        { $match: { type: 'income', ...dateFilter } },
        { $group: { _id: '$category', total: { $sum: '$amount' } } },
        { $sort: { total: -1 } },
      ]),
      Song.aggregate([
        { $match: songMatch },
        {
          $lookup: { from: 'artists', localField: 'artist', foreignField: '_id', as: 'artistData' },
        },
        { $unwind: { path: '$artistData', preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: '$artist',
            artistName: { $first: { $ifNull: ['$artistData.artistName', '$artistData.stageName', 'Unknown'] } },
            songs: {
              $push: {
                _id: '$_id',
                title: '$title',
                streams: '$streams',
                revenue: '$revenue',
                status: '$status',
              },
            },
            totalStreams: { $sum: '$streams' },
            totalRevenue: { $sum: '$revenue' },
          },
        },
        { $sort: { totalStreams: -1 } },
      ]),
      Release.aggregate([
        { $match: { status: 'released' } },
        {
          $lookup: { from: 'artists', localField: 'artist', foreignField: '_id', as: 'artistData' },
        },
        { $unwind: { path: '$artistData', preserveNullAndEmptyArrays: true } },
        {
          $lookup: { from: 'songs', localField: 'songs', foreignField: '_id', as: 'songData' },
        },
        {
          $addFields: {
            songCount: { $size: '$songs' },
            totalStreams: { $sum: '$songData.streams' },
            totalRevenue: { $sum: '$songData.revenue' },
          },
        },
        {
          $project: {
            title: 1,
            artistName: { $ifNull: ['$artistData.artistName', '$artistData.stageName', 'Unknown'] },
            type: 1,
            releaseDate: 1,
            songCount: 1,
            totalStreams: 1,
            totalRevenue: 1,
          },
        },
        { $sort: { totalStreams: -1 } },
      ]),
    ]);

    const releaseMap = {};
    releaseRevenue.forEach(r => {
      const rid = String(r._id.release);
      if (!releaseMap[rid]) {
        releaseMap[rid] = {
          _id: rid,
          title: r.releaseTitle,
          artistName: r.artistName,
          totalStreams: 0,
          totalRevenue: 0,
          totalSaves: 0,
          totalPlaylistAdds: 0,
          totalListeners: 0,
          songsCount: 0,
          periodsTracked: 0,
        };
      }
      releaseMap[rid].totalStreams += r.totalStreams;
      releaseMap[rid].totalRevenue += r.totalRevenue;
      releaseMap[rid].totalSaves += r.totalSaves;
      releaseMap[rid].totalPlaylistAdds += r.totalPlaylistAdds;
      releaseMap[rid].totalListeners += r.totalListeners;
      releaseMap[rid].songsCount += 1;
      releaseMap[rid].periodsTracked = Math.max(releaseMap[rid].periodsTracked, r.periodsTracked);
    });

    const releaseList = Object.values(releaseMap).sort((a, b) => b.totalStreams - a.totalStreams);

    const topPerformers = releaseList.slice(0, 5);
    const underperformers = releaseList.slice(-5).reverse();

    res.json({
      success: true,
      data: {
        releasePerformance: releaseList,
        platformBreakdown: platformRevenue.map(p => ({
          name: p._id,
          streams: p.totalStreams,
          revenue: p.totalRevenue,
          listeners: p.totalListeners,
          saves: p.totalSaves,
          playlistAdds: p.totalPlaylistAdds,
        })),
        sourceBreakdown: sourceRevenue.map(s => ({
          name: s._id.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          value: s.total,
        })),
        songPerformance,
        topPerformers,
        underperformers,
        totals: {
          totalStreams: releaseList.reduce((s, r) => s + r.totalStreams, 0),
          totalRevenue: releaseList.reduce((s, r) => s + r.totalRevenue, 0),
          releaseCount: releaseList.length,
        },
      },
    });
  } catch (error) {
    console.error('Release performance detail error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch release performance detail' });
  }
};

// ─── System 14: Financial Analytics Detail ────────────────────────────────────

exports.getFinancialAnalytics = async (req, res) => {
  try {
    const now = new Date();
    const currentYear = parseInt(req.query.year) || now.getFullYear();
    const previousYear = currentYear - 1;

    const [
      monthlyFinances,
      prevYearFinances,
      budgetData,
      outstandingPayments,
      royaltyLiabilities,
      recoupableBalances,
      expenseByCategory,
      incomeByCategory,
    ] = await Promise.all([
      Finance.aggregate([
        { $match: { year: currentYear } },
        {
          $group: {
            _id: { month: '$month', type: '$type' },
            total: { $sum: '$amount' },
          },
        },
      ]),
      Finance.aggregate([
        { $match: { year: previousYear } },
        {
          $group: {
            _id: { month: '$month', type: '$type' },
            total: { $sum: '$amount' },
          },
        },
      ]),
      Budget.aggregate([
        { $match: { year: currentYear, status: { $in: ['active', 'approved'] } } },
        {
          $unwind: '$items',
        },
        {
          $group: {
            _id: '$items.category',
            budgeted: { $sum: '$items.budgeted' },
            spent: { $sum: '$items.spent' },
          },
        },
        { $sort: { budgeted: -1 } },
      ]),
      Finance.aggregate([
        { $match: { type: 'expense', paymentStatus: { $in: ['pending', 'overdue', 'partial'] } } },
        {
          $group: {
            _id: '$paymentStatus',
            count: { $sum: 1 },
            total: { $sum: '$amount' },
          },
        },
      ]),
      RoyaltyLedger.aggregate([
        { $match: { status: { $in: ['calculated', 'approved'] } } },
        {
          $group: {
            _id: null,
            totalGrossIncome: { $sum: '$grossIncome' },
            totalArtistShare: { $sum: '$artistShare' },
            totalLabelShare: { $sum: '$labelShare' },
            totalPaid: { $sum: '$totalPaid' },
            totalRemaining: { $sum: '$remainingBalance' },
          },
        },
      ]),
      RoyaltyLedger.aggregate([
        { $match: { recoupableExpenses: { $gt: 0 } } },
        {
          $group: {
            _id: null,
            totalRecoupable: { $sum: '$recoupableExpenses' },
            totalRecouped: { $sum: '$totalRecouped' },
          },
        },
      ]),
      Finance.aggregate([
        { $match: { type: 'expense', year: currentYear } },
        { $group: { _id: '$category', total: { $sum: '$amount' } } },
        { $sort: { total: -1 } },
      ]),
      Finance.aggregate([
        { $match: { type: 'income', year: currentYear } },
        { $group: { _id: '$category', total: { $sum: '$amount' } } },
        { $sort: { total: -1 } },
      ]),
    ]);

    const monthlyData = MONTHS.map((name, i) => {
      const month = i + 1;
      const rev = monthlyFinances.find(m => m._id.month === month && m._id.type === 'income')?.total || 0;
      const exp = monthlyFinances.find(m => m._id.month === month && m._id.type === 'expense')?.total || 0;
      const prevRev = prevYearFinances.find(m => m._id.month === month && m._id.type === 'income')?.total || 0;
      const prevExp = prevYearFinances.find(m => m._id.month === month && m._id.type === 'expense')?.total || 0;
      return {
        name,
        revenue: rev,
        expenses: exp,
        profit: rev - exp,
        prevRevenue: prevRev,
        prevExpenses: prevExp,
        profitMargin: rev > 0 ? parseFloat(((rev - exp) / rev * 100).toFixed(1)) : 0,
      };
    });

    const totalRevenue = monthlyData.reduce((s, m) => s + m.revenue, 0);
    const totalExpenses = monthlyData.reduce((s, m) => s + m.expenses, 0);
    const totalProfit = totalRevenue - totalExpenses;
    const avgProfitMargin = totalRevenue > 0 ? parseFloat((totalProfit / totalRevenue * 100).toFixed(1)) : 0;

    const quarterlyData = [1, 2, 3, 4].map(q => {
      const months = [(q - 1) * 3, (q - 1) * 3 + 1, (q - 1) * 3 + 2];
      const rev = months.reduce((s, m) => s + (monthlyData[m]?.revenue || 0), 0);
      const exp = months.reduce((s, m) => s + (monthlyData[m]?.expenses || 0), 0);
      return { name: `Q${q}`, revenue: rev, expenses: exp, profit: rev - exp, margin: rev > 0 ? parseFloat(((rev - exp) / rev * 100).toFixed(1)) : 0 };
    });

    const royalty = royaltyLiabilities[0] || {};
    const recoupable = recoupableBalances[0] || {};

    const paymentStatusMap = {};
    outstandingPayments.forEach(p => {
      paymentStatusMap[p._id] = { count: p.count, total: p.total };
    });

    const budgetComparison = budgetData.map(b => ({
      category: b._id,
      budgeted: b.budgeted,
      spent: b.spent,
      remaining: b.budgeted - b.spent,
      utilization: b.budgeted > 0 ? parseFloat((b.spent / b.budgeted * 100).toFixed(1)) : 0,
    }));

    res.json({
      success: true,
      data: {
        summary: {
          totalRevenue,
          totalExpenses,
          totalProfit,
          avgProfitMargin,
        },
        monthly: monthlyData,
        quarterly: quarterlyData,
        budgetComparison,
        outstandingPayments: {
          pending: paymentStatusMap.pending || { count: 0, total: 0 },
          overdue: paymentStatusMap.overdue || { count: 0, total: 0 },
          partial: paymentStatusMap.partial || { count: 0, total: 0 },
          totalOutstanding: Object.values(paymentStatusMap).reduce((s, p) => s + p.total, 0),
        },
        royaltyLiabilities: {
          grossIncome: royalty.totalGrossIncome || 0,
          artistShare: royalty.totalArtistShare || 0,
          labelShare: royalty.totalLabelShare || 0,
          totalPaid: royalty.totalPaid || 0,
          totalRemaining: royalty.totalRemaining || 0,
        },
        recoupable: {
          totalRecoupable: recoupable.totalRecoupable || 0,
          totalRecouped: recoupable.totalRecouped || 0,
          remaining: (recoupable.totalRecoupable || 0) - (recoupable.totalRecouped || 0),
          progress: recoupable.totalRecoupable > 0
            ? parseFloat((recoupable.totalRecouped / recoupable.totalRecoupable * 100).toFixed(1))
            : 0,
        },
        expenseBreakdown: expenseByCategory.map(e => ({
          name: e._id.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          value: e.total,
        })),
        incomeBreakdown: incomeByCategory.map(i => ({
          name: i._id.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          value: i.total,
        })),
      },
    });
  } catch (error) {
    console.error('Financial analytics error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch financial analytics' });
  }
};

// ─── System 14: Marketing Analytics Detail ────────────────────────────────────

exports.getMarketingAnalytics = async (req, res) => {
  try {
    const { campaignId, artistId, startDate, endDate, type } = req.query;
    const matchFilter = {};
    if (campaignId) matchFilter._id = new mongoose.Types.ObjectId(campaignId);
    if (artistId) matchFilter.artist = new mongoose.Types.ObjectId(artistId);
    if (type) matchFilter.type = type;
    if (startDate && endDate) {
      matchFilter.startDate = { $gte: new Date(startDate) };
      matchFilter.endDate = { $lte: new Date(endDate) };
    }

    const [campaignDetails, platformPerformance, campaignTypeBreakdown, socialGrowth, playlistPerformance, overallStats] = await Promise.all([
      Campaign.aggregate([
        { $match: matchFilter },
        {
          $lookup: { from: 'artists', localField: 'artist', foreignField: '_id', as: 'artistData' },
        },
        { $unwind: { path: '$artistData', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            name: 1,
            type: 1,
            status: 1,
            startDate: 1,
            endDate: 1,
            budget: 1,
            spent: 1,
            reach: 1,
            impressions: 1,
            clicks: 1,
            conversions: 1,
            attributedRevenue: 1,
            profit: 1,
            roi: 1,
            costPerClick: 1,
            costPerConversion: 1,
            progress: 1,
            artistName: { $ifNull: ['$artistData.artistName', '$artistData.stageName', 'Unknown'] },
            contentItemCount: { $size: { $ifNull: ['$contentItems', []] } },
            publishedCount: {
              $size: {
                $filter: {
                  input: { $ifNull: ['$contentItems', []] },
                  cond: { $eq: ['$$this.status', 'published'] },
                },
              },
            },
          },
        },
        { $sort: { startDate: -1 } },
      ]),
      Campaign.aggregate([
        { $match: matchFilter },
        { $unwind: '$contentItems' },
        {
          $group: {
            _id: '$contentItems.platform',
            impressions: { $sum: '$contentItems.impressions' },
            clicks: { $sum: '$contentItems.clicks' },
            likes: { $sum: '$contentItems.likes' },
            shares: { $sum: '$contentItems.shares' },
            comments: { $sum: '$contentItems.comments' },
            conversions: { $sum: '$contentItems.conversions' },
            itemCount: { $sum: 1 },
          },
        },
        { $sort: { impressions: -1 } },
      ]),
      Campaign.aggregate([
        { $match: matchFilter },
        {
          $group: {
            _id: '$type',
            count: { $sum: 1 },
            totalBudget: { $sum: '$budget' },
            totalSpent: { $sum: '$spent' },
            totalReach: { $sum: '$reach' },
            totalConversions: { $sum: '$conversions' },
            totalRevenue: { $sum: '$attributedRevenue' },
            avgROI: { $avg: '$roi' },
          },
        },
        { $sort: { totalSpent: -1 } },
      ]),
      PerSongAnalytics.aggregate([
        { $match: { ...dateFilterFromQuery(req.query) } },
        {
          $group: {
            _id: '$period',
            totalStreams: { $sum: '$totalStreams' },
            totalListeners: { $sum: '$monthlyListeners' },
            totalSaves: { $sum: '$saves' },
            playlistAdditions: { $sum: '$playlistAdditions' },
            videoViews: { $sum: '$videoViews' },
          },
        },
        { $sort: { '_id': 1 } },
      ]),
      PerSongAnalytics.aggregate([
        { $match: { ...dateFilterFromQuery(req.query) } },
        { $unwind: '$platforms' },
        {
          $group: {
            _id: '$platforms.name',
            totalStreams: { $sum: '$platforms.streams' },
            totalPlaylistAdds: { $sum: '$platforms.playlistAdds' },
          },
        },
        { $sort: { totalPlaylistAdds: -1 } },
      ]),
      Campaign.aggregate([
        { $match: matchFilter },
        {
          $group: {
            _id: null,
            totalBudget: { $sum: '$budget' },
            totalSpent: { $sum: '$spent' },
            totalReach: { $sum: '$reach' },
            totalImpressions: { $sum: '$impressions' },
            totalClicks: { $sum: '$clicks' },
            totalConversions: { $sum: '$conversions' },
            totalRevenue: { $sum: '$attributedRevenue' },
            totalProfit: { $sum: '$profit' },
            campaignCount: { $sum: 1 },
            avgROI: { $avg: '$roi' },
          },
        },
      ]),
    ]);

    const overall = overallStats[0] || {};
    const totalSpent = overall.totalSpent || 0;
    const totalRevenue = overall.totalRevenue || 0;

    const enrichedCampaigns = campaignDetails.map(c => ({
      ...c,
      conversionRate: c.clicks > 0 ? parseFloat((c.conversions / c.clicks * 100).toFixed(2)) : 0,
      costPerResult: c.conversions > 0 ? parseFloat((c.spent / c.conversions).toFixed(2)) : 0,
    }));

    const typeBreakdown = campaignTypeBreakdown.map(t => ({
      type: t._id,
      count: t.count,
      budget: t.totalBudget,
      spent: t.totalSpent,
      reach: t.totalReach,
      conversions: t.totalConversions,
      revenue: t.totalRevenue,
      roi: parseFloat((t.avgROI || 0).toFixed(1)),
      costPerResult: t.totalConversions > 0 ? parseFloat((t.totalSpent / t.totalConversions).toFixed(2)) : 0,
    }));

    res.json({
      success: true,
      data: {
        overview: {
          totalBudget: overall.totalBudget || 0,
          totalSpent,
          totalReach: overall.totalReach || 0,
          totalImpressions: overall.totalImpressions || 0,
          totalClicks: overall.totalClicks || 0,
          totalConversions: overall.totalConversions || 0,
          totalRevenue,
          totalProfit: overall.totalProfit || 0,
          campaignCount: overall.campaignCount || 0,
          avgROI: parseFloat((overall.avgROI || 0).toFixed(1)),
          overallROI: totalSpent > 0 ? parseFloat(((totalRevenue - totalSpent) / totalSpent * 100).toFixed(1)) : 0,
          conversionRate: overall.totalClicks > 0 ? parseFloat((overall.totalConversions / overall.totalClicks * 100).toFixed(2)) : 0,
          costPerResult: overall.totalConversions > 0 ? parseFloat((totalSpent / overall.totalConversions).toFixed(2)) : 0,
        },
        campaigns: enrichedCampaigns,
        platformPerformance: platformPerformance.map(p => ({
          platform: p._id,
          impressions: p.impressions,
          clicks: p.clicks,
          likes: p.likes,
          shares: p.shares,
          comments: p.comments,
          conversions: p.conversions,
          itemCount: p.itemCount,
          engagement: p.likes + p.shares + p.comments,
          ctr: p.impressions > 0 ? parseFloat((p.clicks / p.impressions * 100).toFixed(2)) : 0,
        })),
        typeBreakdown,
        socialGrowth: socialGrowth.map(s => ({
          period: s._id,
          streams: s.totalStreams,
          listeners: s.totalListeners,
          saves: s.totalSaves,
          playlistAdds: s.playlistAdditions,
          videoViews: s.videoViews,
        })),
        playlistPerformance: playlistPerformance.map(p => ({
          platform: p._id,
          streams: p.totalStreams,
          playlistAdds: p.totalPlaylistAdds,
        })),
      },
    });
  } catch (error) {
    console.error('Marketing analytics error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch marketing analytics' });
  }
};

// ─── System 14: Export Report ─────────────────────────────────────────────────

exports.exportReport = async (req, res) => {
  try {
    const { type, startDate, endDate, artistId, releaseId } = req.query;
    const now = new Date();
    const currentYear = now.getFullYear();

    let rows = [];
    let headers = [];
    let filename = `analytics-report-${now.toISOString().split('T')[0]}.csv`;

    if (type === 'revenue') {
      headers = ['Month', 'Year', 'Type', 'Category', 'Amount', 'Artist', 'Description', 'Payment Status'];
      const match = { year: currentYear };
      if (startDate && endDate) {
        match.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
      }
      if (artistId) match.artist = new mongoose.Types.ObjectId(artistId);
      const data = await Finance.find(match)
        .populate('artist', 'artistName stageName')
        .sort({ date: -1 })
        .lean();
      rows = data.map(d => [
        d.month, d.year, d.type, d.category, d.amount,
        d.artist?.artistName || d.artist?.stageName || '',
        d.description, d.paymentStatus,
      ]);
      filename = `revenue-report-${now.toISOString().split('T')[0]}.csv`;
    } else if (type === 'artists') {
      headers = ['Artist', 'Status', 'Total Streams', 'Total Revenue', 'Genre'];
      const match = {};
      if (artistId) match._id = new mongoose.Types.ObjectId(artistId);
      const data = await Artist.find(match).sort({ totalRevenue: -1 }).lean();
      rows = data.map(d => [
        d.artistName || d.stageName || d.name || 'Unknown',
        d.status, d.totalStreams || 0, d.totalRevenue || 0, d.genre || '',
      ]);
      filename = `artist-report-${now.toISOString().split('T')[0]}.csv`;
    } else if (type === 'campaigns') {
      headers = ['Campaign', 'Type', 'Status', 'Budget', 'Spent', 'Reach', 'Conversions', 'Revenue', 'ROI'];
      const match = {};
      if (artistId) match.artist = new mongoose.Types.ObjectId(artistId);
      const data = await Campaign.find(match).sort({ startDate: -1 }).lean();
      rows = data.map(d => [
        d.name, d.type, d.status, d.budget, d.spent, d.reach,
        d.conversions, d.attributedRevenue,
        d.spent > 0 ? (((d.attributedRevenue - d.spent) / d.spent) * 100).toFixed(1) + '%' : '0%',
      ]);
      filename = `campaign-report-${now.toISOString().split('T')[0]}.csv`;
    } else if (type === 'royalties') {
      headers = ['Artist', 'Period', 'Gross Income', 'Artist Share', 'Label Share', 'Paid', 'Remaining', 'Status'];
      const match = {};
      if (artistId) match.artist = new mongoose.Types.ObjectId(artistId);
      const data = await RoyaltyLedger.find(match)
        .populate('artist', 'artistName stageName')
        .sort({ periodStart: -1 })
        .lean();
      rows = data.map(d => [
        d.artist?.artistName || d.artist?.stageName || 'Unknown',
        d.period, d.grossIncome, d.artistShare, d.labelShare,
        d.totalPaid, d.remainingBalance, d.status,
      ]);
      filename = `royalty-report-${now.toISOString().split('T')[0]}.csv`;
    } else if (type === 'finances') {
      headers = ['Date', 'Type', 'Category', 'Amount', 'Artist', 'Payment Status', 'Description'];
      const match = {};
      if (startDate && endDate) {
        match.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
      }
      if (artistId) match.artist = new mongoose.Types.ObjectId(artistId);
      const data = await Finance.find(match)
        .populate('artist', 'artistName stageName')
        .sort({ date: -1 })
        .lean();
      rows = data.map(d => [
        d.date ? new Date(d.date).toISOString().split('T')[0] : '',
        d.type, d.category, d.amount,
        d.artist?.artistName || d.artist?.stageName || '',
        d.paymentStatus, d.description,
      ]);
      filename = `financial-report-${now.toISOString().split('T')[0]}.csv`;
    } else {
      return res.status(400).json({ success: false, message: 'Invalid report type. Use: revenue, artists, campaigns, royalties, finances' });
    }

    const csvContent = [headers.join(','), ...rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);
  } catch (error) {
    console.error('Export report error:', error);
    res.status(500).json({ success: false, message: 'Failed to export report' });
  }
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function dateFilterFromQuery(query) {
  const filter = {};
  if (query.startDate && query.endDate) {
    filter.periodStart = { $gte: new Date(query.startDate) };
    filter.periodEnd = { $lte: new Date(query.endDate) };
  }
  return filter;
}

function getISOWeek(date) {
  const d = new Date(date.getTime());
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
  const week1 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
}
