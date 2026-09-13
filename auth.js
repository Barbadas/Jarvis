import { GOOGLE_CLIENT_ID, SCOPES } from './config.js';

const STORAGE_KEY = 'jarvis.auth';
let tokenClient = null;
let listeners = [];
let state = load();

function load() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : { token: null, expiresAt: 0 };
  } catch {
    return { token: null, expiresAt: 0 };
  }
}

function persist() {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function notify() {
  listeners.forEach((fn) => fn(isSignedIn()));
}

export function onAuthChange(fn) {
  listeners.push(fn);
}

export function isConfigured() {
  return !GOOGLE_CLIENT_ID.startsWith('REMPLACE_MOI');
}

export function isSignedIn() {
  return !!state.token && Date.now() < state.expiresAt;
}

export function getToken() {
  return isSignedIn() ? state.token : null;
}

function ensureTokenClient() {
  if (tokenClient) return tokenClient;
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: SCOPES,
    callback: (resp) => {
      if (resp.error) {
        console.error('Auth error', resp);
        notify();
        return;
      }
      state = {
        token: resp.access_token,
        expiresAt: Date.now() + (resp.expires_in - 60) * 1000,
      };
      persist();
      notify();
    },
  });
  return tokenClient;
}

export function signIn() {
  const client = ensureTokenClient();
  client.requestAccessToken({ prompt: state.token ? '' : 'consent' });
}

export function signOut() {
  const token = state.token;
  state = { token: null, expiresAt: 0 };
  persist();
  if (token && window.google) {
    google.accounts.oauth2.revoke(token, () => {});
  }
  notify();
}

/** Load the Google Identity Services script once. */
export function loadGis() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) return resolve();
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}
