const test = require('node:test');
const assert = require('node:assert/strict');
const { renderEmail, escapeHtml } = require('../services/emailTemplates');
const { safeError, _withoutCustomerEntryPass } = require('../services/emailService');
const { calendarDateInZone, eventStartInstant, formatEventDate, validTimeZone } = require('../lib/eventTime');

test('HBE email templates render responsive HTML and plain-text alternatives safely', () => {
  const rendered = renderEmail('booking_confirmed', {
    customerName: '<script>alert(1)</script>',
    bookingReference: 'LNK-TEST-1',
    eventName: 'HBE Live Night',
    totalAmount: 262.5,
    currency: 'USD',
  });
  assert.match(rendered.subject, /booking is confirmed/i);
  assert.match(rendered.html, /HBE LIVE/);
  assert.match(rendered.html, /&lt;script&gt;/);
  assert.doesNotMatch(rendered.html, /<script>alert/);
  assert.match(rendered.text, /LNK-TEST-1/);
  assert.match(rendered.text, /USD 262\.50/);
});

test('email template HTML escaping covers user-controlled characters', () => {
  assert.equal(escapeHtml(`<&>"'`), '&lt;&amp;&gt;&quot;&#39;');
});

test('approved booking email includes the secure QR entry pass', () => {
  const rendered = renderEmail('payment_approved', {
    customerName: 'Guest', bookingReference: 'LNK-QR-1',
    entryQrUrl: 'https://api.hbe.lol/api/lnk-up/public/entry-pass/signed-token/qr',
  });
  assert.match(rendered.html, /secure event entry pass/i);
  assert.match(rendered.html, /Booking entry QR code/);
  assert.match(rendered.html, /signed-token\/qr/);
  assert.match(rendered.text, /secure entry QR code/i);
});

test('administrator booking emails never include the customer entry QR pass', () => {
  const adminData = _withoutCustomerEntryPass({
    customerName: 'Guest', bookingReference: 'LNK-QR-ADMIN', entryPassReady: true,
    entryQrUrl: 'https://api.hbe.lol/api/lnk-up/public/entry-pass/private-token/qr',
  });
  const rendered = renderEmail('admin_notification', adminData);
  assert.equal(adminData.entryQrUrl, undefined);
  assert.equal(adminData.entryPassReady, undefined);
  assert.doesNotMatch(rendered.html, /private-token|Booking entry QR code|secure event entry pass/i);
  assert.doesNotMatch(rendered.text, /secure entry QR code/i);
  assert.match(rendered.html, /LNK-QR-ADMIN/);
});

test('email errors redact credential-like values before logging or API responses', () => {
  const message = safeError(new Error('auth token=super-secret password=hunter2 failed'));
  assert.doesNotMatch(message, /super-secret|hunter2/);
  assert.match(message, /\[redacted\]/);
});

test('event schedule converts venue-local time to the correct global instant with daylight saving', () => {
  const event = { eventDate: '2027-07-15', startTime: '19:30', timeZone: 'America/New_York' };
  assert.equal(eventStartInstant(event).toISOString(), '2027-07-15T23:30:00.000Z');
  assert.match(formatEventDate(event), /Jul 15, 2027/);
  assert.match(formatEventDate(event), /America\/New_York/);
});

test('event schedule supports half-hour offsets and rejects invalid zones', () => {
  const event = { eventDate: '2027-07-15', startTime: '19:30', timeZone: 'Asia/Colombo' };
  assert.equal(eventStartInstant(event).toISOString(), '2027-07-15T14:00:00.000Z');
  assert.equal(validTimeZone('Not/A_Zone'), false);
  assert.equal(validTimeZone('UTC'), true);
  assert.equal(calendarDateInZone('Pacific/Auckland', new Date('2027-07-15T12:30:00Z')), '2027-07-16');
});
