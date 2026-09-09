const Contact = require('../models/Contact');

const CONTACT_FIELDS = ['name', 'email', 'phone', 'company', 'role', 'category', 'subcategory', 'address', 'socialLinks', 'relationshipStatus', 'relationshipStrength', 'followUpDate', 'whatWasSent', 'response', 'genrePreference', 'relatedArtists', 'relatedContracts', 'isFavorite', 'tags', 'notes', 'source', 'assignedTo'];
const INTERACTION_FIELDS = ['type', 'subject', 'notes', 'date', 'outcome', 'whatWasSent', 'response', 'followUpRequired', 'followUpDate'];
const REMINDER_FIELDS = ['title', 'date', 'type', 'notes'];
const pick = (obj, keys) => keys.reduce((o, k) => { if (obj[k] !== undefined) o[k] = obj[k]; return o; }, {});

exports.getContacts = async (req, res) => {
  try {
    const { search, category, relationshipStatus, isFavorite, assignedTo, followUpDue, page = 1, limit = 50 } = req.query;
    const query = {};
    if (category) query.category = category;
    if (relationshipStatus) query.relationshipStatus = relationshipStatus;
    if (followUpDue === 'true') query.followUpDate = { $lte: new Date() };
    if (isFavorite === 'true') query.isFavorite = true;
    if (assignedTo) query.assignedTo = assignedTo;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { company: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [contacts, total] = await Promise.all([
      Contact.find(query)
        .populate('relatedArtists', 'name artistName stageName image')
        .populate('assignedTo', 'name email')
        .sort('-createdAt')
        .skip(skip)
        .limit(parseInt(limit)),
      Contact.countDocuments(query),
    ]);
    res.json({ success: true, data: contacts, pagination: { total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)), limit: parseInt(limit) } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getContactById = async (req, res) => {
  try {
    const contact = await Contact.findById(req.params.id)
      .populate('relatedArtists', 'name artistName stageName image')
      .populate('relatedContracts', 'title status type')
      .populate('assignedTo', 'name email')
      .populate('interactions.createdBy', 'name');
    if (!contact) return res.status(404).json({ success: false, message: 'Contact not found' });
    res.json({ success: true, data: contact });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createContact = async (req, res) => {
  try {
    if (!req.body.email && !req.body.phone) return res.status(400).json({ success: false, message: 'Email or phone is required' });
    if (req.body.email && !/^\S+@\S+\.\S+$/.test(req.body.email)) return res.status(400).json({ success: false, message: 'Enter a valid email address' });
    const contact = await Contact.create(pick(req.body, CONTACT_FIELDS));
    res.status(201).json({ success: true, data: contact });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.updateContact = async (req, res) => {
  try {
    if (req.body.email && !/^\S+@\S+\.\S+$/.test(req.body.email)) return res.status(400).json({ success: false, message: 'Enter a valid email address' });
    const contact = await Contact.findById(req.params.id);
    if (!contact) return res.status(404).json({ success: false, message: 'Contact not found' });
    Object.assign(contact, pick(req.body, CONTACT_FIELDS));
    if (!contact.email && !contact.phone) return res.status(400).json({ success: false, message: 'Email or phone is required' });
    await contact.save();
    res.json({ success: true, data: contact });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.deleteContact = async (req, res) => {
  try {
    const contact = await Contact.findByIdAndDelete(req.params.id);
    if (!contact) return res.status(404).json({ success: false, message: 'Contact not found' });
    res.json({ success: true, message: 'Contact deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.toggleFavorite = async (req, res) => {
  try {
    const contact = await Contact.findById(req.params.id);
    if (!contact) return res.status(404).json({ success: false, message: 'Contact not found' });
    contact.isFavorite = !contact.isFavorite;
    await contact.save();
    res.json({ success: true, data: contact });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.addInteraction = async (req, res) => {
  try {
    const contact = await Contact.findById(req.params.id);
    if (!contact) return res.status(404).json({ success: false, message: 'Contact not found' });
    const interactionData = pick(req.body, INTERACTION_FIELDS);
    const interactionDate = interactionData.date ? new Date(interactionData.date) : new Date();
    contact.interactions.push({ ...interactionData, date: interactionDate, createdBy: req.user._id });
    contact.lastContactedAt = interactionDate;
    contact.lastContactNotes = req.body.notes || req.body.subject || '';
    if (req.body.whatWasSent !== undefined) contact.whatWasSent = req.body.whatWasSent;
    if (req.body.response !== undefined) contact.response = req.body.response;
    if (req.body.followUpRequired && req.body.followUpDate) {
      contact.followUpDate = new Date(req.body.followUpDate);
      contact.reminders.push({ title: `Follow up: ${req.body.subject || contact.name}`, date: req.body.followUpDate, type: 'follow_up', notes: req.body.notes || '' });
    }
    await contact.save();
    res.status(201).json({ success: true, data: contact });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.deleteInteraction = async (req, res) => {
  try {
    const contact = await Contact.findById(req.params.id);
    if (!contact) return res.status(404).json({ success: false, message: 'Contact not found' });
    const interaction = contact.interactions.id(req.params.interactionId);
    if (!interaction) return res.status(404).json({ success: false, message: 'Interaction not found' });
    contact.interactions.pull(req.params.interactionId);
    const latest = [...contact.interactions].sort((a, b) => new Date(b.date) - new Date(a.date))[0];
    contact.lastContactedAt = latest?.date;
    contact.lastContactNotes = latest?.notes || latest?.subject || '';
    await contact.save();
    res.json({ success: true, data: contact });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.addReminder = async (req, res) => {
  try {
    const contact = await Contact.findById(req.params.id);
    if (!contact) return res.status(404).json({ success: false, message: 'Contact not found' });
    contact.reminders.push(pick(req.body, REMINDER_FIELDS));
    if (req.body.type === 'follow_up' && (!contact.followUpDate || new Date(req.body.date) < contact.followUpDate)) contact.followUpDate = new Date(req.body.date);
    await contact.save();
    res.status(201).json({ success: true, data: contact });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.completeReminder = async (req, res) => {
  try {
    const contact = await Contact.findById(req.params.id);
    if (!contact) return res.status(404).json({ success: false, message: 'Contact not found' });
    const reminder = contact.reminders.id(req.params.reminderId);
    if (!reminder) return res.status(404).json({ success: false, message: 'Reminder not found' });
    reminder.completed = true;
    reminder.completedAt = new Date();
    if (reminder.type === 'follow_up') {
      const nextFollowUp = contact.reminders.filter(item => !item.completed && item.type === 'follow_up' && item._id.toString() !== reminder._id.toString()).sort((a, b) => new Date(a.date) - new Date(b.date))[0];
      contact.followUpDate = nextFollowUp?.date;
    }
    await contact.save();
    res.json({ success: true, data: contact });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.deleteReminder = async (req, res) => {
  try {
    const contact = await Contact.findById(req.params.id);
    if (!contact) return res.status(404).json({ success: false, message: 'Contact not found' });
    contact.reminders = contact.reminders.filter(r => r._id.toString() !== req.params.reminderId);
    const nextFollowUp = contact.reminders.filter(item => !item.completed && item.type === 'follow_up').sort((a, b) => new Date(a.date) - new Date(b.date))[0];
    contact.followUpDate = nextFollowUp?.date;
    await contact.save();
    res.json({ success: true, data: contact });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.getUpcomingReminders = async (req, res) => {
  try {
    const { type } = req.query;
    const match = { completed: false };
    if (type) match.type = type;
    const contacts = await Contact.find({ 'reminders.completed': false })
      .select('name reminders')
      .populate('assignedTo', 'name');
    const reminders = [];
    contacts.forEach(c => {
      c.reminders.forEach(r => {
        if (!r.completed) {
          if (!type || r.type === type) {
            reminders.push({ ...r.toObject(), contactName: c.name, contactId: c._id });
          }
        }
      });
    });
    reminders.sort((a, b) => new Date(a.date) - new Date(b.date));
    res.json({ success: true, data: reminders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getStats = async (req, res) => {
  try {
    const [total, byCategory, totalInteractions, totalReminders, upcomingReminders, favorites, overdueFollowUps] = await Promise.all([
      Contact.countDocuments(),
      Contact.aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
      Contact.aggregate([{ $project: { count: { $size: '$interactions' } } }, { $group: { _id: null, total: { $sum: '$count' } } }]),
      Contact.aggregate([{ $project: { count: { $size: '$reminders' } } }, { $group: { _id: null, total: { $sum: '$count' } } }]),
      Contact.aggregate([
        { $unwind: '$reminders' },
        { $match: { 'reminders.completed': false } },
        { $count: 'total' },
      ]),
      Contact.countDocuments({ isFavorite: true }),
      Contact.countDocuments({ followUpDate: { $lte: new Date() }, relationshipStatus: { $nin: ['archived', 'inactive'] } }),
    ]);
    res.json({
      success: true,
      data: {
        total,
        byCategory: byCategory.reduce((acc, c) => { acc[c._id] = c.count; return acc; }, {}),
        favorites,
        totalInteractions: totalInteractions[0]?.total || 0,
        totalReminders: totalReminders[0]?.total || 0,
        upcomingRemindersCount: upcomingReminders[0]?.total || 0,
        overdueFollowUps,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
