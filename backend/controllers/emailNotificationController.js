const EmailNotification = require('../models/EmailNotification');
const EmailSettings = require('../models/EmailSettings');
const { queueEmail, processQueue, verifyConnection, getSettings, safeError } = require('../services/emailService');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const requireAdmin = (req, res, next) => req.user?.role === 'admin' ? next() : res.status(403).json({ success: false, message: 'Administrator access is required' });

const configuration = () => ({
  enabledByEnvironment: String(process.env.EMAIL_NOTIFICATIONS_ENABLED || 'false').toLowerCase() === 'true',
  smtpConfigured: Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD),
  smtpHost: process.env.SMTP_HOST || '',
  senderEmail: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || '',
  senderName: process.env.SMTP_FROM_NAME || 'HBE Live',
});

const getConfiguration = async (_req, res) => {
  try {
    const settings = await getSettings();
    const [recent, failed, pending] = await Promise.all([
      EmailNotification.find({}).sort({ createdAt: -1 }).limit(50).select('-templateData'),
      EmailNotification.countDocuments({ deliveryStatus: 'failed' }),
      EmailNotification.countDocuments({ deliveryStatus: { $in: ['pending', 'processing'] } }),
    ]);
    res.json({ success: true, data: { settings, configuration: configuration(), recent, summary: { failed, pending } } });
  } catch (error) { res.status(500).json({ success: false, message: safeError(error) }); }
};

const updateConfiguration = async (req, res) => {
  try {
    const recipients = [...new Set((req.body.adminRecipients || []).map(value => String(value).trim().toLowerCase()).filter(Boolean))];
    if (!recipients.length || recipients.length > 10 || recipients.some(value => !EMAIL_PATTERN.test(value))) return res.status(400).json({ success: false, message: 'Enter between 1 and 10 valid notification email addresses' });
    let settings = await EmailSettings.findOne({ key: 'global' });
    if (!settings) settings = new EmailSettings({ key: 'global' });
    for (const key of ['enabled', 'bookingNotifications', 'distributionNotifications', 'systemAlerts']) if (typeof req.body[key] === 'boolean') settings[key] = req.body[key];
    settings.adminRecipients = recipients;
    settings.reminderHours = Math.min(168, Math.max(1, Number(req.body.reminderHours || 24)));
    settings.updatedBy = req.user._id;
    await settings.save();
    res.json({ success: true, data: settings, message: 'Email notification settings saved' });
  } catch (error) { res.status(500).json({ success: false, message: safeError(error) }); }
};

const testEmail = async (req, res) => {
  try {
    const recipient = String(req.body.recipient || req.user.email || '').trim().toLowerCase();
    if (!EMAIL_PATTERN.test(recipient)) return res.status(400).json({ success: false, message: 'Enter a valid test recipient email' });
    await verifyConnection();
    const record = await queueEmail({ recipientEmail: recipient, recipientUserId: req.user._id, notificationType: 'test_email', templateName: 'test_email', templateData: { customerName: req.user.name, showAction: false }, relatedEntityType: 'system', relatedEntityId: 'smtp-test', dedupeKey: `test:${req.user._id}:${Date.now()}`, category: 'system', maxRetries: 1 });
    if (!record) return res.status(409).json({ success: false, message: 'Email notifications are disabled in settings' });
    await processQueue(20);
    const updated = await EmailNotification.findById(record._id);
    if (updated.deliveryStatus !== 'sent') return res.status(502).json({ success: false, message: updated.lastError || 'SMTP did not accept the test email' });
    res.json({ success: true, message: 'Test email accepted by Gmail SMTP', data: { id: updated._id, status: updated.deliveryStatus, sentAt: updated.sentAt } });
  } catch (error) { res.status(502).json({ success: false, message: safeError(error) }); }
};

const retry = async (req, res) => {
  try {
    const record = await EmailNotification.findById(req.params.id);
    if (!record) return res.status(404).json({ success: false, message: 'Email notification not found' });
    if (record.deliveryStatus === 'sent') return res.status(409).json({ success: false, message: 'This email was already accepted by SMTP' });
    record.deliveryStatus = 'pending'; record.retryCount = 0; record.lastError = ''; record.nextAttemptAt = new Date();
    await record.save();
    setImmediate(() => processQueue().catch(() => {}));
    res.json({ success: true, message: 'Email queued for retry', data: record });
  } catch (error) { res.status(500).json({ success: false, message: safeError(error) }); }
};

module.exports = { requireAdmin, getConfiguration, updateConfiguration, testEmail, retry };
