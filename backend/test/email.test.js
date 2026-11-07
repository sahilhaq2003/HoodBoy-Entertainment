const test = require('node:test');
const assert = require('node:assert/strict');
const { renderEmail, escapeHtml } = require('../services/emailTemplates');
const { safeError } = require('../services/emailService');
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
