import { getToken } from './auth.js';

const BASE = 'https://www.googleapis.com/calendar/v3';

async function api(path, options = {}) {
  const token = getToken();
  if (!token) throw new Error('not-signed-in');
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`calendar-api-${res.status}: ${body}`);
  }
  return res.status === 204 ? null : res.json();
}

function simplify(ev) {
  const start = ev.start?.dateTime || ev.start?.date;
  const end = ev.end?.dateTime || ev.end?.date;
  return {
    id: ev.id,
    title: ev.summary || '(sans titre)',
    start,
    end,
    allDay: !ev.start?.dateTime,
    location: ev.location || '',
    htmlLink: ev.htmlLink,
  };
}

/** Events between two ISO dates on the primary calendar. */
export async function listEvents({ timeMin, timeMax, maxResults = 25 } = {}) {
  const params = new URLSearchParams({
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: String(maxResults),
    timeMin: timeMin || new Date().toISOString(),
  });
  if (timeMax) params.set('timeMax', timeMax);
  const data = await api(`/calendars/primary/events?${params.toString()}`);
  return (data.items || []).map(simplify);
}

export function listToday() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return listEvents({ timeMin: start.toISOString(), timeMax: end.toISOString(), maxResults: 50 });
}

export function listUpcoming(days = 7) {
  const end = new Date();
  end.setDate(end.getDate() + days);
  return listEvents({ timeMax: end.toISOString(), maxResults: 50 });
}

export async function createEvent({ title, start, end, location = '' }) {
  const body = {
    summary: title,
    location,
    start: { dateTime: new Date(start).toISOString() },
    end: { dateTime: new Date(end).toISOString() },
  };
  return api('/calendars/primary/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function deleteEvent(id) {
  return api(`/calendars/primary/events/${id}`, { method: 'DELETE' });
}
