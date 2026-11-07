const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[character]));

const humanize = value => String(value || '').replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase());
const money = (amount, currency = 'USD') => `${escapeHtml(currency)} ${Number(amount || 0).toFixed(2)}`;
const date = value => value ? new Date(value).toLocaleString('en-US', { dateStyle: 'medium', timeZone: 'UTC' }) : 'To be announced';

const templateCopy = {
  booking_created: ['Booking received', 'Your booking has been created. Complete the payment instructions below to secure your reservation.'],
  booking_confirmed: ['Your booking is confirmed!', 'Your payment has been approved and your HBE Live reservation is confirmed.'],
  payment_pending: ['Complete your bank transfer', 'Your reservation is awaiting payment. Use the details below and upload your receipt before the deadline.'],
  receipt_submitted: ['Payment receipt received', 'We received your payment receipt. Our team is reviewing it and will email you when verification is complete.'],
  payment_approved: ['Payment approved', 'Your payment has been approved and your booking is now confirmed.'],
  payment_rejected: ['Payment receipt needs attention', 'Your payment receipt could not be approved. Review the reason below and submit corrected payment proof.'],
  payment_information_requested: ['More payment information required', 'Our payment team needs additional information before your receipt can be approved.'],
  booking_cancelled: ['Booking cancelled', 'Your booking has been cancelled and its reserved inventory has been released.'],
  booking_reminder: ['Your HBE Live event is tomorrow', 'This is a reminder that your confirmed event begins in approximately 24 hours.'],
  distribution_submitted: ['Release submitted to DistriBeats', 'Your release has been submitted and is now entering the distribution review process.'],
  distribution_status: ['Distribution status updated', 'The distribution status for your release has changed.'],
  admin_notification: ['HBE Live notification', 'An important platform activity requires your attention.'],
  system_alert: ['HBE Live system alert', 'An important integration or system operation requires administrator attention.'],
  test_email: ['HBE Live email test successful', 'Your Gmail SMTP configuration is working correctly.'],
};

const detailRows = data => {
  const rows = [];
  const add = (label, value) => { if (value !== undefined && value !== null && value !== '') rows.push([label, value]); };
  add('Booking reference', data.bookingReference);
  add('Event', data.eventName);
  add('Venue', data.venue);
  add('Event date', data.eventDateFormatted || (data.eventDate ? date(data.eventDate) : ''));
  add('Package', data.packageName);
  add('Guests', data.guestCount);
  add('Total amount', data.totalAmount !== undefined ? money(data.totalAmount, data.currency) : '');
  add('Payment status', data.paymentStatus ? humanize(data.paymentStatus) : '');
  add('Payment deadline', data.paymentDueAt ? date(data.paymentDueAt) : '');
  add('Release', data.releaseTitle);
  add('Artist', data.artistName);
  add('Release reference', data.releaseReference);
  add('UPC', data.upc);
  add('ISRC', data.isrc);
  add('Distribution status', data.distributionStatus ? humanize(data.distributionStatus) : '');
  add('Release date', data.releaseDate ? date(data.releaseDate) : '');
  add('Reason / required action', data.reason);
  add('Severity', data.severity ? humanize(data.severity) : '');
  return rows;
};

