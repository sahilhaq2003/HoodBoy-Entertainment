const validTimeZone = value => {
  try { new Intl.DateTimeFormat('en-US', { timeZone: String(value) }).format(); return true; }
  catch { return false; }
};

const calendarDateInZone = (timeZone, instant = new Date()) => {
  const zone = validTimeZone(timeZone) ? timeZone : 'UTC';
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(instant).filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
};

const eventStartInstant = event => {
  if (!event?.eventDate) return null;
  const date = new Date(event.eventDate);
  if (Number.isNaN(date.getTime())) return null;
  const calendar = date.toISOString().slice(0, 10);
  const [year, month, day] = calendar.split('-').map(Number);
  const [hour = 0, minute = 0] = String(event.startTime || '00:00').split(':').map(Number);
  const timeZone = validTimeZone(event.timeZone) ? event.timeZone : 'UTC';
  const localAsUtc = Date.UTC(year, month - 1, day, hour, minute);
  const formatter = new Intl.DateTimeFormat('en-US', { timeZone, year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit', hourCycle:'h23' });
  const offsetAt = instant => {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(instant)).filter(part => part.type !== 'literal').map(part => [part.type, Number(part.value)]));
    return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) - instant;
  };
  let instant = localAsUtc - offsetAt(localAsUtc);
  instant = localAsUtc - offsetAt(instant);
  return new Date(instant);
};

const formatEventDate = event => {
  const instant = eventStartInstant(event);
  const timeZone = validTimeZone(event?.timeZone) ? event.timeZone : 'UTC';
  if (!instant) return 'To be announced';
  return `${new Intl.DateTimeFormat('en-US', { timeZone, dateStyle:'medium', ...(event?.startTime ? { timeStyle:'short' } : {}) }).format(instant)} (${timeZone})`;
};

module.exports = { validTimeZone, calendarDateInZone, eventStartInstant, formatEventDate };
