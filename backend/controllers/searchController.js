const Artist = require('../models/Artist');
const Song = require('../models/Song');
const Release = require('../models/Release');
const Project = require('../models/Project');
const Contract = require('../models/Contract');
const Contact = require('../models/Contact');
const Task = require('../models/Task');
const Campaign = require('../models/Campaign');
const { ROLE_ACCESS } = require('../middleware/rbac');

const readable = (role, resource) => {
  const permission = ROLE_ACCESS[role]?.[resource];
  return permission === true || permission?.read === true;
};

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const workspaceSearch = async (req, res) => {
  try {
    const query = String(req.query.q || '').trim();
    if (query.length < 2) return res.json({ success: true, data: [] });
    const regex = new RegExp(escapeRegex(query.slice(0, 80)), 'i');
    const role = req.user.role;
    const jobs = [];

    const add = (enabled, promise, map) => {
      if (enabled) jobs.push(promise.then(items => items.map(map)));
    };

    if (role === 'artist') {
      const artist = await Artist.findOne({ email: req.user.email }).select('_id');
      if (!artist) return res.json({ success: true, data: [] });
      add(true, Song.find({ artist: artist._id, title: regex }).select('title status').limit(5), item => ({ id: item._id, category: 'Song', title: item.title, subtitle: item.status, path: '/my-music' }));
      add(true, Release.find({ artist: artist._id, title: regex }).select('title status').limit(5), item => ({ id: item._id, category: 'Release', title: item.title, subtitle: item.status, path: '/my-releases' }));
      add(true, Task.find({ assignedTo: req.user._id, title: regex }).select('title status').limit(5), item => ({ id: item._id, category: 'Task', title: item.title, subtitle: item.status, path: '/tasks' }));
    } else {
      add(readable(role, 'artists'), Artist.find({ $or: [{ legalName: regex }, { artistName: regex }, { email: regex }] }).select('legalName artistName email').limit(5), item => ({ id: item._id, category: 'Artist', title: item.artistName || item.legalName, subtitle: item.email, path: `/artists/${item._id}` }));
      add(readable(role, 'songs'), Song.find({ title: regex }).populate('artist', 'artistName stageName legalName name').select('title status artist').limit(5), item => ({ id: item._id, category: 'Song', title: item.title, subtitle: item.artist?.artistName || item.artist?.stageName || item.status, path: `/songs?search=${encodeURIComponent(query)}` }));
      add(readable(role, 'releases'), Release.find({ title: regex }).populate('artist', 'artistName stageName legalName name').select('title status artist').limit(5), item => ({ id: item._id, category: 'Release', title: item.title, subtitle: item.artist?.artistName || item.artist?.stageName || item.status, path: '/releases' }));
      add(readable(role, 'projects'), Project.find({ name: regex }).select('name status').limit(5), item => ({ id: item._id, category: 'Project', title: item.name, subtitle: item.status, path: '/projects' }));
      add(readable(role, 'contracts'), Contract.find({ $or: [{ title: regex }, { contractNumber: regex }] }).select('title contractNumber status').limit(5), item => ({ id: item._id, category: 'Contract', title: item.title, subtitle: item.contractNumber || item.status, path: '/contracts' }));
      add(readable(role, 'contacts'), Contact.find({ $or: [{ name: regex }, { company: regex }, { email: regex }] }).select('name company email').limit(5), item => ({ id: item._id, category: 'Contact', title: item.name, subtitle: item.company || item.email, path: '/contacts' }));
      add(readable(role, 'tasks'), Task.find({ title: regex }).select('title status').limit(5), item => ({ id: item._id, category: 'Task', title: item.title, subtitle: item.status, path: '/tasks' }));
      add(readable(role, 'campaigns'), Campaign.find({ name: regex }).select('name status').limit(5), item => ({ id: item._id, category: 'Campaign', title: item.name, subtitle: item.status, path: '/campaigns' }));
    }

    const resultSets = await Promise.all(jobs);
    const data = resultSets.flat().slice(0, 20);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { workspaceSearch };
