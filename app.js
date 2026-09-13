import * as Auth from './auth.js';
import * as Gmail from './gmail.js';
import * as Cal from './calendar.js';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const state = { tab: 'today', loading: false };

function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('show'), 2600);
}

function fmtTime(iso, allDay) {
  if (!iso) return '';
  if (allDay) return 'Journée';
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function fmtDayLabel(iso) {
  const d = new Date(iso);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  const sameDay = (a, b) => a.toDateString() === b.toDateString();
  if (sameDay(d, today)) return "Aujourd'hui";
  if (sameDay(d, tomorrow)) return 'Demain';
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

function shortFrom(from) {
  const m = from.match(/^"?([^"<]+)"?\s*<?/);
  return (m?.[1] || from).trim();
}

async function withGuard(fn) {
  try {
    return await fn();
  } catch (e) {
    console.error(e);
    if (String(e.message || '').includes('401')) {
      toast('Session expirée, reconnecte-toi.');
      Auth.signOut();
    } else {
      toast("Erreur réseau, réessaie.");
    }
    return null;
  }
}

// ---------- Views ----------

async function renderToday() {
  const root = $('#view-today');
  root.innerHTML = '<div class="spinner"></div>';

  const [events, unread] = await Promise.all([
    withGuard(() => Cal.listToday()),
    withGuard(() => Gmail.listUnread(5)),
  ]);

  let html = '<div class="section-title">Agenda du jour</div>';
  if (!events || events.length === 0) {
    html += '<div class="card empty">Rien de prévu aujourd\'hui 🎉</div>';
  } else {
    html += events.map(eventCard).join('');
  }

  html += '<div class="section-title">Mails non lus</div>';
  if (!unread || unread.length === 0) {
    html += '<div class="card empty">Boîte à jour, rien à lire.</div>';
  } else {
    html += unread.map(mailCard).join('');
  }

  root.innerHTML = html;
  bindMailCards(root);
}

function eventCard(ev) {
  return `
    <div class="card event-row" data-id="${ev.id}">
      <div class="dot"></div>
      <div class="row-main">
        <div class="row-title">${escapeHtml(ev.title)}</div>
        ${ev.location ? `<div class="row-sub">${escapeHtml(ev.location)}</div>` : ''}
      </div>
      <div class="row-time">${fmtTime(ev.start, ev.allDay)}</div>
    </div>`;
}

function mailCard(m) {
  return `
    <div class="card mail-row ${m.isUnread ? 'unread' : ''}" data-id="${m.id}">
      <div class="dot"></div>
      <div class="row-main">
        <div class="row-title">${escapeHtml(shortFrom(m.from))}</div>
        <div class="row-sub">${escapeHtml(m.subject)}</div>
        <div class="row-snippet">${escapeHtml(m.snippet)}</div>
        <div class="swipe-actions">
          <button data-action="open">Ouvrir</button>
          ${m.isUnread ? '<button data-action="read">Marquer lu</button>' : ''}
          <button data-action="archive">Archiver</button>
        </div>
      </div>
    </div>`;
}

function bindMailCards(root) {
  root.querySelectorAll('.mail-row').forEach((row) => {
    const id = row.dataset.id;
    row.querySelectorAll('[data-action]').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const action = btn.dataset.action;
        if (action === 'open') {
          window.open(`https://mail.google.com/mail/u/0/#all/${id}`, '_blank');
        } else if (action === 'read') {
          await withGuard(() => Gmail.markAsRead(id));
          toast('Marqué comme lu');
          refresh();
        } else if (action === 'archive') {
          await withGuard(() => Gmail.archiveMessage(id));
          toast('Archivé');
          refresh();
        }
      });
    });
  });
}

async function renderMail() {
  const root = $('#view-mail');
  root.innerHTML = '<div class="spinner"></div>';
  const messages = await withGuard(() => Gmail.listInbox(25));
  if (!messages) return;
  root.innerHTML = messages.length
    ? messages.map(mailCard).join('')
    : '<div class="card empty">Boîte de réception vide.</div>';
  bindMailCards(root);
}

async function renderAgenda() {
  const root = $('#view-agenda');
  root.innerHTML = '<div class="spinner"></div>';
  const events = await withGuard(() => Cal.listUpcoming(14));
  if (!events) return;
  if (!events.length) {
    root.innerHTML = '<div class="card empty">Aucun événement à venir.</div>';
    return;
  }
  let lastDay = '';
  let html = '';
  for (const ev of events) {
    const day = fmtDayLabel(ev.start);
    if (day !== lastDay) {
      html += `<div class="section-title">${day}</div>`;
      lastDay = day;
    }
    html += `
      <div class="card event-row" data-id="${ev.id}">
        <div class="dot"></div>
        <div class="row-main">
          <div class="row-title">${escapeHtml(ev.title)}</div>
          ${ev.location ? `<div class="row-sub">${escapeHtml(ev.location)}</div>` : ''}
          <div class="swipe-actions">
            <button data-action="delete">Supprimer</button>
          </div>
        </div>
        <div class="row-time">${fmtTime(ev.start, ev.allDay)}</div>
      </div>`;
  }
  root.innerHTML = html;
  root.querySelectorAll('.event-row [data-action="delete"]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.closest('.event-row').dataset.id;
      await withGuard(() => Cal.deleteEvent(id));
      toast('Événement supprimé');
      refresh();
    });
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

