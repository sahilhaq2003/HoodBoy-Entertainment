const nodemailer = require('nodemailer');
const EmailNotification = require('../models/EmailNotification');
const EmailSettings = require('../models/EmailSettings');
const User = require('../models/User');
const Artist = require('../models/Artist');
const { LinkupBooking, LinkupEvent, LinkupPackage } = require('../models/LinkupPlatform');
const { renderEmail } = require('./emailTemplates');
const { formatEventDate, eventStartInstant } = require('../lib/eventTime');
const { createBulkNotifications } = require('./notificationService');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
let transporter;
let processing = false;
let workerTimer;
let reminderTimer;

const enabledByEnvironment = () => String(process.env.EMAIL_NOTIFICATIONS_ENABLED || 'false').toLowerCase() === 'true';
const smtpConfigured = () => Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD);
const safeError = error => String(error?.message || 'Email delivery failed').replace(/(password|pass|auth|token|secret)\s*[:=]\s*\S+/gi, '$1=[redacted]').slice(0, 1000);

const getTransporter = () => {
  if (transporter) return transporter;
  if (!smtpConfigured()) throw new Error('SMTP is not configured');
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 465),
    secure: String(process.env.SMTP_SECURE || 'true').toLowerCase() === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
    pool: true,
    maxConnections: 3,
    maxMessages: 100,
  });
  return transporter;
};

const getSettings = async () => {
  let settings = await EmailSettings.findOne({ key: 'global' });
  if (!settings) settings = await EmailSettings.create({
    key: 'global', enabled: enabledByEnvironment(),
    adminRecipients: [process.env.ADMIN_NOTIFICATION_EMAIL || process.env.SYSTEM_NOTIFICATION_EMAIL || process.env.SMTP_USER].filter(Boolean),
  });
  return settings;
};

const categoryAllowed = (settings, category) => settings.enabled && (
  category === 'booking' ? settings.bookingNotifications
    : category === 'distribution' ? settings.distributionNotifications
      : category === 'system' ? settings.systemAlerts
        : true
);

const queueEmail = async ({ recipientEmail, recipientUserId, notificationType, templateName, templateData = {}, relatedEntityType = '', relatedEntityId = '', dedupeKey, category = 'booking', maxRetries = 3 }) => {
  const email = String(recipientEmail || '').trim().toLowerCase();
  if (!EMAIL_PATTERN.test(email)) return null;
  const settings = await getSettings();
  if (!enabledByEnvironment() || !categoryAllowed(settings, category)) return null;
  const key = String(dedupeKey || `${notificationType}:${relatedEntityType}:${relatedEntityId}:${email}`).slice(0, 191);
  const existing = await EmailNotification.findOne({ dedupeKey: key });
  if (existing) return existing;
  const rendered = renderEmail(templateName, templateData);
  try {
    const record = await EmailNotification.create({
      recipientEmail: email, recipientUserId, notificationType, subject: rendered.subject,
      templateName, templateData, relatedEntityType, relatedEntityId: String(relatedEntityId || ''),
      dedupeKey: key, maxRetries,
    });
    setImmediate(() => processQueue().catch(() => {}));
    return record;
  } catch (error) {
    if (/unique|duplicate/i.test(String(error.message))) return EmailNotification.findOne({ dedupeKey: key });
    throw error;
  }
};

const processQueue = async (limit = 10) => {
  if (processing || !enabledByEnvironment() || !smtpConfigured()) return { processed: 0 };
  processing = true;
  let processed = 0;
  try {
    const jobs = await EmailNotification.find({
      deliveryStatus: { $in: ['pending', 'failed'] },
      nextAttemptAt: { $lte: new Date() },
    }).sort({ createdAt: 1 }).limit(limit);
    for (const job of jobs) {
      if (job.retryCount >= job.maxRetries) continue;
      job.deliveryStatus = 'processing';
      await job.save();
      try {
        const rendered = renderEmail(job.templateName, job.templateData);
        const result = await getTransporter().sendMail({
          from: { name: process.env.SMTP_FROM_NAME || 'HBE Live', address: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER },
          to: job.recipientEmail,
          subject: job.subject || rendered.subject,
          text: rendered.text,
          html: rendered.html,
          headers: { 'X-HBE-Notification-ID': String(job._id), 'X-Auto-Response-Suppress': 'OOF, AutoReply' },
        });
        job.providerMessageId = String(result.messageId || '');
        job.deliveryStatus = 'sent';
        job.acceptedAt = new Date();
        job.sentAt = new Date();
        job.lastError = '';
      } catch (error) {
        job.retryCount += 1;
        job.deliveryStatus = 'failed';
        job.lastError = safeError(error);
        job.nextAttemptAt = new Date(Date.now() + Math.min(60 * 60 * 1000, 30000 * (2 ** Math.max(0, job.retryCount - 1))));
        if (job.retryCount >= job.maxRetries) {
          const admins = await User.find({ role: 'admin', isActive: true }).select('_id');
          if (admins.length) await createBulkNotifications(admins.map(admin => ({
            userId: admin._id, type: 'system', title: 'Email delivery repeatedly failed',
            message: `${job.notificationType} could not be delivered to ${job.recipientEmail}. Review Email Settings and retry the message.`,
            link: '/the-lnk-up', priority: 'high', metadata: { emailNotificationId: job._id },
          }))).catch(() => {});
        }
      }
      await job.save();
      processed += 1;
    }
  } finally { processing = false; }
  return { processed };
};