const renderEmail = (templateName, rawData = {}) => {
  const data = Object.fromEntries(Object.entries(rawData || {}).map(([key, value]) => [key, typeof value === 'string' ? value.slice(0, 4000) : value]));
  const [defaultTitle, defaultIntro] = templateCopy[templateName] || templateCopy.admin_notification;
  const title = data.title || defaultTitle;
  const intro = data.intro || defaultIntro;
  const baseUrl = String(process.env.FRONTEND_URL || 'https://hbe.lol').replace(/\/$/, '');
  const actionUrl = data.actionUrl && /^https?:\/\//i.test(data.actionUrl) ? data.actionUrl : `${baseUrl}${data.actionPath || '/linkup'}`;
  const actionLabel = data.actionLabel || (templateName.startsWith('distribution') ? 'View Release Dashboard' : 'View Booking');
  const logoUrl = `${baseUrl}/logo-160.png`;
  const rows = detailRows(data);
  const detailsHtml = rows.length ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:24px 0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden">${rows.map(([label, value]) => `<tr><td style="padding:11px 14px;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:13px;width:42%">${escapeHtml(label)}</td><td style="padding:11px 14px;border-bottom:1px solid #e2e8f0;color:#0f172a;font-size:13px;font-weight:700">${escapeHtml(value)}</td></tr>`).join('')}</table>` : '';
  const bankHtml = data.bankAccount ? `<div style="margin:20px 0;padding:16px;border-radius:12px;background:#f5f3ff;border:1px solid #ddd6fe"><strong style="color:#5b21b6">Bank transfer details</strong><p style="margin:9px 0 0;color:#334155;line-height:1.7;font-size:13px">${escapeHtml(data.bankAccount.bankName)}<br>${escapeHtml(data.bankAccount.accountHolderName)}<br>Account: ${escapeHtml(data.bankAccount.accountNumber)}${data.bankAccount.branchName ? `<br>Branch: ${escapeHtml(data.bankAccount.branchName)}` : ''}</p></div>` : '';
  const noteHtml = data.message ? `<div style="margin:20px 0;padding:15px;border-left:4px solid #7c3aed;background:#faf5ff;color:#4c1d95;font-size:13px;line-height:1.7">${escapeHtml(data.message)}</div>` : '';
  const html = `<!doctype html><html><body style="margin:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9"><tr><td align="center" style="padding:28px 12px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 14px 45px rgba(15,23,42,.12)"><tr><td style="padding:24px 30px;background:#100a27"><table role="presentation" width="100%"><tr><td><img src="${escapeHtml(logoUrl)}" width="52" height="52" alt="HBE Live" style="display:block"></td><td align="right"><span style="color:#c4b5fd;font-size:11px;font-weight:700;letter-spacing:2px">HBE LIVE</span></td></tr></table></td></tr><tr><td style="padding:34px 30px"><p style="margin:0 0 8px;color:#7c3aed;font-size:11px;font-weight:700;letter-spacing:1.8px;text-transform:uppercase">HoodBoy Entertainment</p><h1 style="margin:0;color:#0f172a;font-size:27px;line-height:1.25">${escapeHtml(title)}</h1><p style="margin:16px 0 0;color:#475569;font-size:15px;line-height:1.75">Hello ${escapeHtml(data.customerName || data.artistName || 'there')},<br>${escapeHtml(intro)}</p>${detailsHtml}${bankHtml}${noteHtml}${data.showAction === false ? '' : `<table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:24px"><tr><td style="border-radius:12px;background:#7c3aed"><a href="${escapeHtml(actionUrl)}" style="display:inline-block;padding:13px 22px;color:#fff;text-decoration:none;font-size:14px;font-weight:700">${escapeHtml(actionLabel)}</a></td></tr></table>`}</td></tr><tr><td style="padding:22px 30px;background:#f8fafc;border-top:1px solid #e2e8f0;color:#64748b;font-size:12px;line-height:1.6">Thank you for choosing HBE Live.<br><strong style="color:#334155">HBE Live Team</strong> · bookinghbelive@gmail.com${data.marketing ? `<br><a href="${baseUrl}/settings?section=notifications" style="color:#7c3aed">Manage email preferences</a>` : ''}</td></tr></table></td></tr></table></body></html>`;
  const text = [`HBE LIVE`, title, `Hello ${data.customerName || data.artistName || 'there'},`, intro, ...rows.map(([label, value]) => `${label}: ${value}`), data.message || '', `${actionLabel}: ${actionUrl}`, 'HBE Live Team · bookinghbelive@gmail.com'].filter(Boolean).join('\n\n');
  return { subject: data.subject || `${title} | HBE Live`, html, text };
};

module.exports = { renderEmail, escapeHtml };
