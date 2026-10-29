/* CRM RTM — prototype local (vanilla JS, aucune dépendance).
 * Modules : Tableau de bord · Affaires (pipeline, liste, prévisions) · Projets (tableau, liste, chronologie)
 * · Activités · Organisations · Personnes. Données fictives (js/data.js), modifications gardées dans localStorage. */
(function () {
  'use strict';

  /* ———————————————————— Données ———————————————————— */
  const STORE = 'crm-rtm-proto-v1';
  const clone = (o) => JSON.parse(JSON.stringify(o));
  let db;
  try { db = JSON.parse(localStorage.getItem(STORE)) || null; } catch (e) { db = null; }
  if (!db || db.v !== 1) db = Object.assign({ v: 1 }, clone(window.CRM_SEED));
  const save = () => { try { localStorage.setItem(STORE, JSON.stringify(db)); } catch (e) { /* mode privé */ } };

  let prefs = { pipelineId: 1, owner: 0, dealView: 'pipeline', dealStatus: 'open', boardId: 1, projView: 'tableau', actFilter: 'todo', contactsView: 'organisations', theme: 'auto' };
  try { prefs = Object.assign(prefs, JSON.parse(localStorage.getItem(STORE + '-prefs')) || {}); } catch (e) { /* ignore */ }
  const savePrefs = () => { try { localStorage.setItem(STORE + '-prefs', JSON.stringify(prefs)); } catch (e) { /* ignore */ } };

  const TODAY = db.TODAY;
  const T0 = new Date(TODAY + 'T12:00:00');
  const DAY = 86400000;
  const daysFrom = (iso) => Math.round((new Date(iso + 'T12:00:00') - T0) / DAY);
  const isoAdd = (n) => { const d = new Date(T0.getTime() + n * DAY); return d.toISOString().slice(0, 10); };

  const byId = (arr) => { const m = new Map(); arr.forEach((x) => m.set(x.id, x)); return m; };
  const user = (id) => db.users.find((u) => u.id === id) || db.users[0];
  const org = (id) => db.orgs.find((o) => o.id === id);
  const person = (id) => db.persons.find((p) => p.id === id);
  const deal = (id) => db.deals.find((d) => d.id === id);
  const project = (id) => db.projects.find((p) => p.id === id);
  const pipeline = (id) => db.pipelines.find((p) => p.id === id);
  const board = (id) => db.boards.find((b) => b.id === id);
  const stageOf = (d) => { const p = pipeline(d.pipelineId); return p.stages.find((s) => s.id === d.stageId) || p.stages[0]; };
  const stageIdx = (d) => pipeline(d.pipelineId).stages.findIndex((s) => s.id === d.stageId);

  /* ———————————————————— Formatage ———————————————————— */
  const nf = new Intl.NumberFormat('fr-CA', { maximumFractionDigits: 0 });
  const money = (v) => `${nf.format(Math.round(v))} $`;
  const moneyC = (v) => {
    const a = Math.abs(v);
    if (a >= 1e6) return `${(v / 1e6).toLocaleString('fr-CA', { maximumFractionDigits: a >= 1e7 ? 0 : 2, minimumFractionDigits: 0 })} M$`;
    if (a >= 1e4) return `${nf.format(Math.round(v / 1e3))} k$`;
    return money(v);
  };
  const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  const MOIS_L = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const dShort = (iso) => { const d = new Date(iso + 'T12:00:00'); return `${d.getDate()} ${MOIS[d.getMonth()]}`; };
  const dLong = (iso) => { const d = new Date(iso + 'T12:00:00'); return `${d.getDate()} ${MOIS_L[d.getMonth()]} ${d.getFullYear()}`; };
  const rel = (iso) => {
    const n = daysFrom(iso);
    if (n === 0) return 'Aujourd’hui';
    if (n === 1) return 'Demain';
    if (n === -1) return 'Hier';
    if (n < 0 && n > -14) return `Il y a ${-n} j`;
    if (n > 0 && n < 7) return `Dans ${n} j`;
    const d = new Date(iso + 'T12:00:00');
    return d.getFullYear() === T0.getFullYear() ? dShort(iso) : `${dShort(iso)} ${d.getFullYear()}`;
  };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const initials = (name) => name.split(/[\s-]+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  const hueOf = (s) => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
  const avatar = (u, cls = '') => `<span class="avatar ${cls}" style="--h:${u.hue}" title="${esc(u.name)}">${u.initials}</span>`;
  const orgAvatar = (o, cls = '') => `<span class="avatar sq ${cls}" style="--h:${hueOf(o.name)}">${initials(o.name.replace(/^(CHSLD|CLSC|Hôpital|Résidence|Centre|Maison des Aînés|Institut)( de| d’| des| du)?\s/i, ''))}</span>`;
  const plural = (n, s, p) => `${nf.format(n)} ${n > 1 ? (p || s + 's') : s}`;

  /* ———————————————————— Icônes (esprit SF Symbols) ———————————————————— */
  const P = {
    dash: '<rect x="3" y="3" width="7.5" height="9" rx="2"/><rect x="13.5" y="3" width="7.5" height="5.5" rx="2"/><rect x="13.5" y="11.5" width="7.5" height="9.5" rx="2"/><rect x="3" y="15" width="7.5" height="6" rx="2"/>',
    deal: '<circle cx="12" cy="12" r="9"/><path d="M14.8 9.3c-.5-1-1.6-1.6-2.8-1.6-1.6 0-2.8.9-2.8 2.1 0 3 5.6 1.5 5.6 4.4 0 1.3-1.2 2.2-2.8 2.2-1.3 0-2.4-.6-2.9-1.7M12 6v1.6M12 16.4V18"/>',
    proj: '<rect x="4" y="4" width="16" height="17" rx="3"/><path d="M9 4V2.8h6V4M8.5 11l2 2 4-4M8.5 17h7"/>',
    cal: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    org: '<path d="M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16M16 9h2a2 2 0 0 1 2 2v10M3 21h18M8 7h4M8 11h4M8 15h4"/>',
    person: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5c1.2-3.6 4-5.5 7.5-5.5s6.3 1.9 7.5 5.5"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    down: '<path d="m6 9 6 6 6-6"/>',
    right: '<path d="m9 6 6 6-6 6"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 7 8 6 8-6"/>',
    meet: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.2 3.3-5 6.5-5s5.7 1.8 6.5 5M16 4.5a3.5 3.5 0 0 1 0 7M18 15c2 .6 3.2 2.4 3.6 5"/>',
    flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
    pin: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    warn: '<path d="M12 4 2.8 19.5h18.4z"/><path d="M12 10v4M12 17h.01"/>',
    trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 21h8M9.5 17h5"/>',
    trend: '<path d="M4 19h16M6 15l4-4 3 3 6-6M15 8h4v4"/>',
    cash: '<rect x="2.5" y="6" width="19" height="12" rx="3"/><circle cx="12" cy="12" r="2.5"/><path d="M6 9.5v5M18 9.5v5"/>',
    pct: '<path d="M19 5 5 19"/><circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/>',
    moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    auto: '<circle cx="12" cy="12" r="9"/><path d="M12 3v18" /><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor"/>',
    more: '<circle cx="5" cy="12" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="19" cy="12" r="1.4" fill="currentColor"/>',
    cols: '<rect x="3" y="4" width="5" height="16" rx="1.5"/><rect x="10" y="4" width="5" height="11" rx="1.5"/><rect x="17" y="4" width="4" height="7" rx="1.5"/>',
    list: '<path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01"/>',
    gantt: '<path d="M4 6h9M8 12h11M6 18h8"/>',
    fc: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4M8 14.5h3M13 14.5h3M8 17.5h3"/>',
    sync: '<path d="M20 11a8 8 0 0 0-14.3-4.5L4 8.5M4 4v4.5h4.5M4 13a8 8 0 0 0 14.3 4.5l1.7-2M20 20v-4.5h-4.5"/>',
    note: '<path d="M5 4h14v11l-5 5H5z"/><path d="M14 20v-5h5"/>',
    doc: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/>',
    filter: '<path d="M4 6h16M7 12h10M10 18h4"/>',
    reset: '<path d="M4 4v5h5"/><path d="M5.5 15a7.5 7.5 0 1 0 1.3-7.8L4 9"/>',
    undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
    bolt: '<path d="M13 3 5 13.5h6L10 21l8-10.5h-6z"/>',
    send: '<path d="M4 12 20 4l-5 16-3-7z"/><path d="m12 13 8-9"/>',
  };
  const I = (n, cls = '') => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${P[n]}</svg>`;
  const ACT = { appel: ['phone', 'Appel'], reunion: ['meet', 'Réunion'], tache: ['flag', 'Tâche'], courriel: ['mail', 'Courriel'], visite: ['pin', 'Visite'] };

  /* ———————————————————— Calculs ———————————————————— */
  const ownerOk = (d) => !prefs.owner || d.ownerId === prefs.owner;
  const nextAct = (dealId) => db.activities.filter((a) => a.dealId === dealId && !a.done).sort((a, b) => (a.due < b.due ? -1 : 1))[0];
  const actState = (d) => {
    const a = nextAct(d.id);
    if (!a) return { k: 'none', a: null };
    const n = daysFrom(a.due);
    return { k: n < 0 ? 'late' : n === 0 ? 'today' : 'planned', a };
  };
  const rotDays = (d) => { const s = stageOf(d); const n = -daysFrom(d.stageChanged); return d.status === 'open' && n > s.rot ? n : 0; };
  const progress = (p) => { const n = p.tasks.filter((t) => t.done).length; return { n, N: p.tasks.length, r: p.tasks.length ? n / p.tasks.length : 0 }; };
  const sum = (arr, f) => arr.reduce((s, x) => s + f(x), 0);

  /* ———————————————————— Rendu : coquille ———————————————————— */
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const app = $('#app');

  const NAV = [
    { h: '#accueil', k: 'dash', l: 'Tableau de bord', i: 'dash' },
    { h: '#affaires', k: 'affaires', l: 'Affaires', i: 'deal', c: () => db.deals.filter((d) => d.status === 'open').length },
    { h: '#projets', k: 'projets', l: 'Projets', i: 'proj', c: () => db.projects.filter((p) => p.status === 'open').length },
    { h: '#activites', k: 'activites', l: 'Activités', i: 'cal', c: () => db.activities.filter((a) => !a.done && daysFrom(a.due) <= 0).length },
  ];
  const NAV2 = [
    { h: '#organisations', k: 'organisations', l: 'Organisations', i: 'org', c: () => db.orgs.length },
    { h: '#personnes', k: 'personnes', l: 'Personnes', i: 'person', c: () => db.persons.length },
  ];

  function shell() {
    const me = user(1);
    const themeIcon = prefs.theme === 'dark' ? 'moon' : prefs.theme === 'light' ? 'sun' : 'auto';
    app.innerHTML = `
      <aside class="side" aria-label="Navigation">
        <div class="brand">
          <span class="brand-mark"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg></span>
          <div><b>RTM Médical</b><span>CRM</span></div>
        </div>
        <nav class="nav" id="nav1"></nav>
        <div class="side-label">Contacts</div>
        <nav class="nav" id="nav2"></nav>
        <div class="side-foot">
          ${avatar(me)}
          <div class="who"><b>${esc(me.name)}</b><span>Administrateur</span></div>
          <button class="icon-btn" id="themeBtn" data-tip="Apparence">${I(themeIcon)}</button>
        </div>
      </aside>
      <div class="main">
        <header class="bar" id="bar">
          <div class="bar-title" id="barTitle"></div>
          <div class="spacer"></div>
          <label class="search" id="searchBox">${I('search')}<input id="q" type="search" placeholder="Rechercher" autocomplete="off" aria-label="Rechercher"><kbd>⌘K</kbd></label>
          <button class="icon-btn mobile-only" id="qMobile" aria-label="Rechercher">${I('search')}</button>
          <button class="icon-btn" id="moreBtn" aria-label="Plus">${I('more')}</button>
        </header>
        <main class="content" id="view" tabindex="-1"></main>
      </div>
      <nav class="tabbar" id="tabbar" aria-label="Navigation">
        ${[...NAV, NAV2[0]].map((n) => `<a href="${n.h}" data-k="${n.k}">${I(n.i)}<span>${n.k === 'dash' ? 'Accueil' : n.k === 'organisations' ? 'Contacts' : n.l}</span></a>`).join('')}
      </nav>
      <div class="tip" id="tip" role="tooltip"></div>
      <div class="toast" id="toast" role="status"></div>`;
    $('#themeBtn').onclick = (e) => themeMenu(e.currentTarget);
    $('#moreBtn').onclick = (e) => moreMenu(e.currentTarget);
    $('#qMobile').onclick = () => searchSheet();
    wireSearch();
  }

  function navRefresh(k) {
    const item = (n) => `<a href="${n.h}" ${n.k === k ? 'aria-current="page"' : ''}>${I(n.i)}<span class="lbl">${n.l}</span>${n.c ? `<span class="count">${n.c()}</span>` : ''}</a>`;
    $('#nav1').innerHTML = NAV.map(item).join('');
    $('#nav2').innerHTML = NAV2.map(item).join('');
    $$('#tabbar a').forEach((a) => {
      const on = a.dataset.k === k || (a.dataset.k === 'organisations' && k === 'personnes');
      a.toggleAttribute('aria-current', on);
      if (on) a.setAttribute('aria-current', 'page');
    });
  }

  function applyTheme() {
    if (prefs.theme === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', prefs.theme);
    const b = $('#themeBtn');
    if (b) b.innerHTML = I(prefs.theme === 'dark' ? 'moon' : prefs.theme === 'light' ? 'sun' : 'auto');
  }

  /* ———————————————————— Routeur ———————————————————— */
  const routes = { '': viewDash, accueil: viewDash, affaires: viewDeals, projets: viewProjects, activites: viewActivities, organisations: viewOrgs, personnes: viewPersons };
  let current = '';
  function route() {
    const h = location.hash.replace(/^#\/?/, '').split('?')[0];
    const k = routes[h] && h !== 'accueil' ? h : '';
    const changed = k !== current;
    current = k;
    navRefresh(k || 'dash');
    closePop();
    render();
    if (changed) window.scrollTo(0, 0);
  }
  function render() {
    const v = $('#view');
    v.classList.toggle('wide', current === 'affaires' || current === 'projets');
    routes[current]();
    navRefresh(current || 'dash');
    onScroll();
  }

  /* ———————————————————— Tableau de bord ———————————————————— */
  function viewDash() {
    const v = $('#view');
    const open = db.deals.filter((d) => d.status === 'open');
    const won = db.deals.filter((d) => d.status === 'won');
    const lost = db.deals.filter((d) => d.status === 'lost');
    const m0 = TODAY.slice(0, 7);
    const prevMonth = (() => { const d = new Date(T0); d.setDate(1); d.setMonth(d.getMonth() - 1); return d.toISOString().slice(0, 7); })();
    const dayOfMonth = T0.getDate();
    const wonM = won.filter((d) => d.closeDate.slice(0, 7) === m0);
    // Même temps écoulé le mois précédent : du 1er au même quantième.
    const wonPrevSame = won.filter((d) => d.closeDate.slice(0, 7) === prevMonth && +d.closeDate.slice(8) <= dayOfMonth);
    const wonMv = sum(wonM, (d) => d.value), wonPv = sum(wonPrevSame, (d) => d.value);
    const in90 = (d, a, b) => { const n = -daysFrom(d.closeDate); return n >= a && n < b; };
    const w90 = won.filter((d) => in90(d, 0, 90)).length, l90 = lost.filter((d) => in90(d, 0, 90)).length;
    const w180 = won.filter((d) => in90(d, 90, 180)).length, l180 = lost.filter((d) => in90(d, 90, 180)).length;
    const conv = w90 / Math.max(1, w90 + l90), convP = w180 / Math.max(1, w180 + l180);
    const late = db.activities.filter((a) => !a.done && daysFrom(a.due) < 0);
    const todayActs = db.activities.filter((a) => !a.done && daysFrom(a.due) === 0);
    const openV = sum(open, (d) => d.value);
    const newOpen30 = open.filter((d) => -daysFrom(d.created) <= 30);

    // 12 derniers mois de ventes gagnées
    const months = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(T0); d.setDate(1); d.setMonth(d.getMonth() - i);
      const key = d.toISOString().slice(0, 7);
      const ds = won.filter((x) => x.closeDate.slice(0, 7) === key);
      months.push({ key, m: d.getMonth(), y: d.getFullYear(), v: sum(ds, (x) => x.value), n: ds.length, partial: i === 0 });
    }
    const yearV = sum(months, (m) => m.v);
    const best = months.reduce((a, b) => (b.v > a.v ? b : a));

    const delta = (cur, prev, base) => {
      if (prev < (base || 1)) return `<span class="flat">—</span>`;
      const p = Math.round(((cur - prev) / prev) * 100);
      if (p === 0) return `<span class="flat">±0 %</span>`;
      return `<span class="${p > 0 ? 'up' : 'down'}">${p > 0 ? '▲' : '▼'} ${Math.abs(p)} %</span>`;
    };
    const ptsDelta = (c, p) => { const d = Math.round((c - p) * 100); return Math.abs(d) < 3 ? `<span class="flat">${d === 0 ? '±0' : (d > 0 ? '+' : '−') + Math.abs(d)} pt${Math.abs(d) > 1 ? 's' : ''}</span>` : d === 0 ? '<span class="flat">±0 pt</span>' : `<span class="${d > 0 ? 'up' : 'down'}">${d > 0 ? '▲' : '▼'} ${Math.abs(d)} pt${Math.abs(d) > 1 ? 's' : ''}</span>`; };
    const spark = (vals) => {
      const max = Math.max(...vals, 1), w = 84, h = 30;
      const pts = vals.map((x, i) => [i * (w / (vals.length - 1)), h - 3 - (x / max) * (h - 6)]);
      const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('');
      return `<svg class="spark" viewBox="0 0 ${w} ${h}"><path d="${d}L${w},${h}L0,${h}Z" fill="color-mix(in srgb, var(--money) 12%, transparent)"/><path d="${d}" fill="none" stroke="var(--money)" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
    };

    const todo = db.activities.filter((a) => !a.done && daysFrom(a.due) <= 1).sort((a, b) => (a.due < b.due ? -1 : 1)).slice(0, 7);
    const rotten = open.filter((d) => rotDays(d)).sort((a, b) => rotDays(b) - rotDays(a));
    const plVente = pipeline(prefs.pipelineId) || db.pipelines[0];
    const plOpen = open.filter((d) => d.pipelineId === plVente.id);
    const plMax = Math.max(...plVente.stages.map((s) => sum(plOpen.filter((d) => d.stageId === s.id), (d) => d.value)), 1);
    const projs = db.projects.filter((p) => p.status === 'open').sort((a, b) => (a.health === 'risque' ? -1 : 0) - (b.health === 'risque' ? -1 : 0) || (a.end < b.end ? -1 : 1)).slice(0, 6);

    const greet = T0.getHours() < 12 ? 'Bonjour' : 'Bonjour';
    v.innerHTML = `
      <div class="page-head">
        <div><h1>${greet}, ${esc(user(1).short)}</h1><div class="sub">${cap(new Intl.DateTimeFormat('fr-CA', { weekday: 'long', day: 'numeric', month: 'long' }).format(T0))}</div></div>
        <div class="tools">
          <span class="pill hide-sm" data-tip="Données fictives — prototype local"><span class="dot"></span>À jour</span>
        </div>
      </div>
      <section class="kpis">
        <a class="card kpi" href="#affaires" data-tip="${plural(open.length, 'affaire ouverte', 'affaires ouvertes')} · ${money(openV)}">
          <div class="lbl">Pipeline ouvert <span class="ico">${I('deal')}</span></div>
          <div class="val">${moneyC(openV).replace(/ (k\$|M\$|\$)$/, '<small> $1</small>')}</div>
          <div class="delta">${plural(open.length, 'affaire')}<span class="hide-sm">· +${newOpen30.length} en 30 j</span></div>
        </a>
        <div class="card kpi" data-tip="${money(wonMv)} gagnés en octobre au ${dayOfMonth} · ${money(wonPv)} au même jour en septembre">
          <div class="lbl">Gagné ce mois</div>
          <div class="val" style="color:var(--money)">${moneyC(wonMv).replace(/ (k\$|M\$|\$)$/, '<small> $1</small>')}</div>
          <div class="delta">${delta(wonMv, wonPv, 5000)} vs sept.</div>
          ${spark(months.slice(-6).map((m) => m.v))}
        </div>
        <div class="card kpi" data-tip="${w90} gagnées · ${l90} perdues (90 derniers jours)">
          <div class="lbl">Taux de conclusion <span class="ico">${I('pct')}</span></div>
          <div class="val">${Math.round(conv * 100)}<small> %</small></div>
          <div class="delta">${ptsDelta(conv, convP)} vs 90 j préc.</div>
        </div>
        <a class="card kpi" href="#activites" data-tip="Activités planifiées non faites">
          <div class="lbl">Activités en retard <span class="ico" style="${late.length ? 'background:color-mix(in srgb,var(--danger-fill) 12%,transparent);color:var(--danger)' : ''}">${I('clock')}</span></div>
          <div class="val" style="${late.length ? 'color:var(--danger)' : ''}">${late.length}</div>
          <div class="delta">${todayActs.length} aujourd’hui</div>
        </a>
      </section>

      <section class="grid-2">
        <div class="card">
          <div class="card-head"><div><div class="meta">Ventes gagnées · 12 mois</div><h2 style="font-size:24px;letter-spacing:-.025em;margin-top:2px" class="num">${money(yearV)}</h2></div>
            <div class="end legend hide-sm"><span><i style="background:color-mix(in srgb,var(--money) 28%,transparent);box-shadow:inset 0 2px 0 var(--money)"></i>Gagné</span><span><i style="border:1.5px dashed var(--ink-4);background:none"></i>Mois en cours</span></div></div>
          <div class="card-body">
            <div class="chart" id="chWon"></div>
            <div class="chart-sum">
              <div><span>Moyenne / mois</span><b>${moneyC(yearV / 12)}</b></div>
              <div><span>Meilleur mois</span><b>${cap(MOIS[best.m])} ${best.y}</b></div>
              <div><span>Affaires gagnées</span><b>${sum(months, (m) => m.n)}</b></div>
            </div>
          </div>
        </div>
        <div class="card">
          <div class="card-head"><h2>À faire</h2><span class="meta">${late.length ? `<span class="badge danger">${late.length} en retard</span>` : ''}</span><div class="end"><a class="btn plain" href="#activites">Tout voir</a></div></div>
          <div class="card-body" style="padding-top:2px">
            <ul class="rows" id="todo">${todo.map(actRow).join('') || '<li class="empty" style="display:block"><b>Rien à faire</b>Les activités planifiées apparaissent ici.</li>'}</ul>
          </div>
        </div>
      </section>

      <section class="grid-3">
        <div class="card">
          <div class="card-head"><h2>Pipeline</h2><div class="end"><button class="pill" id="dPl" style="height:28px;font-size:13px">${esc(plVente.name)} ${I('down', 'chev')}</button></div></div>
          <div class="card-body"><ul class="rank">
            ${plVente.stages.map((s) => { const ds = plOpen.filter((d) => d.stageId === s.id); const val = sum(ds, (d) => d.value); return `<li data-href="#affaires" data-tip="${esc(s.name)} · ${plural(ds.length, 'affaire')} · ${money(val)}"><span class="rk-name">${esc(s.name)}</span><span class="rk-n">${ds.length}</span><span class="rk-v">${moneyC(val)}</span><span class="track"><i style="width:${(val / plMax) * 100}%"></i></span></li>`; }).join('')}
          </ul></div>
        </div>
        <div class="card">
          <div class="card-head"><h2>Affaires inactives</h2>${rotten.length ? `<span class="badge danger">${rotten.length}</span>` : ''}</div>
          <div class="card-body" style="padding-top:2px"><ul class="rows">
            ${rotten.slice(0, 6).map((d) => `<li data-deal="${d.id}">${orgAvatar(org(d.orgId), 'lg')}<div class="r-main"><b>${esc(d.title)}</b><span>${esc(stageOf(d).name)} · ${esc(org(d.orgId).name)}</span></div><div class="r-end late">${rotDays(d)} j</div></li>`).join('') || '<li class="empty" style="display:block"><b>Tout bouge</b>Aucune affaire au-delà du délai de son étape.</li>'}
          </ul></div>
        </div>
        <div class="card">
          <div class="card-head"><h2>Projets en cours</h2><div class="end"><a class="btn plain" href="#projets">Tout voir</a></div></div>
          <div class="card-body" style="padding-top:2px"><ul class="rows">
            ${projs.map((p) => { const pr = progress(p); const ln = daysFrom(p.end) < 0; return `<li data-proj="${p.id}">${ringSvg(pr.r, 32)}<div class="r-main"><b>${esc(p.title)}</b><span>${esc(board(p.boardId).phases.find((f) => f.id === p.phaseId).name)} · ${pr.n}/${pr.N} tâches</span></div><div class="r-end ${ln ? 'late' : ''}">${ln ? 'En retard' : rel(p.end)}</div></li>`; }).join('')}
          </ul></div>
        </div>
      </section>`;

    barChart($('#chWon'), months);
    $('#dPl').onclick = (e) => pipelineMenu(e.currentTarget, () => render());
    bindRows(v);
  }
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  function ringSvg(r, size = 18) {
    const R = 7.5, C = 2 * Math.PI * R;
    return `<svg class="ring ${r >= 1 ? 'done' : ''}" viewBox="0 0 18 18" style="width:${size}px;height:${size}px"><circle class="bg" cx="9" cy="9" r="${R}" ${size > 24 ? 'stroke-width="2.4"' : ''}/><circle class="fg" cx="9" cy="9" r="${R}" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - r)}" ${size > 24 ? 'stroke-width="2.4"' : ''}/></svg>`;
  }

  function actRow(a) {
    const d = deal(a.dealId);
    const n = daysFrom(a.due);
    return `<li data-deal="${a.dealId}" data-act="${a.id}">
      <button class="check ${a.done ? 'on' : ''}" data-done="${a.id}" aria-label="Marquer comme fait"><svg viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg></button>
      <div class="r-main"><b>${esc(a.subject)}</b><span>${ACT[a.type][1]} · ${esc(d ? org(d.orgId).name : '')}</span></div>
      <div class="r-end ${n < 0 && !a.done ? 'late' : ''}">${rel(a.due)}<br><span style="color:var(--ink-3);font-weight:400">${a.time}</span></div>
    </li>`;
  }

  function barChart(el, months) {
    const W = el.clientWidth || 600, H = el.clientHeight || 230, padL = 8, padR = 44, padT = 10, padB = 26;
    const max = Math.max(...months.map((m) => m.v), 1);
    const ticks = niceTicks(max, 4);
    const top = ticks[ticks.length - 1];
    const cw = (W - padL - padR) / months.length;
    const bw = Math.min(34, cw * 0.62);
    const y = (v) => padT + (H - padT - padB) * (1 - v / top);
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Ventes gagnées par mois">`;
    ticks.forEach((t) => { s += `<line class="grid" x1="${padL}" x2="${W - padR + 6}" y1="${y(t)}" y2="${y(t)}"/><text class="axis" x="${W - padR + 12}" y="${y(t) + 4}">${t === 0 ? '0' : moneyC(t)}</text>`; });
    months.forEach((m, i) => {
      const x = padL + i * cw + (cw - bw) / 2;
      const yy = y(m.v), h = Math.max(0, H - padB - yy);
      const r = Math.min(7, bw / 2);
      const tip = `data-tip-b="${money(m.v)}" data-tip-s="${cap(MOIS_L[m.m])} ${m.y} · ${plural(m.n, 'affaire')}${m.partial ? ' · mois en cours' : ''}"`;
      s += `<g class="bcol" ${tip}><rect class="hit" x="${padL + i * cw}" y="${padT}" width="${cw}" height="${H - padT - padB}"/>`;
      s += `<rect class="colring" x="${x - 4}" y="${padT - 2}" width="${bw + 8}" height="${H - padT - padB + 4}" rx="10" fill="none" stroke="transparent" stroke-width="1"/>`;
      if (m.partial) {
        s += `<rect x="${x + 0.75}" y="${yy + 0.75}" width="${bw - 1.5}" height="${Math.max(0, h - 1.5)}" rx="${r}" fill="color-mix(in srgb, var(--money) 8%, transparent)" stroke="var(--money)" stroke-width="1.5" stroke-dasharray="4 3"/>`;
      } else if (h > 0) {
        s += `<path class="bar-fill" d="M${x},${H - padB} V${yy + r} a${r},${r} 0 0 1 ${r},-${r} h${bw - 2 * r} a${r},${r} 0 0 1 ${r},${r} V${H - padB} Z"/>`;
        s += `<path class="bar-cap" d="M${x},${yy + Math.min(6, h)} V${yy + r} a${r},${r} 0 0 1 ${r},-${r} h${bw - 2 * r} a${r},${r} 0 0 1 ${r},${r} V${yy + Math.min(6, h)} Z"/>`;
      }
      if (cw < 36 && (months.length - 1 - i) % 2) { s += '</g>'; return; }
      s += `<text class="axis" x="${padL + i * cw + cw / 2}" y="${H - 6}" text-anchor="middle" ${m.partial ? 'style="fill:var(--money);font-weight:600"' : ''}>${cap(MOIS[m.m]).replace('.', '')}</text></g>`;
    });
    el.innerHTML = s + '</svg>';
  }
  function niceTicks(max, n) {
    const raw = max / n, mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = [1, 2, 2.5, 5, 10].map((k) => k * mag).find((k) => k >= raw);
    const out = []; for (let v = 0; v <= max + step * 0.999; v += step) out.push(v);
    return out;
  }

  /* ———————————————————— Affaires ———————————————————— */
  function viewDeals() {
    const v = $('#view');
    const pl = pipeline(prefs.pipelineId) || db.pipelines[0];
    const all = db.deals.filter((d) => d.pipelineId === pl.id && ownerOk(d));
    const open = all.filter((d) => d.status === 'open');
    const wonM = all.filter((d) => d.status === 'won' && d.closeDate.slice(0, 7) === TODAY.slice(0, 7));
    const owner = prefs.owner ? user(prefs.owner) : null;
    const viewSeg = [['pipeline', 'Pipeline', 'cols'], ['liste', 'Liste', 'list'], ['previsions', 'Prévisions', 'fc']];
    v.innerHTML = `
      <div class="page-head">
        <div><h1>Affaires</h1></div>
        <div class="tools">
          <button class="pill" id="plBtn">${esc(pl.name)} ${I('down', 'chev')}</button>
          <button class="pill" id="ownBtn">${owner ? avatar(owner) + esc(owner.short) : 'Tout le monde'} ${I('down', 'chev')}</button>
          <div class="seg" role="group" aria-label="Vue">${viewSeg.map(([k, l, i]) => `<button aria-pressed="${prefs.dealView === k}" data-v="${k}">${I(i)}<span>${l}</span></button>`).join('')}</div>
          <button class="btn primary" id="newDeal">${I('plus')}<span class="hide-sm">Affaire</span></button>
        </div>
      </div>
      <div class="pl-summary">
        <span><b>${moneyC(sum(open, (d) => d.value))}</b> en cours</span><span class="sep"></span>
        <span><b>${open.length}</b> ${open.length > 1 ? 'affaires' : 'affaire'}</span><span class="sep"></span>
        <span><b style="color:var(--money)">${moneyC(sum(wonM, (d) => d.value))}</b> gagné en ${MOIS_L[T0.getMonth()]}</span>
        ${open.filter((d) => actState(d).k === 'late').length ? `<span class="sep"></span><span style="color:var(--danger)"><b style="color:inherit">${open.filter((d) => actState(d).k === 'late').length}</b> activités en retard</span>` : ''}
      </div>
      <div id="dealBody"></div>`;
    $('#plBtn').onclick = (e) => pipelineMenu(e.currentTarget, render);
    $('#ownBtn').onclick = (e) => ownerMenu(e.currentTarget);
    $$('.seg button', v).forEach((b) => (b.onclick = () => { prefs.dealView = b.dataset.v; savePrefs(); render(); }));
    $('#newDeal').onclick = () => dealForm();
    const body = $('#dealBody');
    if (prefs.dealView === 'liste') dealList(body, pl);
    else if (prefs.dealView === 'previsions') dealForecast(body, pl);
    else dealBoard(body, pl, open);
  }

  function dealCard(d) {
    const o = org(d.orgId);
    const st = actState(d);
    const rot = rotDays(d);
    const icon = { none: ['warn', 'Aucune activité planifiée'], late: ['clock', `En retard : ${st.a && st.a.subject}`], today: ['clock', `Aujourd’hui : ${st.a && st.a.subject}`], planned: [st.a ? ACT[st.a.type][0] : 'cal', st.a ? `${rel(st.a.due)} : ${st.a.subject}` : ''] }[st.k];
    return `<article class="dcard ${rot ? 'rotten' : ''}" data-deal="${d.id}" data-id="${d.id}" tabindex="0">
      ${d.labels.length ? `<div class="labels">${d.labels.map((l) => `<span class="badge ${l === 'Chaud' ? 'warn' : 'purple'}">${esc(l)}</span>`).join('')}</div>` : ''}
      <div class="t">${esc(d.title)}</div>
      <div class="o">${esc(o.name)}</div>
      <div class="f">
        <span class="v">${money(d.value)}</span>
        ${rot ? `<span class="rot" data-tip="Aucun mouvement depuis ${rot} jours (délai de l’étape : ${stageOf(d).rot} j)">${rot} j</span>` : ''}
        <span class="astat ${st.k}" data-tip="${esc(icon[1])}" style="margin-left:${rot ? '0' : '0'}">${I(icon[0])}</span>
        ${avatar(user(d.ownerId))}
      </div>
    </article>`;
  }

  function dealBoard(body, pl, open) {
    const tot = Math.max(sum(open, (d) => d.value), 1);
    body.innerHTML = `<div class="board-wrap"><div class="board" id="board">${pl.stages.map((s) => {
      const ds = open.filter((d) => d.stageId === s.id).sort((a, b) => b.value - a.value);
      const v = sum(ds, (d) => d.value);
      return `<section class="col" data-stage="${s.id}">
        <header class="col-head"><div class="t"><h3 title="${esc(s.name)}">${esc(s.name)}</h3><span class="n">${ds.length}</span></div>
          <div class="sum">${money(v)}</div><div class="meter"><i style="width:${(v / tot) * 100}%"></i></div></header>
        <div class="col-body">${ds.map(dealCard).join('')}</div>
        <button class="col-add" data-add="${s.id}">${I('plus')}Ajouter</button>
      </section>`;
    }).join('')}</div></div>`;
    $$('[data-add]', body).forEach((b) => (b.onclick = () => dealForm({ stageId: +b.dataset.add })));
    dragBoard($('#board'), '.dcard', '.col', (id, colEl, idx) => {
      const d = deal(+id); const to = +colEl.dataset.stage;
      if (d.stageId === to) return false;
      const from = d.stageId, prevChanged = d.stageChanged;
      d.stageId = to; d.stageChanged = TODAY; save();
      toast(`Déplacée vers « ${stageOf(d).name} »`, () => { d.stageId = from; d.stageChanged = prevChanged; save(); render(); });
      return true;
    }, { won: (id) => setStatus(deal(+id), 'won'), lost: (id) => setStatus(deal(+id), 'lost') });
    bindRows(body);
  }

  let sortDeals = { k: 'value', dir: -1 };
  function dealList(body, pl) {
    const st = prefs.dealStatus;
    let ds = db.deals.filter((d) => d.pipelineId === pl.id && ownerOk(d) && (st === 'all' || d.status === st));
    const key = {
      title: (d) => d.title.toLowerCase(), org: (d) => org(d.orgId).name, value: (d) => d.value, stage: (d) => stageIdx(d),
      owner: (d) => user(d.ownerId).name, next: (d) => { const a = nextAct(d.id); return a ? a.due : '9999'; }, close: (d) => d.closeDate || d.expectedClose,
    }[sortDeals.k];
    ds.sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0) * sortDeals.dir);
    const th = (k, l, cls = '') => `<th class="${cls}" data-sort="${k}">${l} <span class="arr">${sortDeals.k === k ? (sortDeals.dir > 0 ? '↑' : '↓') : ''}</span></th>`;
    body.innerHTML = `
      <div style="display:flex;gap:8px;margin:-4px 0 14px;flex-wrap:wrap">
        <div class="seg" id="stSeg">${[['open', 'Ouvertes'], ['won', 'Gagnées'], ['lost', 'Perdues'], ['all', 'Toutes']].map(([k, l]) => `<button aria-pressed="${st === k}" data-s="${k}">${l}</button>`).join('')}</div>
      </div>
      <div class="card table-card"><div class="tbl-scroll"><table class="tbl">
        <thead><tr>${th('title', 'Affaire')}${th('value', 'Valeur', 'r')}${th('stage', st === 'open' ? 'Étape' : 'Statut', 'hide-sm')}${th('next', st === 'open' ? 'Prochaine activité' : 'Raison', 'hide-sm hide-md')}${th('close', st === 'open' ? 'Clôture' : 'Fermée', 'hide-sm')}${th('owner', '', 'hide-sm')}</tr></thead>
        <tbody>${ds.map((d) => {
          const a = nextAct(d.id); const idx = stageIdx(d);
          const stCell = d.status === 'open' ? `<span style="display:inline-flex;align-items:center;max-width:230px"><span class="stage-dots">${pl.stages.map((s, i) => `<i class="${i <= idx ? 'on' : ''}"></i>`).join('')}</span><span class="ell">${esc(stageOf(d).name)}</span></span>`
            : d.status === 'won' ? '<span class="badge ok">Gagnée</span>' : '<span class="badge danger">Perdue</span>';
          const nextCell = d.status === 'open' ? (a ? `<span style="${daysFrom(a.due) < 0 ? 'color:var(--danger);font-weight:500' : ''}">${rel(a.due)}</span> <span class="muted">· ${esc(a.subject)}</span>` : '<span style="color:var(--warn)">Aucune</span>') : `<span class="muted">${esc(d.lostReason || '—')}</span>`;
          return `<tr data-deal="${d.id}"><td><div class="ell t-main" style="max-width:320px">${esc(d.title)}</div><div class="ell muted" style="font-size:12.5px;max-width:320px">${esc(org(d.orgId).name)}</div></td><td class="r" style="font-weight:600">${money(d.value)}</td><td class="hide-sm">${stCell}</td><td class="hide-sm hide-md"><div class="ell" style="max-width:240px">${nextCell}</div></td><td class="hide-sm muted">${dShort(d.closeDate || d.expectedClose)}</td><td class="hide-sm">${avatar(user(d.ownerId))}</td></tr>`;
        }).join('')}</tbody>
        <tfoot><tr><td>${plural(ds.length, 'affaire')}</td><td class="r">${money(sum(ds, (d) => d.value))}</td><td class="hide-sm" colspan="4"></td></tr></tfoot>
      </table></div></div>`;
    $$('#stSeg button', body).forEach((b) => (b.onclick = () => { prefs.dealStatus = b.dataset.s; savePrefs(); render(); }));
    $$('th[data-sort]', body).forEach((t) => (t.onclick = () => { const k = t.dataset.sort; sortDeals = { k, dir: sortDeals.k === k ? -sortDeals.dir : (k === 'value' ? -1 : 1) }; render(); }));
    bindRows(body);
  }

  function dealForecast(body, pl) {
    const ds = db.deals.filter((d) => d.pipelineId === pl.id && ownerOk(d) && d.status !== 'lost');
    const cols = [];
    for (let i = 0; i < 5; i++) { const d = new Date(T0); d.setDate(1); d.setMonth(d.getMonth() + i); cols.push({ key: d.toISOString().slice(0, 7), m: d.getMonth(), y: d.getFullYear() }); }
    const curKey = cols[0].key;
    body.innerHTML = `<div class="board-wrap"><div class="board forecast">${cols.map((c, i) => {
      const inCol = ds.filter((d) => {
        if (d.status === 'won') return d.closeDate.slice(0, 7) === c.key;
        const k = d.expectedClose.slice(0, 7);
        return i === 0 ? k <= c.key : k === c.key;
      }).sort((a, b) => (a.status === 'won' ? -1 : 1) - (b.status === 'won' ? -1 : 1) || b.value - a.value);
      const wonV = sum(inCol.filter((d) => d.status === 'won'), (d) => d.value);
      const openV = sum(inCol.filter((d) => d.status === 'open'), (d) => d.value);
      return `<section class="col fc-col"><header class="col-head"><div class="t"><h3>${cap(MOIS_L[c.m])} ${c.y !== T0.getFullYear() ? c.y : ''}</h3><span class="n">${inCol.length}</span></div>
        <div class="sum"><b style="color:var(--money)">${moneyC(wonV)}</b> gagné · ${moneyC(openV)} ouvert</div>
        <div class="meter"><i style="width:${(wonV / Math.max(1, wonV + openV)) * 100}%;background:var(--money)"></i></div></header>
        <div class="col-body">${inCol.map((d) => d.status === 'won' ? dealCard(d).replace('class="labels">', 'class="labels">').replace('<div class="t">', '<div class="labels"><span class="badge ok">' + I('check') + 'Gagnée</span></div><div class="t">') : (c.key === curKey && d.expectedClose.slice(0, 7) < curKey ? dealCard(d).replace('<div class="t">', `<div class="labels"><span class="badge danger">Prévue ${dShort(d.expectedClose)}</span></div><div class="t">`) : dealCard(d))).join('')}</div>
      </section>`;
    }).join('')}</div></div>`;
    $$('.dcard', body).forEach((c) => (c.style.cursor = 'pointer'));
    bindRows(body);
  }

  function setStatus(d, status, reason) {
    const prev = { status: d.status, closeDate: d.closeDate, lostReason: d.lostReason };
    d.status = status;
    d.closeDate = status === 'open' ? null : TODAY;
    d.lostReason = status === 'lost' ? reason || 'Non précisée' : null;
    save();
    toast(status === 'won' ? `Affaire gagnée · ${money(d.value)}` : status === 'lost' ? 'Affaire marquée perdue' : 'Affaire rouverte', () => { Object.assign(d, prev); save(); render(); refreshSheet(); }, status === 'won');
    render(); refreshSheet();
  }

  /* ———————————————————— Glisser-déposer (souris + tactile) ———————————————————— */
  // Un seul jeu d'écouteurs globaux ; chaque rendu de tableau ne fait qu'enregistrer sa configuration.
  let dragCfg = null, st = null, dropbar = null;
  function dragBoard(root, itemSel, colSel, onDrop, extra) {
    if (!dropbar) {
      document.body.insertAdjacentHTML('beforeend', `<div class="dropbar" id="dropbar">
        <div class="dz lost" data-dz="lost">${I('x')}Perdue</div>
        <div class="dz won" data-dz="won">${I('check')}Gagnée</div></div>`);
      dropbar = $('#dropbar');
      window.addEventListener('pointermove', dragMove, { passive: false });
      window.addEventListener('pointerup', dragEnd);
      window.addEventListener('pointercancel', dragEnd);
      document.addEventListener('touchmove', (e) => { if (st && st.started) e.preventDefault(); }, { passive: false });
    }
    const cfg = { root, itemSel, colSel, onDrop, extra };
    root.addEventListener('pointerdown', (e) => {
      const card = e.target.closest(itemSel);
      if (!card || e.button !== 0) return;
      dragCfg = cfg;
      const touch = e.pointerType !== 'mouse';
      st = { card, x0: e.clientX, y0: e.clientY, started: false, touch, id: card.dataset.id, pid: e.pointerId };
      if (touch) st.timer = setTimeout(() => { if (st && !st.cancel) dragBegin(st.x0, st.y0); }, 320);
    });
    root.addEventListener('contextmenu', (e) => { if (e.target.closest(itemSel)) e.preventDefault(); });
  }
  function dragBegin(x, y) {
    const r = st.card.getBoundingClientRect();
    st.started = true; st.dx = x - r.left; st.dy = y - r.top;
    st.ghost = st.card.cloneNode(true); st.ghost.classList.add('ghost'); st.ghost.style.width = r.width + 'px';
    document.body.appendChild(st.ghost); st.card.classList.add('dragging');
    document.body.style.userSelect = 'none';
    if (navigator.vibrate) navigator.vibrate(8);
    if (dragCfg.extra) dropbar.classList.add('on');
    $('#toast').classList.remove('on');
    dragOver(x, y);
  }
  function dragOver(x, y) {
    const { root, colSel } = dragCfg;
    st.ghost.style.left = x - st.dx + 'px'; st.ghost.style.top = y - st.dy + 'px';
    st.ghost.style.display = 'none';
    const under = document.elementFromPoint(x, y);
    st.ghost.style.display = '';
    $$(colSel, root).forEach((c) => c.classList.remove('drop'));
    const dz = dragCfg.extra && under && under.closest('[data-dz]');
    $$('[data-dz]', dropbar).forEach((z) => z.classList.toggle('over', z === dz));
    st.over = dz ? { dz: dz.dataset.dz } : null;
    const col = !dz && under && under.closest(colSel);
    if (col && root.contains(col)) { col.classList.add('drop'); st.over = { col }; }
    const wrap = root.parentElement; const wr = wrap.getBoundingClientRect();
    if (x > wr.right - 60) wrap.scrollLeft += 14; else if (x < wr.left + 60) wrap.scrollLeft -= 14;
  }
  function dragMove(e) {
    if (!st || e.pointerId !== st.pid) return;
    const dist = Math.hypot(e.clientX - st.x0, e.clientY - st.y0);
    if (!st.started) {
      if (st.touch) { if (dist > 8) { st.cancel = true; clearTimeout(st.timer); } return; }
      if (dist > 5) dragBegin(e.clientX, e.clientY); else return;
    }
    e.preventDefault();
    dragOver(e.clientX, e.clientY);
  }
  function dragEnd(e) {
    if (!st || (e && e.pointerId !== st.pid)) return;
    clearTimeout(st.timer);
    const s = st; st = null;
    if (!s.started) return;
    const { root, colSel, onDrop, extra } = dragCfg;
    s.card.classList.remove('dragging'); s.ghost.remove(); document.body.style.userSelect = '';
    $$(colSel, root).forEach((c) => c.classList.remove('drop'));
    dropbar.classList.remove('on'); $$('[data-dz]', dropbar).forEach((z) => z.classList.remove('over'));
    root._justDragged = true; setTimeout(() => (root._justDragged = false), 50);
    if (!s.over) return;
    if (s.over.dz) { extra[s.over.dz](s.id); return; }
    if (onDrop(s.id, s.over.col)) render();
  }

  /* ———————————————————— Projets ———————————————————— */
  function viewProjects() {
    const v = $('#view');
    const b = board(prefs.boardId) || db.boards[0];
    const ps = db.projects.filter((p) => p.boardId === b.id && p.status === 'open' && ownerOk(p));
    const risk = ps.filter((p) => p.health === 'risque' || daysFrom(p.end) < 0).length;
    const tasksLeft = sum(ps, (p) => p.tasks.filter((t) => !t.done).length);
    const owner = prefs.owner ? user(prefs.owner) : null;
    v.innerHTML = `
      <div class="page-head">
        <div><h1>Projets</h1></div>
        <div class="tools">
          <button class="pill" id="bBtn">${esc(b.name)} ${I('down', 'chev')}</button>
          <button class="pill" id="ownBtn">${owner ? avatar(owner) + esc(owner.short) : 'Tout le monde'} ${I('down', 'chev')}</button>
          <div class="seg">${[['tableau', 'Tableau', 'cols'], ['liste', 'Liste', 'list'], ['chronologie', 'Chronologie', 'gantt']].map(([k, l, i]) => `<button aria-pressed="${prefs.projView === k}" data-v="${k}">${I(i)}<span>${l}</span></button>`).join('')}</div>
          <button class="btn primary" id="newProj">${I('plus')}<span class="hide-sm">Projet</span></button>
        </div>
      </div>
      <div class="pl-summary"><span><b>${ps.length}</b> projets actifs</span><span class="sep"></span><span><b>${tasksLeft}</b> tâches ouvertes</span>${risk ? `<span class="sep"></span><span style="color:var(--danger)"><b style="color:inherit">${risk}</b> en retard ou à risque</span>` : ''}</div>
      <div id="projBody"></div>`;
    $('#bBtn').onclick = (e) => menu(e.currentTarget, db.boards.map((x) => ({ l: x.name, on: x.id === b.id, meta: db.projects.filter((p) => p.boardId === x.id && p.status === 'open').length, fn: () => { prefs.boardId = x.id; savePrefs(); render(); } })));
    $('#ownBtn').onclick = (e) => ownerMenu(e.currentTarget);
    $$('.seg button', v).forEach((x) => (x.onclick = () => { prefs.projView = x.dataset.v; savePrefs(); render(); }));
    $('#newProj').onclick = () => projectForm();
    const body = $('#projBody');
    if (prefs.projView === 'liste') projList(body, ps, b);
    else if (prefs.projView === 'chronologie') projGantt(body, ps, b);
    else projBoard(body, ps, b);
  }

  const projName = (p) => cap(p.title.split(' — ')[1] || p.title);
  function projCard(p) {
    const pr = progress(p); const o = org(p.orgId);
    const late = daysFrom(p.end) < 0;
    return `<article class="dcard pcard" data-proj="${p.id}" data-id="${p.id}" tabindex="0">
      ${p.labels.length || p.health !== 'ok' || late ? `<div class="labels">${late || p.health === 'risque' ? '<span class="badge danger">À risque</span>' : p.health === 'attention' ? '<span class="badge warn">Attention</span>' : ''}${p.labels.map((l) => `<span class="badge accent">${esc(l)}</span>`).join('')}</div>` : ''}
      <div class="t">${esc(projName(p))}</div>
      <div class="o">${esc(o.name)}</div>
      <div class="prog">${ringSvg(pr.r)}<span>${pr.n}/${pr.N}</span><span class="dates ${late ? 'late' : ''}" style="margin:0 0 0 auto">${late ? 'Échue ' + rel(p.end).toLowerCase() : 'Échéance ' + dShort(p.end)}</span>${avatar(user(p.ownerId))}</div>
    </article>`;
  }

  function projBoard(body, ps, b) {
    body.innerHTML = `<div class="board-wrap"><div class="board" id="pboard">${b.phases.map((f) => {
      const items = ps.filter((p) => p.phaseId === f.id).sort((x, y) => (x.end < y.end ? -1 : 1));
      return `<section class="col" data-phase="${f.id}"><header class="col-head"><div class="t"><h3>${esc(f.name)}</h3><span class="n">${items.length}</span></div>
        <div class="sum">${plural(sum(items, (p) => p.tasks.filter((t) => !t.done).length), 'tâche ouverte', 'tâches ouvertes')}</div></header>
        <div class="col-body">${items.map(projCard).join('')}</div>
        <button class="col-add" data-addp="${f.id}">${I('plus')}Ajouter</button></section>`;
    }).join('')}</div></div>`;
    $$('[data-addp]', body).forEach((x) => (x.onclick = () => projectForm({ phaseId: +x.dataset.addp })));
    dragBoard($('#pboard'), '.dcard', '.col', (id, col) => {
      const p = project(+id); const to = +col.dataset.phase;
      if (p.phaseId === to) return false;
      const from = p.phaseId; p.phaseId = to; save();
      toast(`Projet déplacé vers « ${board(p.boardId).phases.find((f) => f.id === to).name} »`, () => { p.phaseId = from; save(); render(); });
      return true;
    });
    bindRows(body);
  }

  function projList(body, ps, b) {
    const rows = ps.slice().sort((x, y) => (x.end < y.end ? -1 : 1));
    body.innerHTML = `<div class="card table-card"><div class="tbl-scroll"><table class="tbl">
      <thead><tr><th>Projet</th><th class="hide-sm">Organisation</th><th class="hide-sm">Phase</th><th>Progrès</th><th class="hide-sm hide-md">Début</th><th>Échéance</th><th class="hide-sm">Responsable</th></tr></thead>
      <tbody>${rows.map((p) => { const pr = progress(p); const late = daysFrom(p.end) < 0; return `<tr data-proj="${p.id}">
        <td><div class="ell t-main" style="max-width:260px">${esc(projName(p))}</div><div class="ell muted mobile-only" style="font-size:12.5px">${esc(org(p.orgId).name)}</div></td><td class="hide-sm"><div class="ell" style="max-width:220px">${esc(org(p.orgId).name)}</div></td>
        <td class="hide-sm"><span class="badge">${esc(b.phases.find((f) => f.id === p.phaseId).name)}</span></td>
        <td><span style="display:inline-flex;gap:8px;align-items:center">${ringSvg(pr.r)}<span class="muted hide-sm">${Math.round(pr.r * 100)} %</span></span></td>
        <td class="hide-sm hide-md muted">${dShort(p.start)}</td><td style="${late ? 'color:var(--danger);font-weight:600' : ''}">${dShort(p.end)}</td>
        <td class="hide-sm"><span class="who">${avatar(user(p.ownerId))}${esc(user(p.ownerId).short)}</span></td></tr>`; }).join('')}</tbody></table></div></div>`;
    bindRows(body);
  }

  function projGantt(body, ps, b) {
    const startD = new Date(T0); startD.setDate(1); startD.setMonth(startD.getMonth() - 2);
    const endD = new Date(T0); endD.setDate(1); endD.setMonth(endD.getMonth() + 4);
    const span = (endD - startD) / DAY;
    const pos = (iso) => Math.max(0, Math.min(100, (((new Date(iso + 'T12:00:00') - startD) / DAY) / span) * 100));
    const months = []; for (let d = new Date(startD); d < endD; d.setMonth(d.getMonth() + 1)) months.push(new Date(d));
    const rows = ps.slice().sort((x, y) => (x.start < y.start ? -1 : 1));
    body.innerHTML = `<div class="card gantt"><div class="gantt-inner">
      <div class="g-row head"><div class="g-name" style="font-size:12.5px;color:var(--ink-3);font-weight:500;cursor:default">${plural(rows.length, 'projet')}</div><div class="g-track">${months.map((m) => `<div class="g-month" style="left:${pos(m.toISOString().slice(0, 10))}%">${cap(MOIS_L[m.getMonth()])}</div>`).join('')}</div></div>
      ${rows.map((p) => { const pr = progress(p); const l = pos(p.start), r = pos(p.end); const late = daysFrom(p.end) < 0 || p.health === 'risque'; return `<div class="g-row"><div class="g-name" data-proj="${p.id}"><b>${esc(projName(p))}</b><span>${esc(org(p.orgId).name)}</span></div>
        <div class="g-track">${months.map((m) => `<div class="g-month" style="left:${pos(m.toISOString().slice(0, 10))}%;padding:0"></div>`).join('')}
        <div class="g-bar ${late ? 'risque' : ''}" data-proj="${p.id}" style="left:${l}%;width:${Math.max(2.5, r - l)}%" data-tip-b="${Math.round(pr.r * 100)} %" data-tip-s="${dShort(p.start)} → ${dShort(p.end)} · ${pr.n}/${pr.N} tâches"><i style="width:${pr.r * 100}%"></i><span>${Math.round(pr.r * 100)} %</span></div></div></div>`; }).join('')}
      <div class="g-today" style="left:calc(300px + (100% - 300px) * ${pos(TODAY) / 100})"></div>
    </div></div>`;
    if (matchMedia('(max-width: 760px)').matches) {
      $('.g-today', body).style.left = `calc(170px + (100% - 170px) * ${pos(TODAY) / 100})`;
      const g = $('.gantt', body); g.scrollLeft = (g.scrollWidth - 170) * (pos(TODAY) / 100) - (g.clientWidth - 170) * 0.6;
    }
    bindRows(body);
  }

  /* ———————————————————— Activités ———————————————————— */
  function viewActivities() {
    const v = $('#view');
    const f = prefs.actFilter;
    let acts = db.activities.filter((a) => { const d = deal(a.dealId); return d && ownerOk(d); });
    acts = f === 'done' ? acts.filter((a) => a.done).sort((a, b) => (a.due > b.due ? -1 : 1)).slice(0, 60) : acts.filter((a) => !a.done).sort((a, b) => (a.due < b.due ? -1 : 1));
    const groups = f === 'done' ? [['Terminées', acts]] : [
      ['En retard', acts.filter((a) => daysFrom(a.due) < 0)], ['Aujourd’hui', acts.filter((a) => daysFrom(a.due) === 0)],
      ['Demain', acts.filter((a) => daysFrom(a.due) === 1)], ['Cette semaine', acts.filter((a) => daysFrom(a.due) > 1 && daysFrom(a.due) <= 7)],
      ['Plus tard', acts.filter((a) => daysFrom(a.due) > 7)],
    ].filter((g) => g[1].length);
    v.innerHTML = `<div class="page-head"><div><h1>Activités</h1></div>
      <div class="tools"><button class="pill" id="ownBtn">${prefs.owner ? avatar(user(prefs.owner)) + esc(user(prefs.owner).short) : 'Tout le monde'} ${I('down', 'chev')}</button>
      <div class="seg">${[['todo', 'À faire'], ['done', 'Terminées']].map(([k, l]) => `<button aria-pressed="${f === k}" data-f="${k}">${l}</button>`).join('')}</div></div></div>
      <div style="max-width:880px">${groups.map(([g, list]) => `<div class="group-h" style="margin-top:8px"><b style="color:${g === 'En retard' ? 'var(--danger)' : 'var(--ink)'};font-weight:600;font-size:15px">${g}</b>&nbsp;&nbsp;<span class="num">${list.length}</span></div>
        <div class="card" style="padding:0 16px 0 12px;margin-bottom:20px"><ul class="rows">${list.map((a) => { const d = deal(a.dealId); const n = daysFrom(a.due); return `<li data-deal="${a.dealId}">
          <button class="check ${a.done ? 'on' : ''}" data-done="${a.id}" aria-label="Marquer comme fait"><svg viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg></button>
          <span class="act-ico ${n < 0 && !a.done ? 'late' : ''}">${I(ACT[a.type][0])}</span>
          <div class="r-main"><b>${esc(a.subject)}</b><span>${esc(d.title)} · ${esc(org(d.orgId).name)}</span></div>
          <span class="hide-sm">${avatar(user(a.ownerId))}</span>
          <div class="r-end ${n < 0 && !a.done ? 'late' : ''}" style="min-width:72px">${rel(a.due)}<br><span style="color:var(--ink-3);font-weight:400">${a.time}</span></div></li>`; }).join('')}</ul></div>`).join('') || '<div class="card empty"><b>Aucune activité</b>Planifiez une activité depuis une affaire.</div>'}</div>`;
    $('#ownBtn').onclick = (e) => ownerMenu(e.currentTarget);
    $$('.seg button', v).forEach((x) => (x.onclick = () => { prefs.actFilter = x.dataset.f; savePrefs(); render(); }));
    $$('.rows > li > .r-main', v).forEach((x) => (x.parentElement.style.paddingLeft = '0'));
    bindRows(v);
  }

  /* ———————————————————— Organisations & personnes ———————————————————— */
  let sortOrgs = { k: 'openV', dir: -1 };
  function contactsHead(k) {
    return `<div class="page-head"><div><h1>${k === 'organisations' ? 'Organisations' : 'Personnes'}</h1><div class="sub">${k === 'organisations' ? plural(db.orgs.length, 'établissement') : plural(db.persons.length, 'contact')}</div></div>
      <div class="tools"><div class="seg mobile-only"><button aria-pressed="${k === 'organisations'}" data-h="#organisations">Organisations</button><button aria-pressed="${k === 'personnes'}" data-h="#personnes">Personnes</button></div>
      <span class="badge accent hide-sm" style="height:28px;padding:0 12px" data-tip="Code client Acomba affiché sur chaque fiche — synchronisation prévue">${I('sync')}Prêt pour Acomba</span></div></div>`;
  }
  function viewOrgs() {
    const v = $('#view');
    const rows = db.orgs.map((o) => {
      const ds = db.deals.filter((d) => d.orgId === o.id);
      const op = ds.filter((d) => d.status === 'open');
      return { o, open: op.length, openV: sum(op, (d) => d.value), won: sum(ds.filter((d) => d.status === 'won'), (d) => d.value) };
    });
    const key = { name: (r) => r.o.name, type: (r) => r.o.type, ville: (r) => r.o.ville, open: (r) => r.open, openV: (r) => r.openV, won: (r) => r.won, leves: (r) => r.o.leves }[sortOrgs.k];
    rows.sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0) * sortOrgs.dir);
    const th = (k, l, cls = '') => `<th class="${cls}" data-sort="${k}">${l} <span class="arr">${sortOrgs.k === k ? (sortOrgs.dir > 0 ? '↑' : '↓') : ''}</span></th>`;
    v.innerHTML = contactsHead('organisations') + `<div class="card table-card"><div class="tbl-scroll"><table class="tbl">
      <thead><tr>${th('name', 'Nom')}${th('type', 'Type', 'hide-sm')}${th('ville', 'Ville', 'hide-sm hide-md')}${th('leves', 'Lève-pers.', 'r hide-sm')}${th('open', 'Affaires', 'r hide-sm hide-md')}${th('openV', 'En cours', 'r')}${th('won', 'Gagné (total)', 'r hide-sm')}<th class="hide-sm">Acomba</th></tr></thead>
      <tbody>${rows.map((r) => `<tr data-org="${r.o.id}"><td><span class="who">${orgAvatar(r.o)}<span class="ell t-main" style="display:block;max-width:280px">${esc(r.o.name)}</span></span></td><td class="hide-sm muted">${esc(r.o.type)}</td><td class="hide-sm hide-md muted">${esc(r.o.ville)}</td><td class="r hide-sm">${r.o.leves}</td><td class="r hide-sm hide-md">${r.open || '<span class="muted">—</span>'}</td><td class="r" style="font-weight:600">${r.openV ? moneyC(r.openV) : '<span class="muted" style="font-weight:400">—</span>'}</td><td class="r hide-sm muted">${r.won ? moneyC(r.won) : '—'}</td><td class="hide-sm"><span class="muted" style="font-family:var(--mono);font-size:12.5px">${r.o.acomba}</span></td></tr>`).join('')}</tbody></table></div></div>`;
    $$('th[data-sort]', v).forEach((t) => (t.onclick = () => { const k = t.dataset.sort; sortOrgs = { k, dir: sortOrgs.k === k ? -sortOrgs.dir : (['name', 'type', 'ville'].includes(k) ? 1 : -1) }; render(); }));
    $$('.seg [data-h]', v).forEach((b) => (b.onclick = () => (location.hash = b.dataset.h)));
    bindRows(v);
  }
  function viewPersons() {
    const v = $('#view');
    const rows = db.persons.slice().sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    v.innerHTML = contactsHead('personnes') + `<div class="card table-card"><div class="tbl-scroll"><table class="tbl">
      <thead><tr><th>Nom</th><th class="hide-sm">Organisation</th><th class="hide-sm hide-md">Courriel</th><th class="hide-sm">Téléphone</th></tr></thead>
      <tbody>${rows.map((p) => `<tr data-person="${p.id}"><td><span class="who"><span class="avatar" style="--h:${hueOf(p.name)}">${initials(p.name)}</span><span style="min-width:0"><span class="ell t-main" style="display:block;max-width:260px">${esc(p.name)}</span><span class="ell muted" style="display:block;font-size:12.5px;max-width:260px"><span class="hide-sm">${esc(p.role)}</span><span class="mobile-only">${esc(org(p.orgId).name)}</span></span></span></span></td><td class="hide-sm"><div class="ell" style="max-width:240px">${esc(org(p.orgId).name)}</div></td><td class="hide-sm hide-md"><a href="mailto:${esc(p.email)}" onclick="event.stopPropagation()"><span class="ell" style="display:block;max-width:300px">${esc(p.email)}</span></a></td><td class="hide-sm muted">${esc(p.telephone)}</td></tr>`).join('')}</tbody></table></div></div>`;
    $$('.seg [data-h]', v).forEach((b) => (b.onclick = () => (location.hash = b.dataset.h)));
    bindRows(v);
  }

  /* ———————————————————— Liaisons des lignes ———————————————————— */
  function bindRows(root) {
    $$('[data-done]', root).forEach((b) => (b.onclick = (e) => {
      e.stopPropagation();
      const a = db.activities.find((x) => x.id === +b.dataset.done);
      a.done = !a.done; save();
      b.classList.toggle('on', a.done);
      if (a.done) toast('Activité terminée', () => { a.done = false; save(); render(); refreshSheet(); });
      setTimeout(() => { render(); refreshSheet(); }, a.done ? 450 : 0);
    }));
    root.addEventListener('click', (e) => {
      const board = e.target.closest('.board');
      if (board && board._justDragged) return;
      if (e.target.closest('button, a[href]')) { if (!e.target.closest('[data-deal],[data-proj],[data-org],[data-person]') || e.target.closest('button')) return; }
      const t = e.target.closest('[data-deal],[data-proj],[data-org],[data-person],[data-href]');
      if (!t || !root.contains(t)) return;
      if (t.dataset.href) { location.hash = t.dataset.href; return; }
      if (t.dataset.deal) openDeal(+t.dataset.deal);
      else if (t.dataset.proj) openProject(+t.dataset.proj);
      else if (t.dataset.org) openOrg(+t.dataset.org);
      else if (t.dataset.person) openPerson(+t.dataset.person);
    });
    $$('[data-deal],[data-proj]', root).forEach((el) => {
      if (el.tagName === 'ARTICLE') el.addEventListener('keydown', (e) => { if (e.key === 'Enter') el.click(); });
    });
  }

  /* ———————————————————— Feuilles (inspecteur) ———————————————————— */
  let sheetState = null;
  function sheet(html, onBind) {
    let s = $('#sheet');
    if (!s) {
      document.body.insertAdjacentHTML('beforeend', '<div class="scrim" id="scrim"></div><aside class="sheet" id="sheet" role="dialog" aria-modal="true"></aside>');
      s = $('#sheet');
      $('#scrim').onclick = closeSheet;
      requestAnimationFrame(() => { $('#scrim').classList.add('on'); s.classList.add('on'); });
      sheetSwipe(s);
    }
    const scroll = $('.sheet-scroll', s); const top = scroll ? scroll.scrollTop : 0;
    s.innerHTML = html;
    if (sheetState && sheetState.same) $('.sheet-scroll', s).scrollTop = top;
    $$('[data-close]', s).forEach((b) => (b.onclick = closeSheet));
    if (onBind) onBind(s);
  }
  function closeSheet() {
    const s = $('#sheet'), sc = $('#scrim');
    if (!s) return;
    sheetState = null;
    s.classList.remove('on'); sc.classList.remove('on');
    setTimeout(() => { s.remove(); sc.remove(); }, 420);
  }
  function refreshSheet() { if (sheetState) { sheetState.same = true; sheetState.fn(sheetState.id); } }
  function sheetSwipe(s) {
    let y0 = null, dy = 0;
    s.addEventListener('touchstart', (e) => { const sc = $('.sheet-scroll', s); if (!matchMedia('(max-width:760px)').matches || (sc && sc.scrollTop > 0 && !e.target.closest('.sheet-top'))) return; y0 = e.touches[0].clientY; dy = 0; s.style.transition = 'none'; }, { passive: true });
    s.addEventListener('touchmove', (e) => { if (y0 == null) return; dy = Math.max(0, e.touches[0].clientY - y0); s.style.transform = `translateY(${dy}px)`; }, { passive: true });
    s.addEventListener('touchend', () => { if (y0 == null) return; s.style.transition = ''; s.style.transform = ''; y0 = null; if (dy > 120) closeSheet(); });
  }
  const sheetTop = (crumb) => `<div class="sheet-top"><div class="crumb">${crumb}</div><button class="icon-btn" data-close aria-label="Fermer">${I('x')}</button></div>`;
  const kv = (k, v, attrs = '') => `<div class="kv ${attrs ? 'link' : ''}" ${attrs}><span class="k">${k}</span><span class="v">${v}</span>${attrs ? I('right', 'chev') : ''}</div>`;

  function openDeal(id) {
    const same = sheetState && sheetState.id === id && sheetState.fn === openDeal;
    sheetState = { fn: openDeal, id, same };
    const d = deal(id); const pl = pipeline(d.pipelineId); const o = org(d.orgId); const p = d.personId && person(d.personId);
    const idx = stageIdx(d); const since = -daysFrom(d.stageChanged);
    const acts = db.activities.filter((a) => a.dealId === id);
    const todo = acts.filter((a) => !a.done).sort((a, b) => (a.due < b.due ? -1 : 1));
    const done = acts.filter((a) => a.done).sort((a, b) => (a.due > b.due ? -1 : 1));
    const ns = db.notes.filter((n) => n.dealId === id).sort((a, b) => (a.date > b.date ? -1 : 1));
    const proj = db.projects.filter((x) => x.dealId === id);
    const statusBadge = d.status === 'won' ? `<span class="badge ok">${I('check')}Gagnée le ${dShort(d.closeDate)}</span>` : d.status === 'lost' ? `<span class="badge danger">Perdue · ${esc(d.lostReason)}</span>` : rotDays(d) ? `<span class="badge danger">Inactive depuis ${rotDays(d)} j</span>` : '';
    sheet(`${sheetTop(`${esc(pl.name)} › ${esc(stageOf(d).name)}`)}
      <div class="sheet-scroll">
        <h2>${esc(d.title)}</h2>
        <div class="lead"><span class="lnk" role="link" tabindex="0" data-org="${o.id}">${esc(o.name)}</span>${p ? ` · <span class="lnk" role="link" tabindex="0" data-person="${p.id}">${esc(p.name)}</span>` : ''}</div>
        <div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap"><div class="bigval">${money(d.value)}</div>${statusBadge}${d.labels.map((l) => `<span class="badge ${l === 'Chaud' ? 'warn' : 'purple'}">${esc(l)}</span>`).join('')}</div>
        <div class="stagebar" role="group" aria-label="Étapes">${pl.stages.map((s, i) => `<button class="${i < idx ? 'on' : i === idx ? 'cur' : ''}" data-stage="${s.id}" data-tip="${esc(s.name)}" ${d.status !== 'open' ? 'disabled' : ''}>${esc(s.name)}</button>`).join('')}</div>
        <div class="stagebar-lbl"><span>Étape ${idx + 1} sur ${pl.stages.length} · <b>${esc(stageOf(d).name)}</b></span><span>${since === 0 ? 'Depuis aujourd’hui' : `Depuis ${since} j`}</span></div>
        <div class="actions">
          ${d.status === 'open' ? `<button class="btn ok lg" data-st="won">${I('check')}Gagnée</button><button class="btn danger lg" data-st="lost">${I('x')}Perdue</button>` : `<button class="btn lg" data-st="open">${I('undo')}Rouvrir</button>`}
          <button class="btn lg" data-newact>${I('cal')}Planifier</button>
        </div>

        <div class="group-h">Détails</div>
        <div class="group" style="margin-top:0">
          ${kv('Organisation', esc(o.name), `data-org="${o.id}"`)}
          ${p ? kv('Contact', esc(p.name), `data-person="${p.id}"`) : ''}
          ${kv('Responsable', `<span class="who" style="display:inline-flex;gap:8px;align-items:center;justify-content:flex-end">${avatar(user(d.ownerId))}${esc(user(d.ownerId).short)}</span>`)}
          ${kv(d.status === 'open' ? 'Clôture prévue' : 'Fermée le', dLong(d.closeDate || d.expectedClose))}
          ${kv('Créée le', dLong(d.created))}
          ${d.soumission ? kv('N° de soumission', `<span style="font-family:var(--mono);font-size:13px">${d.soumission}</span>`) : ''}
          ${kv('Client Acomba', `<span style="font-family:var(--mono);font-size:13px">${o.acomba}</span>`)}
        </div>

        ${proj.length ? `<div class="group-h">Projets liés</div><div class="group" style="margin-top:0">${proj.map((x) => kv(esc(board(x.boardId).name), esc(projName(x)), `data-proj="${x.id}"`)).join('')}</div>` : ''}

        <div class="group-h">À faire <span class="end"><button class="btn plain" data-newact>${I('plus')}Activité</button></span></div>
        <div class="group" style="margin-top:0">${todo.length ? `<ul class="timeline">${todo.map((a) => `<li><button class="check" data-done="${a.id}" aria-label="Fait"><svg viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg></button><span class="act-ico ${daysFrom(a.due) < 0 ? 'late' : ''}" style="width:28px;height:28px">${I(ACT[a.type][0])}</span><div class="tl-main"><b>${esc(a.subject)}</b><span style="${daysFrom(a.due) < 0 ? 'color:var(--danger);font-weight:600' : ''}">${rel(a.due)} · ${a.time}</span></div></li>`).join('')}</ul>` : `<div class="kv" style="color:var(--warn)">${I('warn')}<span>Aucune activité planifiée</span></div>`}</div>

        <div class="group-h">Notes</div>
        <div class="group" style="margin-top:0">
          <div class="composer"><textarea id="noteTxt" rows="1" placeholder="Ajouter une note…"></textarea><button class="btn primary" id="noteAdd" style="height:40px" aria-label="Ajouter la note">${I('send')}</button></div>
          ${ns.length ? `<ul class="timeline" style="padding-top:0">${ns.map((n) => `<li>${avatar(user(n.authorId))}<div class="tl-main"><span>${esc(user(n.authorId).short)} · ${rel(n.date)}</span><p>${esc(n.text)}</p></div></li>`).join('')}</ul>` : ''}
        </div>

        ${done.length ? `<div class="group-h">Historique</div><div class="group" style="margin-top:0"><ul class="timeline">${done.map((a) => `<li class="done"><span class="act-ico" style="width:28px;height:28px">${I(ACT[a.type][0])}</span><div class="tl-main"><b>${esc(a.subject)}</b><span>${dLong(a.due)} · ${esc(user(a.ownerId).short)}</span></div></li>`).join('')}</ul></div>` : ''}
      </div>`, (s) => {
      $$('[data-stage]', s).forEach((b) => (b.onclick = () => {
        const to = +b.dataset.stage; if (to === d.stageId) return;
        const from = d.stageId, pc = d.stageChanged; d.stageId = to; d.stageChanged = TODAY; save(); render(); refreshSheet();
        toast(`Déplacée vers « ${stageOf(d).name} »`, () => { d.stageId = from; d.stageChanged = pc; save(); render(); refreshSheet(); });
      }));
      $$('[data-st]', s).forEach((b) => (b.onclick = () => {
        if (b.dataset.st === 'lost') lostReason(b, (r) => setStatus(d, 'lost', r));
        else setStatus(d, b.dataset.st);
      }));
      $$('[data-newact]', s).forEach((b) => (b.onclick = () => activityForm(d)));
      $('#noteAdd', s).onclick = () => {
        const t = $('#noteTxt', s).value.trim(); if (!t) return;
        db.notes.push({ id: Date.now(), dealId: d.id, date: TODAY, authorId: 1, text: t }); save(); refreshSheet(); toast('Note ajoutée');
      };
      const ta = $('#noteTxt', s); ta.oninput = () => { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; };
      bindRows(s);
    });
  }

  function lostReason(anchor, cb) {
    menu(anchor, ['Prix trop élevé', 'Compétiteur choisi', 'Budget reporté', 'Aucune réponse', 'Projet annulé'].map((r) => ({ l: r, fn: () => cb(r) })), 'Raison de la perte');
  }

  function openProject(id) {
    const same = sheetState && sheetState.id === id && sheetState.fn === openProject;
    sheetState = { fn: openProject, id, same };
    const p = project(id); const b = board(p.boardId); const o = org(p.orgId); const d = deal(p.dealId);
    const pr = progress(p); const late = daysFrom(p.end) < 0;
    const phIdx = b.phases.findIndex((f) => f.id === p.phaseId);
    sheet(`${sheetTop(`${esc(b.name)} › ${esc(b.phases[phIdx].name)}`)}
      <div class="sheet-scroll">
        <h2>${esc(projName(p))}</h2>
        <div class="lead"><span class="lnk" role="link" tabindex="0" data-org="${o.id}">${esc(o.name)}</span></div>
        <div style="display:flex;align-items:center;gap:14px;margin-top:18px">
          ${ringSvg(pr.r, 52)}
          <div><div style="font:600 24px/1.2 var(--font-display);letter-spacing:-.02em" class="num">${Math.round(pr.r * 100)} %</div><div style="color:var(--ink-3);font-size:13px">${pr.n} sur ${pr.N} tâches</div></div>
          <div style="margin-left:auto;display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end">${late || p.health === 'risque' ? '<span class="badge danger">À risque</span>' : p.health === 'attention' ? '<span class="badge warn">Attention</span>' : '<span class="badge ok">En bonne voie</span>'}${p.labels.map((l) => `<span class="badge accent">${esc(l)}</span>`).join('')}</div>
        </div>
        <div class="stagebar" role="group" aria-label="Phases">${b.phases.map((f, i) => `<button class="${i < phIdx ? 'on' : i === phIdx ? 'cur' : ''}" data-phase="${f.id}" data-tip="${esc(f.name)}">${esc(f.name)}</button>`).join('')}</div>
        <div class="stagebar-lbl"><span>Phase ${phIdx + 1} sur ${b.phases.length} · <b>${esc(b.phases[phIdx].name)}</b></span><span style="${late ? 'color:var(--danger);font-weight:600' : ''}">${late ? 'Échue ' + rel(p.end).toLowerCase() : 'Échéance ' + rel(p.end).toLowerCase()}</span></div>

        <div class="group-h">Détails</div>
        <div class="group" style="margin-top:0">
          ${kv('Organisation', esc(o.name), `data-org="${o.id}"`)}
          ${d ? kv('Affaire liée', esc(d.title), `data-deal="${d.id}"`) : ''}
          ${kv('Responsable', `<span style="display:inline-flex;gap:8px;align-items:center">${avatar(user(p.ownerId))}${esc(user(p.ownerId).short)}</span>`)}
          ${kv('Début', dLong(p.start))}
          ${kv('Échéance', dLong(p.end))}
          ${kv('Valeur', money(p.value))}
        </div>

        <div class="group-h">Tâches <span class="end num">${pr.n}/${pr.N}</span></div>
        <div class="group" style="margin-top:0"><ul class="timeline">${p.tasks.map((t) => `<li class="${t.done ? 'done' : ''}"><button class="check ${t.done ? 'on' : ''}" data-task="${t.id}" aria-label="Basculer"><svg viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg></button><div class="tl-main"><b>${esc(t.title)}</b><span style="${!t.done && daysFrom(t.due) < 0 ? 'color:var(--danger);font-weight:600' : ''}">${rel(t.due)}</span></div>${avatar(user(t.assigneeId))}</li>`).join('')}</ul>
          <div class="composer"><textarea id="taskTxt" rows="1" placeholder="Nouvelle tâche…"></textarea><button class="btn primary" id="taskAdd" style="height:40px" aria-label="Ajouter">${I('plus')}</button></div></div>
      </div>`, (s) => {
      $$('[data-phase]', s).forEach((x) => (x.onclick = () => { p.phaseId = +x.dataset.phase; save(); render(); refreshSheet(); toast(`Phase : ${b.phases.find((f) => f.id === p.phaseId).name}`); }));
      $$('[data-task]', s).forEach((x) => (x.onclick = (e) => { e.stopPropagation(); const t = p.tasks.find((k) => k.id === +x.dataset.task); t.done = !t.done; save(); x.classList.toggle('on', t.done); setTimeout(() => { render(); refreshSheet(); }, 250); }));
      const add = () => { const t = $('#taskTxt', s).value.trim(); if (!t) return; p.tasks.push({ id: Date.now(), title: t, done: false, due: isoAdd(7), assigneeId: 1 }); save(); render(); refreshSheet(); };
      $('#taskAdd', s).onclick = add;
      $('#taskTxt', s).onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); add(); } };
      bindRows(s);
    });
  }

  function openOrg(id) {
    const same = sheetState && sheetState.id === id && sheetState.fn === openOrg;
    sheetState = { fn: openOrg, id, same };
    const o = org(id);
    const ds = db.deals.filter((d) => d.orgId === id);
    const open = ds.filter((d) => d.status === 'open');
    const won12 = ds.filter((d) => d.status === 'won' && -daysFrom(d.closeDate) <= 365);
    const ppl = db.persons.filter((p) => p.orgId === id);
    const projs = db.projects.filter((p) => p.orgId === id && p.status === 'open');
    sheet(`${sheetTop('Organisation')}
      <div class="sheet-scroll">
        <div class="ident">${orgAvatar(o, 'xl')}<div><h2 style="font-size:22px">${esc(o.name)}</h2><div class="lead">${esc(o.type)} · ${esc(o.ville)}, ${esc(o.region)}</div></div></div>
        <div class="mini-stats"><div><span>En cours</span><b>${moneyC(sum(open, (d) => d.value))}</b></div><div><span>Gagné 12 mois</span><b style="color:var(--money)">${moneyC(sum(won12, (d) => d.value))}</b></div><div><span>Projets actifs</span><b>${projs.length}</b></div></div>
        <div class="int-note">${I('sync')}<span>Client Acomba <b style="font-family:var(--mono);font-weight:600">${o.acomba}</b> — fiche partagée avec les applications RTM.</span></div>
        <div class="group-h">Coordonnées</div>
        <div class="group" style="margin-top:0">
          ${kv('Adresse', `${esc(o.adresse)}, ${esc(o.ville)}`)}
          ${kv('Téléphone', `<a href="tel:${esc(o.telephone)}">${esc(o.telephone)}</a>`)}
          ${kv('Lits', o.lits)}
          ${kv('Lève-personnes', o.leves)}
          ${kv('Client depuis', o.clientDepuis || '—')}
          ${kv('Responsable', esc(user(o.owner).short))}
        </div>
        <div class="group-h">Personnes <span class="end num">${ppl.length}</span></div>
        <div class="group" style="margin-top:0">${ppl.map((p) => kv(`<span style="display:inline-flex;gap:10px;align-items:center;color:var(--ink);font-weight:500"><span class="avatar" style="--h:${hueOf(p.name)}">${initials(p.name)}</span>${esc(p.name)}</span>`, `<span style="color:var(--ink-3);font-weight:400">${esc(p.role)}</span>`, `data-person="${p.id}"`)).join('')}</div>
        <div class="group-h">Affaires <span class="end num">${ds.length}</span></div>
        <div class="group" style="margin-top:0">${ds.sort((a, b) => (a.status === 'open' ? -1 : 1) - (b.status === 'open' ? -1 : 1) || b.value - a.value).slice(0, 12).map((d) => kv(`<span style="color:var(--ink);font-weight:500">${esc(d.title)}</span>`, `${d.status === 'won' ? '<span class="badge ok">Gagnée</span> ' : d.status === 'lost' ? '<span class="badge danger">Perdue</span> ' : ''}${moneyC(d.value)}`, `data-deal="${d.id}"`)).join('')}</div>
        ${projs.length ? `<div class="group-h">Projets</div><div class="group" style="margin-top:0">${projs.map((x) => kv(`<span style="color:var(--ink);font-weight:500">${esc(projName(x))}</span>`, `${Math.round(progress(x).r * 100)} %`, `data-proj="${x.id}"`)).join('')}</div>` : ''}
      </div>`, (s) => bindRows(s));
    $$('#sheet .kv .k').forEach((k) => { if (k.querySelector('span')) k.style.width = 'auto'; });
  }

  function openPerson(id) {
    const same = sheetState && sheetState.id === id && sheetState.fn === openPerson;
    sheetState = { fn: openPerson, id, same };
    const p = person(id); const o = org(p.orgId);
    const ds = db.deals.filter((d) => d.personId === id);
    sheet(`${sheetTop('Personne')}
      <div class="sheet-scroll">
        <div class="ident"><span class="avatar xl" style="--h:${hueOf(p.name)}">${initials(p.name)}</span><div><h2 style="font-size:22px">${esc(p.name)}</h2><div class="lead">${esc(p.role)}</div></div></div>
        <div class="actions"><a class="btn lg" href="tel:${esc(p.telephone)}">${I('phone')}Appeler</a><a class="btn lg" href="mailto:${esc(p.email)}">${I('mail')}Courriel</a></div>
        <div class="group-h">Coordonnées</div>
        <div class="group" style="margin-top:0">
          ${kv('Organisation', esc(o.name), `data-org="${o.id}"`)}
          ${kv('Courriel', `<a href="mailto:${esc(p.email)}">${esc(p.email)}</a>`)}
          ${kv('Téléphone', `${esc(p.telephone)}${p.poste ? ` <span style="color:var(--ink-3);font-weight:400">poste ${p.poste}</span>` : ''}`)}
        </div>
        ${ds.length ? `<div class="group-h">Affaires</div><div class="group" style="margin-top:0">${ds.map((d) => kv(`<span style="color:var(--ink);font-weight:500">${esc(d.title)}</span>`, moneyC(d.value), `data-deal="${d.id}"`)).join('')}</div>` : ''}
      </div>`, (s) => bindRows(s));
  }

  /* ———————————————————— Formulaires ———————————————————— */
  function modal(title, body, primary, onOk) {
    const w = document.createElement('div');
    w.innerHTML = `<div class="scrim on" style="z-index:65"></div><div class="modal-wrap"><form class="modal" role="dialog" aria-modal="true"><div class="modal-h"><h2>${title}</h2><button type="button" class="icon-btn" data-x aria-label="Fermer">${I('x')}</button></div><div class="modal-b">${body}</div><div class="modal-f"><button type="button" class="btn lg" data-x>Annuler</button><button class="btn primary lg">${primary}</button></div></form></div>`;
    document.body.appendChild(w);
    const close = () => w.remove();
    $$('[data-x]', w).forEach((b) => (b.onclick = close));
    $('.modal-wrap', w).onclick = (e) => { if (e.target.classList.contains('modal-wrap')) close(); };
    $('form', w).onsubmit = (e) => { e.preventDefault(); if (onOk(new FormData(e.target)) !== false) close(); };
    $$('.datefield', w).forEach((b) => (b.onclick = () => calendarPop(b, $(`input[name="${b.dataset.name}"]`, w).value, (iso) => {
      $(`input[name="${b.dataset.name}"]`, w).value = iso; b.querySelector('span').textContent = dLong(iso);
    })));
    setTimeout(() => { const f = $('input:not([type=hidden])', w); if (f) f.focus(); }, 60);
    w.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  }
  const TIMES = []; for (let h = 7; h <= 18; h++) for (const m of ['00', '15', '30', '45']) TIMES.push(`${String(h).padStart(2, '0')}:${m}`);
  const dateField = (id, name, iso) => `<button type="button" class="datefield" id="${id}" data-name="${name}">${I('cal')}<span>${dLong(iso)}</span></button><input type="hidden" name="${name}" value="${iso}">`;

  // Calendrier en popover : un mois, lundi en premier, 6 rangées fixes, point sous aujourd'hui.
  function calendarPop(anchor, iso, onPick) {
    let view = new Date(iso + 'T12:00:00'); view.setDate(1);
    const el = document.createElement('div');
    el.className = 'pop cal'; el.id = 'pop';
    const draw = () => {
      const y = view.getFullYear(), m = view.getMonth();
      const first = (new Date(y, m, 1).getDay() + 6) % 7;
      const start = new Date(y, m, 1 - first, 12);
      let cells = '';
      for (let i = 0; i < 42; i++) {
        const d = new Date(start.getTime() + i * DAY); const k = d.toISOString().slice(0, 10);
        cells += `<button type="button" data-d="${k}" class="${d.getMonth() !== m ? 'out' : ''} ${k === iso ? 'sel' : ''} ${k === TODAY ? 'today' : ''}">${d.getDate()}</button>`;
      }
      el.innerHTML = `<div class="cal-h"><b>${cap(MOIS_L[m])} ${y}</b><button type="button" class="icon-btn" data-step="-1" aria-label="Mois précédent">${I('right', 'flip')}</button><button type="button" class="icon-btn" data-step="1" aria-label="Mois suivant">${I('right')}</button></div>
        <div class="cal-w">${['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((x) => `<span>${x}</span>`).join('')}</div><div class="cal-g">${cells}</div>
        <div class="cal-f"><button type="button" class="btn plain" data-d="${TODAY}">Aujourd’hui</button></div>`;
      $$('[data-step]', el).forEach((b) => (b.onclick = (e) => { e.stopPropagation(); view.setMonth(view.getMonth() + +b.dataset.step); draw(); }));
      $$('[data-d]', el).forEach((b) => (b.onclick = () => { onPick(b.dataset.d); el.remove(); }));
    };
    closePop(); draw(); document.body.appendChild(el);
    const r = anchor.getBoundingClientRect();
    let x = r.left, yy = r.bottom + 6;
    if (x + el.offsetWidth > innerWidth - 8) x = innerWidth - el.offsetWidth - 8;
    if (yy + el.offsetHeight > innerHeight - 8) yy = Math.max(8, r.top - el.offsetHeight - 6);
    el.style.left = x + 'px'; el.style.top = yy + 'px';
    setTimeout(() => document.addEventListener('pointerdown', function off(e) { if (!el.contains(e.target)) { el.remove(); document.removeEventListener('pointerdown', off); } }), 0);
  }
  const opt = (arr, sel) => arr.map(([v, l]) => `<option value="${v}" ${String(v) === String(sel) ? 'selected' : ''}>${esc(l)}</option>`).join('');

  function dealForm(pre = {}) {
    const pl = pipeline(prefs.pipelineId);
    modal('Nouvelle affaire', `
      <div class="field"><label for="f-t">Titre</label><input id="f-t" name="title" required placeholder="Ex. : Lève-personnes sur rail — 12 chambres"></div>
      <div class="field"><label for="f-o">Organisation</label><select id="f-o" name="org">${opt(db.orgs.slice().sort((a, b) => a.name.localeCompare(b.name, 'fr')).map((o) => [o.id, o.name]))}</select></div>
      <div class="field-row"><div class="field"><label for="f-v">Valeur ($)</label><input id="f-v" name="value" inputmode="numeric" placeholder="0"></div>
      <div class="field"><label for="f-c">Clôture prévue</label>${dateField('f-c', 'close', isoAdd(30))}</div></div>
      <div class="field-row"><div class="field"><label for="f-s">Étape · ${esc(pl.name)}</label><select id="f-s" name="stage">${opt(pl.stages.map((s) => [s.id, s.name]), pre.stageId)}</select></div>
      <div class="field"><label for="f-u">Responsable</label><select id="f-u" name="owner">${opt(db.users.map((u) => [u.id, u.name]), prefs.owner || 1)}</select></div></div>`, 'Créer', (f) => {
      const d = { id: Math.max(...db.deals.map((x) => x.id)) + 1, title: f.get('title'), pipelineId: pl.id, stageId: +f.get('stage'), orgId: +f.get('org'), personId: (db.persons.find((p) => p.orgId === +f.get('org')) || {}).id || null, ownerId: +f.get('owner'), value: +String(f.get('value')).replace(/[^\d]/g, '') || 0, status: 'open', created: TODAY, stageChanged: TODAY, expectedClose: f.get('close') || isoAdd(30), lostReason: null, closeDate: null, soumission: null, labels: [] };
      db.deals.push(d); save(); render(); toast('Affaire créée'); setTimeout(() => openDeal(d.id), 200);
    });
  }

  function projectForm(pre = {}) {
    const b = board(prefs.boardId);
    const won = db.deals.filter((d) => d.status === 'won').sort((a, b2) => (a.closeDate > b2.closeDate ? -1 : 1)).slice(0, 40);
    modal('Nouveau projet', `
      <div class="field"><label for="p-t">Titre</label><input id="p-t" name="title" required placeholder="Ex. : Installation rails aile B"></div>
      <div class="field"><label for="p-d">Affaire gagnée liée</label><select id="p-d" name="deal">${opt(won.map((d) => [d.id, `${d.title} — ${org(d.orgId).name}`]))}</select></div>
      <div class="field-row"><div class="field"><label for="p-p">Phase · ${esc(b.name)}</label><select id="p-p" name="phase">${opt(b.phases.map((f) => [f.id, f.name]), pre.phaseId)}</select></div>
      <div class="field"><label for="p-e">Échéance</label>${dateField('p-e', 'end', isoAdd(45))}</div></div>`, 'Créer', (f) => {
      const d = deal(+f.get('deal'));
      const p = { id: Math.max(...db.projects.map((x) => x.id)) + 1, title: `${org(d.orgId).name} — ${f.get('title')}`, boardId: b.id, phaseId: +f.get('phase'), orgId: d.orgId, dealId: d.id, ownerId: 1, start: TODAY, end: f.get('end') || isoAdd(45), status: 'open', health: 'ok', value: d.value, labels: [], tasks: [] };
      db.projects.push(p); save(); render(); toast('Projet créé'); setTimeout(() => openProject(p.id), 200);
    });
  }

  function activityForm(d) {
    modal('Planifier une activité', `
      <div class="field"><label>Type</label><div class="seg" id="a-type" style="display:flex">${Object.entries(ACT).map(([k, [i, l]], n) => `<button type="button" aria-pressed="${n === 0}" data-t="${k}" style="flex:1">${I(i)}<span class="hide-sm">${l}</span></button>`).join('')}</div></div>
      <div class="field"><label for="a-s">Sujet</label><input id="a-s" name="subject" required placeholder="Ex. : Appel de suivi"></div>
      <div class="field-row"><div class="field"><label for="a-d">Date</label>${dateField('a-d', 'due', isoAdd(1))}</div><div class="field"><label for="a-h">Heure</label><select id="a-h" name="time">${opt(TIMES.map((t) => [t, t]), '10:00')}</select></div></div>`, 'Planifier', (f) => {
      const t = ($('#a-type [aria-pressed="true"]') || {}).dataset.t || 'appel';
      db.activities.push({ id: Date.now(), dealId: d.id, type: t, subject: f.get('subject'), due: f.get('due') || isoAdd(1), time: f.get('time') || '10:00', done: false, ownerId: 1 });
      save(); render(); refreshSheet(); toast('Activité planifiée');
    });
    $$('#a-type button').forEach((b) => (b.onclick = () => $$('#a-type button').forEach((x) => x.setAttribute('aria-pressed', x === b))));
  }

  /* ———————————————————— Menus ———————————————————— */
  function closePop() { const p = $('#pop'); if (p) p.remove(); }
  function menu(anchor, items, title) {
    closePop();
    const r = anchor.getBoundingClientRect();
    const el = document.createElement('div');
    el.className = 'pop'; el.id = 'pop'; el.setAttribute('role', 'menu');
    el.innerHTML = (title ? `<div class="m-sec">${title}</div>` : '') + items.map((it, i) => it.sep ? '<hr>' : it.sec ? `<div class="m-sec">${it.sec}</div>` : `<button class="m" role="menuitem" data-i="${i}">${it.on != null ? `<svg class="i m-check" viewBox="0 0 24 24" style="visibility:${it.on ? 'visible' : 'hidden'}">${P.check}</svg>` : ''}${it.icon || ''}<span class="m-lbl">${it.l}</span>${it.meta != null ? `<span class="m-meta">${it.meta}</span>` : ''}</button>`).join('');
    document.body.appendChild(el);
    const w = el.offsetWidth, h = el.offsetHeight;
    let x = r.left, y = r.bottom + 6;
    if (x + w > innerWidth - 8) x = Math.max(8, r.right - w);
    if (y + h > innerHeight - 8) y = Math.max(8, r.top - h - 6);
    el.style.left = x + 'px'; el.style.top = y + 'px';
    $$('button.m', el).forEach((b) => (b.onclick = () => { closePop(); items[+b.dataset.i].fn(); }));
    setTimeout(() => document.addEventListener('pointerdown', function off(e) { if (!el.contains(e.target)) { closePop(); document.removeEventListener('pointerdown', off); } }), 0);
  }
  function pipelineMenu(anchor, cb) {
    menu(anchor, db.pipelines.map((p) => ({ l: esc(p.name), on: p.id === prefs.pipelineId, meta: db.deals.filter((d) => d.pipelineId === p.id && d.status === 'open').length, fn: () => { prefs.pipelineId = p.id; savePrefs(); cb(); } })), 'Pipelines');
  }
  function ownerMenu(anchor) {
    menu(anchor, [{ l: 'Tout le monde', on: !prefs.owner, fn: () => { prefs.owner = 0; savePrefs(); render(); } }, { sep: true },
      ...db.users.map((u) => ({ l: esc(u.name), icon: avatar(u), on: prefs.owner === u.id, fn: () => { prefs.owner = u.id; savePrefs(); render(); } }))], 'Responsable');
  }
  function themeMenu(anchor) {
    menu(anchor, [['auto', 'Automatique', 'auto'], ['light', 'Clair', 'sun'], ['dark', 'Sombre', 'moon']].map(([k, l, i]) => ({ l, icon: I(i), on: prefs.theme === k, fn: () => { prefs.theme = k; savePrefs(); applyTheme(); } })), 'Apparence');
  }
  function moreMenu(anchor) {
    menu(anchor, [
      { l: 'Apparence…', icon: I('auto'), fn: () => themeMenu(anchor) },
      { l: 'Réinitialiser les données', icon: I('reset'), fn: () => { try { localStorage.removeItem(STORE); } catch (e) { /* ignore */ } db = Object.assign({ v: 1 }, clone(window.CRM_SEED)); closeSheet(); render(); toast('Données fictives restaurées'); } },
    ]);
  }

  /* ———————————————————— Recherche ———————————————————— */
  function searchResults(q) {
    q = q.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    if (!q) return [];
    const m = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(q);
    const out = [];
    db.deals.filter((d) => m(d.title) || m(org(d.orgId).name)).slice(0, 5).forEach((d) => out.push({ sec: 'Affaires', l: esc(d.title), meta: moneyC(d.value), icon: I('deal'), fn: () => openDeal(d.id) }));
    db.projects.filter((p) => m(p.title)).slice(0, 4).forEach((p) => out.push({ sec: 'Projets', l: esc(p.title), icon: I('proj'), fn: () => openProject(p.id) }));
    db.orgs.filter((o) => m(o.name) || m(o.ville) || m(o.acomba)).slice(0, 4).forEach((o) => out.push({ sec: 'Organisations', l: esc(o.name), meta: o.ville, icon: I('org'), fn: () => openOrg(o.id) }));
    db.persons.filter((p) => m(p.name) || m(p.email)).slice(0, 4).forEach((p) => out.push({ sec: 'Personnes', l: esc(p.name), meta: esc(org(p.orgId).name.slice(0, 18)), icon: I('person'), fn: () => openPerson(p.id) }));
    const items = []; let last = null;
    out.forEach(({ sec, ...o }) => { if (sec !== last) { items.push({ sec }); last = sec; } items.push(o); });
    return items;
  }
  function wireSearch() {
    const q = $('#q');
    q.addEventListener('input', () => {
      const items = searchResults(q.value);
      if (!q.value.trim()) return closePop();
      const box = $('#searchBox');
      menu(box, items.length ? items : [{ sec: 'Aucun résultat' }]);
      const p = $('#pop'); p.style.width = Math.max(box.offsetWidth, 340) + 'px';
      const r = box.getBoundingClientRect(); p.style.left = Math.min(r.left, innerWidth - 348) + 'px';
      q.focus();
    });
    q.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { const b = $('#pop button.m'); if (b) { b.click(); q.value = ''; q.blur(); } }
      if (e.key === 'Escape') { q.value = ''; closePop(); q.blur(); }
    });
    document.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); if (getComputedStyle($('#searchBox')).display === 'none') searchSheet(); else q.focus(); }
      if (e.key === 'Escape' && !$('.modal')) { closePop(); closeSheet(); }
    });
  }
  function searchSheet() {
    sheetState = null;
    sheet(`<div class="sheet-top" style="padding-top:18px"><label class="search" style="flex:1;width:auto;height:38px">${I('search')}<input id="q2" type="search" placeholder="Affaires, projets, contacts" autocomplete="off"></label><button class="btn plain" data-close>Annuler</button></div><div class="sheet-scroll" id="q2r"></div>`, (s) => {
      const i = $('#q2', s); setTimeout(() => i.focus(), 350);
      i.oninput = () => {
        const items = searchResults(i.value);
        $('#q2r', s).innerHTML = items.map((it, n) => it.sec ? `<div class="group-h">${it.sec}</div>` : `<div class="kv link" data-n="${n}" style="background:var(--surface-2);border-radius:12px;margin-bottom:4px"><span style="display:flex;gap:10px;align-items:center;flex:1;min-width:0;font-weight:500">${it.icon}<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${it.l}</span></span><span class="v" style="flex:none;color:var(--ink-3);font-weight:400">${it.meta || ''}</span></div>`).join('');
        $$('[data-n]', s).forEach((r) => (r.onclick = () => items[+r.dataset.n].fn()));
      };
    });
  }

  /* ———————————————————— Toast & infobulles ———————————————————— */
  let toastT;
  function toast(msg, undo, celebrate) {
    const t = $('#toast');
    t.innerHTML = `<span class="ti" style="${celebrate ? '' : ''}"><svg viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg></span><span>${esc(msg)}</span>${undo ? '<button>Annuler</button>' : '<span style="width:8px"></span>'}`;
    if (undo) $('button', t).onclick = () => { undo(); t.classList.remove('on'); };
    t.classList.add('on');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), undo ? 4800 : 2400);
  }
  function wireTips() {
    const tip = $('#tip');
    let cur = null;
    const show = (el) => {
      const b = el.dataset.tipB, s = el.dataset.tipS, t = el.dataset.tip;
      tip.innerHTML = b ? `<b>${b}</b><span>${s || ''}</span>` : esc(t);
      tip.classList.add('on');
      const r = el.getBoundingClientRect(); const w = tip.offsetWidth, h = tip.offsetHeight;
      let x = r.left + r.width / 2 - w / 2; x = Math.max(8, Math.min(innerWidth - w - 8, x));
      let y = r.top - h - 8; if (y < 8) y = r.bottom + 8;
      tip.style.left = x + 'px'; tip.style.top = y + 'px';
      if (el.closest('.chart')) { $$('.chart .bcol').forEach((c) => c.classList.toggle('on', c === el)); }
    };
    const hide = () => { tip.classList.remove('on'); cur = null; $$('.chart .bcol.on').forEach((c) => c.classList.remove('on')); };
    document.addEventListener('pointerover', (e) => {
      if (e.pointerType === 'touch') return;
      const el = e.target.closest('[data-tip],[data-tip-b]');
      if (el === cur) return;
      if (!el) return hide();
      cur = el; show(el);
    });
    document.addEventListener('focusin', (e) => { const el = e.target.closest && e.target.closest('[data-tip]'); if (el) { cur = el; show(el); } });
    document.addEventListener('focusout', hide);
    document.addEventListener('pointerdown', (e) => { const el = e.target.closest('.chart [data-tip-b]'); if (el && e.pointerType === 'touch') { cur = el; show(el); } else hide(); });
    window.addEventListener('scroll', hide, { passive: true });
  }

  /* ———————————————————— Défilement : barre de titre ———————————————————— */
  function onScroll() {
    const bar = $('#bar'); if (!bar) return;
    const h1 = $('.page-head h1');
    const y = window.scrollY;
    bar.classList.toggle('scrolled', y > 28);
    $('#barTitle').textContent = h1 ? h1.textContent : '';
  }

  /* ———————————————————— Démarrage ———————————————————— */
  shell();
  applyTheme();
  wireTips();
  window.addEventListener('hashchange', route);
  window.addEventListener('scroll', onScroll, { passive: true });
  let rz; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { if (!current) render(); }, 150); });
  route();
})();
