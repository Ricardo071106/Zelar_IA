function serializeAttendees(attendees) {
  if (!attendees?.length) return '';
  return attendees
    .map((email) => `&add=${encodeURIComponent(email)}`)
    .join('');
}

function serializeOutlookAttendees(attendees) {
  if (!attendees?.length) return '';
  return attendees
    .map((email) => `&to=${encodeURIComponent(email)}`)
    .join('');
}

function generateCalendarLinks(event) {
  const startDate = new Date(event.startDate);
  startDate.setHours(event.hour, event.minute, 0, 0);

  const endDate = new Date(startDate);
  endDate.setHours(startDate.getHours() + 1);

  const formatDate = (date) => date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  const title = encodeURIComponent(event.title);
  const description = encodeURIComponent(event.description || '');
  const startFormatted = formatDate(startDate);
  const endFormatted = formatDate(endDate);
  const googleGuests = serializeAttendees(event.attendees);
  const outlookGuests = serializeOutlookAttendees(event.attendees);

  return {
    google: `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startFormatted}/${endFormatted}&details=${description}${googleGuests}`,
    outlook: `https://outlook.live.com/calendar/0/deeplink/compose?subject=${title}&startdt=${startFormatted}&enddt=${endFormatted}&body=${description}${outlookGuests}`,
    apple: `data:text/calendar;charset=utf8,BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
DTSTART:${startFormatted}
DTEND:${endFormatted}
SUMMARY:${event.title}
DESCRIPTION:${event.description || ''}
END:VEVENT
END:VCALENDAR`
  };
}

export { generateCalendarLinks };
export default generateCalendarLinks;

