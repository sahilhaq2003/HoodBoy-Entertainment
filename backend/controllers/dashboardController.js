const Artist = require('../models/Artist');
const Song = require('../models/Song');
const Project = require('../models/Project');
const Task = require('../models/Task');
const Release = require('../models/Release');
const Contract = require('../models/Contract');
const Finance = require('../models/Finance');
const Campaign = require('../models/Campaign');
const Contact = require('../models/Contact');
const Activity = require('../models/Activity');
const RoyaltyLedger = require('../models/RoyaltyLedger');

// @desc    Get executive dashboard stats
// @route   GET /api/dashboard/stats
// @access  Private
const getDashboardStats = async (req, res) => {
  try {
    const [
      totalArtists,
      activeCampaigns,
      pendingApprovals,
      overdueTasks,
      upcomingReleases,
      projectsInProduction,
    ] = await Promise.all([
      Artist.countDocuments({ status: 'active' }),
      Campaign.countDocuments({ status: 'active' }),
      Song.countDocuments({ status: 'awaiting_approval' }),
      Task.countDocuments({ status: { $in: ['not_started', 'in_progress'] }, deadline: { $lt: new Date() } }),
      Release.countDocuments({ status: 'scheduled', releaseDate: { $gte: new Date(), $lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) } }),
      Project.countDocuments({ status: 'in_progress' }),
    ]);

    const totalProjects = await Project.countDocuments();
    const totalSongs = await Song.countDocuments();

    // Financial totals
    const incomeAgg = await Finance.aggregate([
      { $match: { type: 'income' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const expenseAgg = await Finance.aggregate([
      { $match: { type: 'expense' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    const totalRevenue = incomeAgg[0]?.total || 0;
    const totalExpenses = expenseAgg[0]?.total || 0;

    // Critical issues: overdue tasks + delayed projects
    const delayedProjects = await Project.countDocuments({ status: 'delayed' });
    const criticalIssues = overdueTasks + delayedProjects;

    res.json({
      success: true,
      data: {
        totalArtists,
        totalProjects,
        totalSongs,
        upcomingReleases,
        activeCampaigns,
        totalRevenue,
        totalExpenses,
        profit: totalRevenue - totalExpenses,
        pendingApprovals,
        overdueTasks,
        criticalIssues,
        projectsInProduction,
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get monthly financial data for charts
// @route   GET /api/dashboard/financials
// @access  Private
const getMonthlyFinancials = async (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();

    const monthlyData = await Finance.aggregate([
      { $match: { year } },
      {
        $group: {
          _id: { month: '$month', type: '$type' },
          total: { $sum: '$amount' }
        }
      },
      { $sort: { '_id.month': 1 } }
    ]);

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const result = months.map((name, i) => {
      const monthNum = i + 1;
      const income = monthlyData.find(d => d._id.month === monthNum && d._id.type === 'income')?.total || 0;
      const expenses = monthlyData.find(d => d._id.month === monthNum && d._id.type === 'expense')?.total || 0;
      return { name, revenue: income, expenses, profit: income - expenses };
    });

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get project status breakdown
// @route   GET /api/dashboard/projects
// @access  Private
const getProjectStatusBreakdown = async (req, res) => {
  try {
    const breakdown = await Project.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    res.json({ success: true, data: breakdown });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get upcoming deadlines
// @route   GET /api/dashboard/deadlines
// @access  Private
const getUpcomingDeadlines = async (req, res) => {
  try {
    const now = new Date();
    const in60Days = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);

    const [releases, contracts, tasks, campaigns] = await Promise.all([
      Release.find({ releaseDate: { $gte: now, $lte: in60Days } })
        .populate('artist', 'name stageName')
        .sort('releaseDate').limit(5),
      Contract.find({ endDate: { $gte: now, $lte: in60Days } })
        .populate('artist', 'name stageName')
        .sort('endDate').limit(5),
      Task.find({ deadline: { $gte: now, $lte: in60Days }, status: { $ne: 'completed' } })
        .populate('assignedTo', 'name')
        .sort('deadline').limit(5),
      Campaign.find({ endDate: { $gte: now, $lte: in60Days }, status: 'active' })
        .populate('artist', 'name stageName')
        .sort('endDate').limit(5),
    ]);

    res.json({
      success: true,
      data: {
        releases: releases.map(r => ({ id: r._id, title: r.title, date: r.releaseDate, artist: r.artist?.stageName || r.artist?.name, type: 'release' })),
        contracts: contracts.map(c => ({ id: c._id, title: c.title, date: c.endDate, artist: c.artist?.stageName || c.artist?.name, type: 'contract' })),
        tasks: tasks.map(t => ({ id: t._id, title: t.title, date: t.deadline, assignedTo: t.assignedTo?.name, type: 'task', priority: t.priority })),
        campaigns: campaigns.map(c => ({ id: c._id, title: c.name, date: c.endDate, type: 'campaign' })),
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get unified dashboard pulling from ALL modules
// @route   GET /api/dashboard/unified
// @access  Private
const getUnifiedDashboard = async (req, res) => {
  try {
    const now = new Date();
    const currentYear = now.getFullYear();
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const [
      totalArtists, activeArtists,
      totalSongs, songsByStatus,
      totalProjects, projectsInProduction,
      totalReleases, upcomingReleases,
      totalContracts, activeContracts, expiringContracts,
      totalRevenue, totalExpenses,
      totalCampaigns, activeCampaigns,
      totalTasks, overdueTasks, tasksDueThisWeek,
      totalContacts,
    ] = await Promise.all([
      Artist.countDocuments(),
      Artist.countDocuments({ status: 'active' }),
      Song.countDocuments(),
      Song.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Project.countDocuments(),
      Project.countDocuments({ status: 'in_progress' }),
      Release.countDocuments(),
      Release.countDocuments({ releaseDate: { $gte: now, $lte: in30Days } }),
      Contract.countDocuments(),
      Contract.countDocuments({ status: 'active' }),
      Contract.countDocuments({ status: 'active', endDate: { $gte: now, $lte: in30Days } }),
      Finance.aggregate([
        { $match: { year: currentYear, type: 'income' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Finance.aggregate([
        { $match: { year: currentYear, type: 'expense' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Campaign.countDocuments(),
      Campaign.countDocuments({ status: 'active' }),
      Task.countDocuments(),
      Task.countDocuments({ deadline: { $lt: now }, status: { $nin: ['completed'] } }),
      Task.countDocuments({ deadline: { $gte: now, $lte: in7Days }, status: { $nin: ['completed'] } }),
      Contact.countDocuments(),
    ]);

    const monthlyData = await Finance.aggregate([
      { $match: { year: currentYear } },
      { $group: { _id: { month: '$month', type: '$type' }, total: { $sum: '$amount' } } },
      { $sort: { '_id.month': 1 } },
    ]);
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const financials = months.map((name, i) => {
      const m = i + 1;
      const rev = monthlyData.find(d => d._id.month === m && d._id.type === 'income')?.total || 0;
      const exp = monthlyData.find(d => d._id.month === m && d._id.type === 'expense')?.total || 0;
      return { name, revenue: rev, expenses: exp, profit: rev - exp };
    });

    const [recentTasks, recentReleases, recentContracts] = await Promise.all([
      Task.find({ deadline: { $gte: now, $lte: in30Days }, status: { $ne: 'completed' } })
        .populate('assignedTo', 'name').sort('deadline').limit(5),
      Release.find({ releaseDate: { $gte: now, $lte: in30Days } })
        .populate('artist', 'name stageName').sort('releaseDate').limit(5),
      Contract.find({ endDate: { $gte: now, $lte: in30Days }, status: 'active' })
        .populate('artist', 'name stageName').sort('endDate').limit(3),
    ]);

    const topArtists = await Artist.find({ status: 'active' })
      .sort('-totalRevenue').limit(5)
      .select('name stageName totalStreams totalRevenue image');

    const campaignPerf = await Campaign.find({ status: 'active' })
      .populate('artist', 'name stageName')
      .select('name artist budget spent reach impressions progress')
      .limit(5);

    // Activity feed - last 30 days
    const in30DaysActivity = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const recentActivity = await Activity.find({ createdAt: { $gte: in30DaysActivity } })
      .populate('user', 'name role')
      .sort({ createdAt: -1 })
      .limit(20);

    // Deadline timeline - all upcoming deadlines in one view
    const deadlineTimeline = await Task.find({ deadline: { $gte: now }, status: { $ne: 'completed' } })
      .populate('assignedTo', 'name')
      .sort({ deadline: 1 })
      .limit(15);

    // Contract expiration alerts
    const in90Days = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    const contractAlerts = await Contract.find({ status: 'active', endDate: { $gte: now, $lte: in90Days } })
      .populate('artist', 'name stageName')
      .sort({ endDate: 1 })
      .limit(5);

    const songStatusMap = {};
    songsByStatus.forEach(s => { songStatusMap[s._id] = s.count; });

    res.json({
      success: true,
      data: {
        kpis: {
          totalArtists, activeArtists,
          totalSongs, totalProjects, projectsInProduction,
          totalReleases, upcomingReleases,
          totalContracts, activeContracts, expiringContracts,
          totalRevenue: totalRevenue[0]?.total || 0,
          totalExpenses: totalExpenses[0]?.total || 0,
          profit: (totalRevenue[0]?.total || 0) - (totalExpenses[0]?.total || 0),
          totalCampaigns, activeCampaigns,
          totalTasks, overdueTasks, tasksDueThisWeek,
          totalContacts,
        },
        financials,
        songStatus: songStatusMap,
        recentTasks: recentTasks.map(t => ({
          id: t._id, title: t.title, deadline: t.deadline, assignee: t.assignedTo?.name, priority: t.priority, status: t.status,
        })),
        recentReleases: recentReleases.map(r => ({
          id: r._id, title: r.title, artist: r.artist?.stageName || r.artist?.name, releaseDate: r.releaseDate, status: r.status,
        })),
        recentContracts: recentContracts.map(c => ({
          id: c._id, title: c.title, artist: c.artist?.stageName || c.artist?.name, endDate: c.endDate,
        })),
        topArtists,
        campaignPerformance: campaignPerf,
        recentActivity: recentActivity.map(a => ({
          id: a._id, action: a.action, entityType: a.entityType, entityName: a.entityName,
          userName: a.userName || a.user?.name, details: a.details, createdAt: a.createdAt,
        })),
        deadlineTimeline: deadlineTimeline.map(t => ({
          id: t._id, title: t.title, deadline: t.deadline, assignee: t.assignedTo?.name, priority: t.priority, status: t.status,
        })),
        contractAlerts: contractAlerts.map(c => ({
          id: c._id, title: c.title, artist: c.artist?.stageName || c.artist?.name,
          endDate: c.endDate, daysLeft: Math.ceil((c.endDate - now) / (1000 * 60 * 60 * 24)),
        })),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getRoleDashboard = async (req, res) => {
  try {
    const role = req.user.role;
    const now = new Date();
    const currentYear = now.getFullYear();
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    if (role === 'admin') {
      const [totalArtists, activeArtists, totalSongs, totalProjects, projectsInProduction,
        totalReleases, upcomingReleases, totalContracts, activeContracts, expiringContracts,
        totalRevenue, totalExpenses, totalCampaigns, activeCampaigns,
        totalTasks, overdueTasks, tasksDueThisWeek, totalContacts,
        taskApprovals, songApprovals, projectApprovals, problemTasks, delayedProjects] = await Promise.all([
        Artist.countDocuments(), Artist.countDocuments({ status: 'active' }),
        Song.countDocuments(), Project.countDocuments(), Project.countDocuments({ status: 'in_progress' }),
        Release.countDocuments(), Release.countDocuments({ releaseDate: { $gte: now, $lte: in30Days } }),
        Contract.countDocuments(), Contract.countDocuments({ status: 'active' }),
        Contract.countDocuments({ status: 'active', endDate: { $gte: now, $lte: in30Days } }),
        Finance.aggregate([{ $match: { year: currentYear, type: 'income' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
        Finance.aggregate([{ $match: { year: currentYear, type: 'expense' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
        Campaign.countDocuments(), Campaign.countDocuments({ status: 'active' }),
        Task.countDocuments(), Task.countDocuments({ deadline: { $lt: now }, status: { $nin: ['completed'] } }),
        Task.countDocuments({ deadline: { $gte: now, $lte: in7Days }, status: { $nin: ['completed'] } }),
        Contact.countDocuments(),
        Task.countDocuments({ status: 'waiting_approval' }),
        Song.countDocuments({ status: 'awaiting_approval' }),
        Project.countDocuments({ status: 'waiting_approval' }),
        Task.countDocuments({
          status: { $nin: ['completed'] },
          $or: [{ deadline: { $lt: now } }, { status: { $in: ['blocked', 'delayed'] } }],
        }),
        Project.countDocuments({ status: 'delayed' }),
      ]);
      const topArtists = await Artist.find({ status: 'active' }).sort('-totalRevenue').limit(5).select('name stageName totalStreams totalRevenue image');
      const recentActivity = await Activity.find().populate('user', 'name role').sort({ createdAt: -1 }).limit(15);
      const contractAlerts = await Contract.find({ status: 'active', endDate: { $gte: now, $lte: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000) } })
        .populate('artist', 'name stageName').sort({ endDate: 1 }).limit(5);

      // Executive action center: actionable records instead of totals alone.
      const [attentionTasks, delayedProjectList, approvalTaskList, approvalSongList,
        approvalProjectList, activeProjectList, upcomingReleaseList, activeCampaignList] = await Promise.all([
        Task.find({
          status: { $nin: ['completed'] },
          $or: [{ deadline: { $lt: now } }, { status: { $in: ['blocked', 'delayed'] } }],
        }).populate('assignedTo', 'name').populate('relatedProject', 'name').sort({ deadline: 1 }).limit(10),
        Project.find({ status: 'delayed' }).populate('artist', 'name stageName').populate('assignedTo', 'name').sort({ releaseDate: 1 }).limit(10),
        Task.find({ status: 'waiting_approval' }).populate('assignedTo', 'name').populate('relatedProject', 'name').sort({ deadline: 1 }).limit(10),
        Song.find({ status: 'awaiting_approval' }).populate('artist', 'name stageName').populate('assignedTo', 'name').sort({ updatedAt: -1 }).limit(10),
        Project.find({ status: 'waiting_approval' }).populate('artist', 'name stageName').populate('assignedTo', 'name').sort({ updatedAt: -1 }).limit(10),
        Project.find({ status: { $in: ['not_started', 'in_progress', 'waiting_approval', 'delayed'] } })
          .populate('artist', 'name stageName').populate('assignedTo', 'name').sort({ priority: -1, releaseDate: 1 }).limit(20),
        Release.find({ releaseDate: { $gte: now }, status: { $nin: ['released', 'cancelled'] } })
          .populate('artist', 'name stageName').populate('assignedTo', 'name').sort({ releaseDate: 1 }).limit(8),
        Campaign.find({ status: 'active' }).populate('artist', 'name stageName').populate('assignedTo', 'name').sort({ endDate: 1 }).limit(8),
      ]);

      const projectIds = activeProjectList.map(project => project._id);
      const projectTasks = projectIds.length > 0
        ? await Task.find({ relatedProject: { $in: projectIds }, status: { $nin: ['completed'] } })
          .populate('assignedTo', 'name').sort({ deadline: 1 })
        : [];
      const nextTaskByProject = new Map();
      projectTasks.forEach(task => {
        const projectId = task.relatedProject?.toString();
        if (projectId && !nextTaskByProject.has(projectId)) nextTaskByProject.set(projectId, task);
      });

      const approvalQueue = [
        ...approvalTaskList.map(task => ({
          id: task._id, type: 'task', title: task.title, owner: task.assignedTo?.name || 'Unassigned',
          context: task.relatedProject?.name || task.deliverable || 'Task approval', date: task.deadline,
        })),
        ...approvalSongList.map(song => ({
          id: song._id, type: 'song', title: song.title, owner: song.assignedTo?.name || 'Unassigned',
          context: song.artist?.stageName || song.artist?.name || 'Song approval', date: song.updatedAt,
        })),
        ...approvalProjectList.map(project => ({
          id: project._id, type: 'project', title: project.name, owner: project.assignedTo?.name || 'Unassigned',
          context: project.artist?.stageName || project.artist?.name || 'Project approval', date: project.updatedAt,
        })),
      ].sort((a, b) => new Date(a.date) - new Date(b.date)).slice(0, 12);

      return res.json({ success: true, data: {
        role: 'admin',
        kpis: {
          totalArtists, activeArtists, totalSongs, totalProjects, projectsInProduction,
          totalReleases, upcomingReleases, totalContracts, activeContracts, expiringContracts,
          totalRevenue: totalRevenue[0]?.total || 0, totalExpenses: totalExpenses[0]?.total || 0,
          profit: (totalRevenue[0]?.total || 0) - (totalExpenses[0]?.total || 0),
          totalCampaigns, activeCampaigns, totalTasks, overdueTasks, tasksDueThisWeek, totalContacts,
          pendingApprovals: taskApprovals + songApprovals + projectApprovals,
          criticalIssues: problemTasks + delayedProjects,
        },
        topArtists,
        recentActivity: recentActivity.map(a => ({ id: a._id, action: a.action, entityType: a.entityType, entityName: a.entityName, userName: a.userName || a.user?.name, createdAt: a.createdAt })),
        contractAlerts: contractAlerts.map(c => ({ id: c._id, title: c.title, artist: c.artist?.stageName || c.artist?.name, endDate: c.endDate, daysLeft: Math.ceil((c.endDate - now) / (1000 * 60 * 60 * 24)) })),
        attentionItems: [
          ...attentionTasks.map(task => ({
            id: task._id, type: 'task', title: task.title, owner: task.assignedTo?.name || 'Unassigned',
            context: task.relatedProject?.name || task.deliverable || 'Task', status: task.status,
            date: task.deadline, overdue: task.deadline < now,
          })),
          ...delayedProjectList.map(project => ({
            id: project._id, type: 'project', title: project.name, owner: project.assignedTo?.name || 'Unassigned',
            context: project.artist?.stageName || project.artist?.name || 'Project', status: project.status,
            date: project.releaseDate, overdue: Boolean(project.releaseDate && project.releaseDate < now),
          })),
        ].slice(0, 12),
        approvalQueue,
        projectNextActions: activeProjectList.map(project => {
          const nextTask = nextTaskByProject.get(project._id.toString());
          return {
            id: project._id, title: project.name, artist: project.artist?.stageName || project.artist?.name,
            owner: nextTask?.assignedTo?.name || project.assignedTo?.name || 'Unassigned',
            status: project.status, progress: project.completionPercentage || 0,
            nextAction: nextTask?.deliverable || nextTask?.title || 'Define the next action',
            nextDeadline: nextTask?.deadline || project.releaseDate,
          };
        }),
        upcomingReleaseSchedule: upcomingReleaseList.map(release => ({
          id: release._id, title: release.title, artist: release.artist?.stageName || release.artist?.name,
          owner: release.assignedTo?.name || 'Unassigned', status: release.status,
          phase: release.currentPhase, releaseDate: release.releaseDate,
        })),
        campaignStatus: activeCampaignList.map(campaign => ({
          id: campaign._id, title: campaign.name, artist: campaign.artist?.stageName || campaign.artist?.name,
          owner: campaign.assignedTo?.name || 'Unassigned', progress: campaign.progress || 0,
          spent: campaign.spent || 0, budget: campaign.budget || 0, endDate: campaign.endDate,
        })),
      }});
    }

    if (role === 'manager') {
      const [myArtists, myProjects, myTasks, overdueTasks, tasksDueThisWeek, activeCampaigns] = await Promise.all([
        Artist.countDocuments({ manager: req.user._id }),
        Project.countDocuments({ assignedTo: req.user._id }),
        Task.countDocuments({ assignedTo: req.user._id, status: { $nin: ['completed'] } }),
        Task.countDocuments({ assignedTo: req.user._id, deadline: { $lt: now }, status: { $nin: ['completed'] } }),
        Task.countDocuments({ assignedTo: req.user._id, deadline: { $gte: now, $lte: in7Days }, status: { $nin: ['completed'] } }),
        Campaign.countDocuments({ assignedTo: req.user._id, status: 'active' }),
      ]);
      const myArtistList = await Artist.find({ manager: req.user._id }).select('name stageName status totalStreams totalRevenue image').limit(10);
      const myTasksList = await Task.find({ assignedTo: req.user._id, status: { $nin: ['completed'] } })
        .populate('relatedArtist', 'name stageName').sort({ deadline: 1 }).limit(10);
      const upcomingReleases = await Release.find({ releaseDate: { $gte: now, $lte: in30Days } })
        .populate('artist', 'name stageName').sort('releaseDate').limit(5);

      return res.json({ success: true, data: {
        role: 'manager',
        kpis: { myArtists, myProjects, myTasks, overdueTasks, tasksDueThisWeek, activeCampaigns },
        artists: myArtistList,
        tasks: myTasksList.map(t => ({ id: t._id, title: t.title, deadline: t.deadline, priority: t.priority, status: t.status, artist: t.relatedArtist?.stageName })),
        upcomingReleases: upcomingReleases.map(r => ({ id: r._id, title: r.title, artist: r.artist?.stageName || r.artist?.name, releaseDate: r.releaseDate, status: r.status })),
      }});
    }

    if (role === 'artist') {
      const artistDoc = await Artist.findOne({ email: req.user.email });
      if (!artistDoc) return res.json({ success: true, data: { role: 'artist', kpis: {}, songs: [], releases: [], tasks: [], royalties: {} }});

      const [mySongs, myReleases, myTasks, myRoyalties] = await Promise.all([
        Song.find({ artist: artistDoc._id }).select('title status genre streams revenue createdAt').sort('-createdAt'),
        Release.find({ artist: artistDoc._id }).select('title releaseDate status type currentPhase').sort('-releaseDate'),
        Task.find({ assignedTo: req.user._id }).populate('assignedBy', 'name').sort({ deadline: 1 }).limit(10),
        RoyaltyLedger.find({ artist: artistDoc._id }).sort({ periodStart: -1 }).limit(5),
      ]);
      const totalStreams = mySongs.reduce((s, song) => s + (song.streams || 0), 0);
      const totalRevenue = mySongs.reduce((s, song) => s + (song.revenue || 0), 0);
      const totalRoyaltiesOwed = myRoyalties.reduce((s, r) => s + (r.artistShare || 0), 0);
      const totalPaid = myRoyalties.reduce((s, r) => s + (r.totalPaid || 0), 0);

      return res.json({ success: true, data: {
        role: 'artist',
        artist: { id: artistDoc._id, name: artistDoc.name, stageName: artistDoc.stageName, image: artistDoc.image, status: artistDoc.status, genre: artistDoc.genre },
        kpis: { totalSongs: mySongs.length, totalReleases: myReleases.length, totalStreams, totalRevenue, totalRoyaltiesOwed, totalPaid, balance: totalRoyaltiesOwed - totalPaid },
        songs: mySongs,
        releases: myReleases,
        tasks: myTasks.map(t => ({ id: t._id, title: t.title, deadline: t.deadline, status: t.status, priority: t.priority, assignedBy: t.assignedBy?.name })),
        royalties: myRoyalties.map(r => ({ id: r._id, period: r.period, grossIncome: r.grossIncome, artistShare: r.artistShare, totalPaid: r.totalPaid, remainingBalance: r.remainingBalance, status: r.status })),
      }});
    }

    if (role === 'finance') {
      const [totalRevenue, totalExpenses, pendingPayments, totalBudgets, royaltyEntries] = await Promise.all([
        Finance.aggregate([{ $match: { year: currentYear, type: 'income' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
        Finance.aggregate([{ $match: { year: currentYear, type: 'expense' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
        Finance.countDocuments({ paymentStatus: 'pending' }),
        require('../models/Budget').countDocuments({ status: 'active' }),
        RoyaltyLedger.countDocuments(),
      ]);
      const totalRoyaltiesPaid = await RoyaltyLedger.aggregate([{ $group: { _id: null, total: { $sum: '$totalPaid' } } }]);
      const recentTransactions = await Finance.find().sort({ date: -1 }).limit(10)
        .populate('artist', 'name stageName');

      return res.json({ success: true, data: {
        role: 'finance',
        kpis: {
          totalRevenue: totalRevenue[0]?.total || 0,
          totalExpenses: totalExpenses[0]?.total || 0,
          profit: (totalRevenue[0]?.total || 0) - (totalExpenses[0]?.total || 0),
          pendingPayments, totalBudgets, royaltyEntries,
          totalRoyaltiesPaid: totalRoyaltiesPaid[0]?.total || 0,
        },
        recentTransactions: recentTransactions.map(t => ({ id: t._id, type: t.type, category: t.category, amount: t.amount, description: t.description, artist: t.artist?.stageName || t.artist?.name, date: t.date, paymentStatus: t.paymentStatus })),
      }});
    }

    if (role === 'marketing') {
      const [activeCampaigns, totalCampaigns, totalContacts, totalContentItems] = await Promise.all([
        Campaign.countDocuments({ status: 'active' }),
        Campaign.countDocuments(),
        Contact.countDocuments(),
        Campaign.aggregate([{ $unwind: '$contentItems' }, { $count: 'total' }]),
      ]);
      const activeCampaignList = await Campaign.find({ status: 'active' })
        .populate('artist', 'name stageName').select('name artist budget spent reach impressions progress platforms startDate endDate').limit(5);
      const upcomingContent = await Campaign.aggregate([
        { $unwind: '$contentItems' },
        { $match: { 'contentItems.scheduledDate': { $gte: now, $lte: in30Days } } },
        { $project: { title: '$contentItems.title', platform: '$contentItems.platform', scheduledDate: '$contentItems.scheduledDate', status: '$contentItems.status', campaignName: '$name' } },
        { $sort: { scheduledDate: 1 } },
        { $limit: 10 },
      ]);

      return res.json({ success: true, data: {
        role: 'marketing',
        kpis: { activeCampaigns, totalCampaigns, totalContacts, totalContentItems: totalContentItems[0]?.total || 0 },
        campaigns: activeCampaignList.map(c => ({ id: c._id, name: c.name, artist: c.artist?.stageName || c.artist?.name, budget: c.budget, spent: c.spent, reach: c.reach, impressions: c.impressions, progress: c.progress, platforms: c.platforms })),
        upcomingContent,
      }});
    }

    return res.status(403).json({ success: false, message: 'Invalid role' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getDashboardStats, getMonthlyFinancials, getProjectStatusBreakdown, getUpcomingDeadlines, getUnifiedDashboard, getRoleDashboard };