// ---------- Navigation ----------

function switchTab(tab) {
  state.tab = tab;
  $$('.view').forEach((v) => v.classList.toggle('active', v.id === `view-${tab}`));
  $$('nav.tabbar button').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  $('#fab').hidden = tab === 'today';
  refresh();
}

function refresh() {
  if (!Auth.isSignedIn()) return;
  if (state.tab === 'today') renderToday();
  else if (state.tab === 'mail') renderMail();
  else if (state.tab === 'agenda') renderAgenda();
}

// ---------- Auth gate ----------

function renderGate() {
  const app = $('#app-content');
  if (!Auth.isConfigured()) {
    app.innerHTML = `
      <div class="gate">
        <div class="orb-big"></div>
        <h2>Configuration requise</h2>
        <p>Ajoute ton identifiant client Google OAuth dans <code>config.js</code> pour connecter Jarvis à ton compte Gmail et Google Agenda.</p>
      </div>`;
    return;
  }
  app.innerHTML = `
    <div class="gate">
      <div class="orb-big"></div>
      <h2>Jarvis</h2>
      <p>Connecte ton compte Google pour voir tes mails et ton agenda au même endroit.</p>
      <button class="btn primary" id="signin-btn">Se connecter avec Google</button>
    </div>`;
  $('#signin-btn').addEventListener('click', () => Auth.signIn());
}

function renderShell() {
  $('#app-content').innerHTML = `
    <header class="topbar">
      <h1><span class="orb"></span> Jarvis</h1>
      <div>
        <button class="icon-btn" id="refresh-btn" title="Actualiser">⟳</button>
        <button class="icon-btn" id="logout-btn" title="Se déconnecter">⏻</button>
      </div>
    </header>
    <main>
      <section id="view-today" class="view active"></section>
      <section id="view-mail" class="view"></section>
      <section id="view-agenda" class="view"></section>
    </main>
    <button class="fab" id="fab" hidden>+</button>
    <nav class="tabbar">
      <button data-tab="today" class="active"><span class="tab-icon">🏠</span>Aujourd'hui</button>
      <button data-tab="mail"><span class="tab-icon">✉️</span>Mail</button>
      <button data-tab="agenda"><span class="tab-icon">📅</span>Agenda</button>
    </nav>
    <div id="toast" class="toast"></div>
    ${modalTemplate()}
  `;

  $$('nav.tabbar button').forEach((b) => b.addEventListener('click', () => switchTab(b.dataset.tab)));
  $('#refresh-btn').addEventListener('click', refresh);
  $('#logout-btn').addEventListener('click', () => {
    Auth.signOut();
  });
  $('#fab').addEventListener('click', openEventModal);
  bindModal();
  switchTab('today');
}

function modalTemplate() {
  return `
    <div class="modal-backdrop" id="modal-backdrop" hidden>
      <div class="modal">
        <h2>Nouvel événement</h2>
        <div class="field">
          <label>Titre</label>
          <input id="ev-title" type="text" placeholder="Rendez-vous...">
        </div>
        <div class="field">
          <label>Début</label>
          <input id="ev-start" type="datetime-local">
        </div>
        <div class="field">
          <label>Fin</label>
          <input id="ev-end" type="datetime-local">
        </div>
        <div class="field">
          <label>Lieu (optionnel)</label>
          <input id="ev-location" type="text" placeholder="Adresse ou lien visio">
        </div>
        <div class="modal-actions">
          <button class="btn" id="ev-cancel">Annuler</button>
          <button class="btn primary" id="ev-save">Créer</button>
        </div>
      </div>
    </div>`;
}

function toLocalInputValue(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function openEventModal() {
  const start = new Date();
  start.setMinutes(0, 0, 0);
  start.setHours(start.getHours() + 1);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  $('#ev-title').value = '';
  $('#ev-location').value = '';
  $('#ev-start').value = toLocalInputValue(start);
  $('#ev-end').value = toLocalInputValue(end);
  $('#modal-backdrop').hidden = false;
}

function bindModal() {
  $('#ev-cancel').addEventListener('click', () => ($('#modal-backdrop').hidden = true));
  $('#modal-backdrop').addEventListener('click', (e) => {
    if (e.target.id === 'modal-backdrop') $('#modal-backdrop').hidden = true;
  });
  $('#ev-save').addEventListener('click', async () => {
    const title = $('#ev-title').value.trim();
    const start = $('#ev-start').value;
    const end = $('#ev-end').value;
    if (!title || !start || !end) {
      toast('Titre, début et fin sont requis');
      return;
    }
    const btn = $('#ev-save');
    btn.disabled = true;
    const result = await withGuard(() =>
      Cal.createEvent({ title, start, end, location: $('#ev-location').value.trim() })
    );
    btn.disabled = false;
    if (result) {
      $('#modal-backdrop').hidden = true;
      toast('Événement créé');
      switchTab('agenda');
    }
  });
}

// ---------- Bootstrap ----------

async function boot() {
  if (Auth.isConfigured()) {
    await Auth.loadGis().catch(() => toast('Impossible de charger Google Identity Services'));
  }
  Auth.onAuthChange((signedIn) => {
    if (signedIn) renderShell();
    else renderGate();
  });
  Auth.isSignedIn() ? renderShell() : renderGate();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

boot();