const adminRecipients = async () => {
  const settings = await getSettings();
  return [...new Set([...(settings.adminRecipients || []), process.env.ADMIN_NOTIFICATION_EMAIL, process.env.SYSTEM_NOTIFICATION_EMAIL].map(value => String(value || '').trim().toLowerCase()).filter(value => EMAIL_PATTERN.test(value)))];
};

const queueAdmin = async ({ notificationType, templateName = 'admin_notification', templateData, relatedEntityType, relatedEntityId, dedupeKey, category = 'booking' }) => Promise.all((await adminRecipients()).map(email => queueEmail({
  recipientEmail: email, notificationType, templateName, templateData: { ...templateData, customerName: 'HBE Live Administrator', actionLabel: templateData?.actionLabel || 'Open Admin Dashboard' }, relatedEntityType, relatedEntityId, dedupeKey: `${dedupeKey}:${email}`, category,
})));

const bookingData = async (bookingOrId, extra = {}) => {
  const booking = typeof bookingOrId === 'string' ? await LinkupBooking.findById(bookingOrId) : bookingOrId;
  if (!booking) return null;
  const [event, pkg] = await Promise.all([
    booking.event ? LinkupEvent.findById(booking.event) : null,
    booking.package ? LinkupPackage.findById(booking.package) : null,
  ]);
  return { booking, data: {
    customerName: booking.customerName, bookingReference: booking.bookingReference,
    eventName: event?.title || 'HBE Live Event', venue: [event?.venueName, event?.location].filter(Boolean).join(' · '), eventDate: event?.eventDate, eventDateFormatted: event ? formatEventDate(event) : '',
    packageName: pkg?.name || (booking.bookingType === 'performance_slot' ? 'Performance Slot' : ''), guestCount: booking.guestCount,
    totalAmount: booking.totalAmount, currency: booking.currency, paymentStatus: booking.paymentStatus, paymentDueAt: booking.paymentDueAt,
    actionPath: `/linkup/booking/${encodeURIComponent(booking.bookingReference)}`, ...extra,
  } };
};

const notifyBooking = async (bookingOrId, eventType, extra = {}) => {
  try {
    const context = await bookingData(bookingOrId, extra);
    if (!context) return;
    const { booking, data } = context;
    await queueEmail({ recipientEmail: booking.email, recipientUserId: booking.customer, notificationType: eventType, templateName: eventType, templateData: data, relatedEntityType: 'booking', relatedEntityId: booking._id, dedupeKey: `booking:${booking._id}:${eventType}:${extra.transitionKey || ''}`, category: 'booking' });
    await queueAdmin({ notificationType: `admin_${eventType}`, templateData: { ...data, title: extra.adminTitle || `Booking update: ${booking.bookingReference}`, intro: extra.adminIntro || `A booking ${eventType.replaceAll('_', ' ')} event was recorded.`, actionPath: '/the-lnk-up' }, relatedEntityType: 'booking', relatedEntityId: booking._id, dedupeKey: `admin:booking:${booking._id}:${eventType}:${extra.transitionKey || ''}`, category: 'booking' });
  } catch (error) { console.error(`Email notification warning: ${safeError(error)}`); }
};

