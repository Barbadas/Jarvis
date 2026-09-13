import { getToken } from './auth.js';

const BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';

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
    throw new Error(`gmail-api-${res.status}: ${body}`);
  }
  return res.status === 204 ? null : res.json();
}

function header(headers, name) {
  const h = headers?.find((x) => x.name.toLowerCase() === name.toLowerCase());
  return h ? h.value : '';
}

function decodeSubjectFrom(msg) {
  const headers = msg.payload?.headers || [];
  return {
    id: msg.id,
    threadId: msg.threadId,
    subject: header(headers, 'Subject') || '(sans objet)',
    from: header(headers, 'From') || '',
    date: header(headers, 'Date') || '',
    snippet: msg.snippet || '',
    isUnread: (msg.labelIds || []).includes('UNREAD'),
  };
}

/** List recent messages matching a Gmail search query. */
export async function listMessages({ query = 'in:inbox', maxResults = 20 } = {}) {
  const list = await api(`/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`);
  const ids = list.messages || [];
  const detailed = await Promise.all(
    ids.map((m) =>
      api(`/messages/${m.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`)
    )
  );
  return detailed.map(decodeSubjectFrom);
}

export function listUnread(maxResults = 20) {
  return listMessages({ query: 'in:inbox is:unread', maxResults });
}

export function listInbox(maxResults = 20) {
  return listMessages({ query: 'in:inbox', maxResults });
}

export async function markAsRead(id) {
  return api(`/messages/${id}/modify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ removeLabelIds: ['UNREAD'] }),
  });
}

export async function archiveMessage(id) {
  return api(`/messages/${id}/modify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ removeLabelIds: ['INBOX'] }),
  });
}

function toBase64Url(str) {
  return btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/** Send a plain-text email. */
export async function sendMessage({ to, subject, body }) {
  const raw = toBase64Url(
    `To: ${to}\r\nSubject: ${subject}\r\nContent-Type: text/plain; charset="UTF-8"\r\n\r\n${body}`
  );
  return api('/messages/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw }),
  });
}
