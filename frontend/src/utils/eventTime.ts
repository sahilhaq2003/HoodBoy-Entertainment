type EventSchedule = { eventDate?: string | Date; startTime?: string; timeZone?: string };

export const formatEventSchedule = (event?: EventSchedule, includeTime = true) => {
  if (!event?.eventDate) return 'Date to be announced';
  const datePart = String(event.eventDate).slice(0, 10);
  const date = new Date(`${datePart}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return 'Date to be announced';
  const dateText = date.toLocaleDateString(undefined, { weekday:'short', month:'short', day:'numeric', year:'numeric', timeZone:'UTC' });
  if (!includeTime || !event.startTime) return dateText;
  const [hour, minute] = event.startTime.split(':').map(Number);
  const time = new Date(Date.UTC(2000, 0, 1, hour || 0, minute || 0));
  const timeText = time.toLocaleTimeString(undefined, { hour:'numeric', minute:'2-digit', timeZone:'UTC' });
  return `${dateText} · ${timeText} (${event.timeZone || 'UTC'})`;
};