const notifyDistribution = async (release, previousStatus, extra = {}) => {
  try {
    if (!release || release.status === previousStatus) return;
    const artist = release.artist ? await Artist.findById(release.artist) : null;
    const user = artist?.email ? await User.findOne({ email: artist.email }) : null;
    const data = {
      artistName: artist?.stageName || artist?.artistName || artist?.name || 'Artist', releaseTitle: release.title,
      releaseReference: release.distribeatsReleaseId || release._id, upc: release.upc,
      isrc: release.tracks?.map(track => track.isrc).filter(Boolean).join(', '), distributionStatus: release.status,
      releaseDate: release.releaseDate, reason: release.rejectionReason || release.lastSyncError || extra.reason,
      actionPath: `/distribution/${release._id}`, actionLabel: 'View Release Dashboard',
    };
    if (artist?.email) await queueEmail({ recipientEmail: artist.email, recipientUserId: user?._id, notificationType: release.status === 'submitted' ? 'distribution_submitted' : 'distribution_status', templateName: release.status === 'submitted' ? 'distribution_submitted' : 'distribution_status', templateData: data, relatedEntityType: 'distribution_release', relatedEntityId: release._id, dedupeKey: `distribution:${release._id}:${release.status}`, category: 'distribution' });
    await queueAdmin({ notificationType: 'admin_distribution_status', templateData: { ...data, title: `${data.artistName}: ${release.status}`, intro: `A DistriBeats release changed from ${previousStatus || 'new'} to ${release.status}.`, actionPath: `/distribution/${release._id}` }, relatedEntityType: 'distribution_release', relatedEntityId: release._id, dedupeKey: `admin:distribution:${release._id}:${release.status}`, category: 'distribution' });
  } catch (error) { console.error(`Distribution email warning: ${safeError(error)}`); }
};

const notifySystemAlert = async ({ code, title, message, severity = 'high', entityId = '', bucketMinutes = 60 }) => {
  const bucket = Math.floor(Date.now() / (bucketMinutes * 60000));
  try { await queueAdmin({ notificationType: 'system_alert', templateName: 'system_alert', templateData: { title, message, severity, actionPath: '/system-health' }, relatedEntityType: 'system', relatedEntityId: entityId, dedupeKey: `system:${code}:${entityId}:${bucket}`, category: 'system' }); }
  catch (error) { console.error(`System alert email warning: ${safeError(error)}`); }
};

const sendBookingReminders = async () => {
  const settings = await getSettings();
  if (!categoryAllowed(settings, 'booking')) return 0;
  const hours = Number(settings.reminderHours || 24);
  const calendarStart = new Date(Date.now() - 24 * 3600000);
  const calendarEnd = new Date(Date.now() + (hours + 48) * 3600000);
  const events = await LinkupEvent.find({ status: 'published', eventDate: { $gte: calendarStart, $lte: calendarEnd } });
  let count = 0;
  for (const event of events) {
    const start = eventStartInstant(event);
    const hoursUntilStart = start ? (start.getTime() - Date.now()) / 3600000 : Number.POSITIVE_INFINITY;
    if (Math.abs(hoursUntilStart - hours) > 0.5) continue;
    const bookings = await LinkupBooking.find({ event: event._id, bookingStatus: 'confirmed', paymentStatus: 'paid' });
    for (const booking of bookings) { await notifyBooking(booking, 'booking_reminder', { transitionKey: String(event.eventDate) }); count += 1; }
  }
  return count;
};

const verifyConnection = async () => {
  if (!enabledByEnvironment()) throw new Error('Email notifications are disabled');
  if (!smtpConfigured()) throw new Error('SMTP is not configured');
  await getTransporter().verify();
  return true;
};

const startEmailWorkers = () => {
  if (workerTimer) return;
  workerTimer = setInterval(() => processQueue().catch(error => console.error(`Email queue warning: ${safeError(error)}`)), Number(process.env.EMAIL_QUEUE_INTERVAL_MS || 30000));
  reminderTimer = setInterval(() => sendBookingReminders().catch(error => console.error(`Booking reminder warning: ${safeError(error)}`)), 60 * 60 * 1000);
  workerTimer.unref?.(); reminderTimer.unref?.();
  setTimeout(() => processQueue().catch(() => {}), 1000).unref?.();
};

const setTransporterForTest = value => { transporter = value; };

module.exports = { queueEmail, queueAdmin, processQueue, notifyBooking, notifyDistribution, notifySystemAlert, sendBookingReminders, verifyConnection, getSettings, startEmailWorkers, safeError, _setTransporterForTest: setTransporterForTest };
