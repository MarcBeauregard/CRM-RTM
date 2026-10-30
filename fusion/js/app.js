/* CRM RTM — prototype local (vanilla JS, aucune dépendance).
 * Modules : Tableau de bord · Affaires (pipeline, liste, prévisions) · Projets (tableau, liste, chronologie)
 * · Activités · Organisations · Personnes. Données fictives (js/data.js), modifications gardées dans localStorage. */
(function () {
  'use strict';

  /* ———————————————————— Données ———————————————————— */
  const STORE = 'crm-rtm-fusion-v1';
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
    checkc: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
    cam: '<path d="M4 7h3l2-3h6l2 3h3v13H4z"/><circle cx="12" cy="13" r="4"/>',
    send: '<path d="M4 12 20 4l-5 16-3-7z"/><path d="m12 13 8-9"/>',
  };
  // Logo RTM Médical (assets/logo-rtm.png ; intégré en data: URI dans la version autonome).
  const LOGO = window.CRM_LOGO || 'assets/logo-rtm.png';
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

  // Navigation unifiée : ventes (CRM) + parc (back-office RTM Rapports).
  const SECTIONS = [
    { items: [{ h: '#accueil', k: 'dash', l: 'Accueil', i: 'dash' }] },
    { label: 'Ventes', items: [
      { h: '#affaires', k: 'affaires', l: 'Affaires', i: 'deal', c: () => db.deals.filter((d) => d.status === 'open').length },
      { h: '#projets', k: 'projets', l: 'Projets', i: 'proj', c: () => db.projects.filter((p) => p.status === 'open').length },
      { h: '#activites', k: 'activites', l: 'Activités', i: 'cal', c: () => db.activities.filter((a) => !a.done && daysFrom(a.due) <= 0).length },
    ] },
    { label: 'Parc', items: [
      { h: '#clients', k: 'clients', l: 'Clients', i: 'org', c: () => db.clients.length, also: ['client', 'etablissement', 'equipement', 'organisations'] },
      { h: '#avalider', k: 'avalider', l: 'À valider', i: 'checkc', c: () => db.interventions.filter((x) => x.status === 'a_valider').length, also: ['valider'], hot: true },
      { h: '#soumissions', k: 'soumissions', l: 'Soumissions', i: 'doc', c: () => db.soumissions.filter((x) => x.status === 'a_saisir').length },
    ] },
    { label: 'Contacts', items: [
      { h: '#personnes', k: 'personnes', l: 'Personnes', i: 'person', c: () => db.persons.length },
    ] },
  ];
  const NAV_ALL = SECTIONS.flatMap((x) => x.items);
  const TABS = ['dash', 'affaires', 'avalider', 'clients'];

  function shell() {
    const me = user(1);
    const themeIcon = prefs.theme === 'dark' ? 'moon' : prefs.theme === 'light' ? 'sun' : 'auto';
    app.innerHTML = `
      <aside class="side" aria-label="Navigation">
        <a class="brand" href="#accueil" aria-label="RTM Médical — accueil du CRM">
          <img class="brand-logo" src="${LOGO}" alt="RTM Médical" width="120" height="36">
          <span class="brand-mark" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg></span>
          <span class="brand-tag">Bureau</span>
        </a>
        <div id="navSections"></div>
        <div class="side-foot">
          ${avatar(me)}
          <div class="who"><b>${esc(me.name)}</b><span>Administrateur</span></div>
          <button class="icon-btn" id="themeBtn" data-tip="Apparence">${I(themeIcon)}</button>
        </div>
      </aside>
      <div class="main">
        <header class="bar" id="bar">
          <a class="bar-logo" href="#accueil" aria-label="RTM Médical — accueil"><img src="${LOGO}" alt="" width="90" height="27"></a>
          <div class="bar-title" id="barTitle"></div>
          <div class="spacer"></div>
          <label class="search" id="searchBox">${I('search')}<input id="q" type="search" placeholder="Rechercher" autocomplete="off" aria-label="Rechercher"><kbd>⌘K</kbd></label>
          <button class="icon-btn mobile-only" id="qMobile" aria-label="Rechercher">${I('search')}</button>
          <button class="icon-btn add-btn" id="quickAdd" aria-label="Nouvelle affaire" data-tip="Nouvelle affaire (N)">${I('plus')}</button>
          <button class="icon-btn" id="moreBtn" aria-label="Plus">${I('more')}</button>
        </header>
        <main class="content" id="view" tabindex="-1"></main>
      </div>
      <nav class="tabbar" id="tabbar" aria-label="Navigation">
        ${TABS.map((k) => NAV_ALL.find((n) => n.k === k)).map((n) => `<a href="${n.h}" data-k="${n.k}">${I(n.i)}<span>${n.l}</span></a>`).join('')}
        <button type="button" id="tabMore" data-k="plus">${I('more')}<span>Plus</span></button>
      </nav>
      <div class="tip" id="tip" role="tooltip"></div>
      <div class="toast" id="toast" role="status"></div>`;
    $('#themeBtn').onclick = (e) => themeMenu(e.currentTarget);
    $('#moreBtn').onclick = (e) => moreMenu(e.currentTarget);
    $('#quickAdd').onclick = () => (current === 'projets' ? projectForm() : dealForm());
    $('#qMobile').onclick = () => searchSheet();
    $('#tabMore').onclick = () => menuSheet();
    wireSearch();
  }

  const navKey = (k) => (NAV_ALL.find((n) => n.k === k || (n.also || []).includes(k)) || {}).k || k;
  function navRefresh(k) {
    const on = navKey(k);
    const item = (n) => `<a href="${n.h}" ${n.k === on ? 'aria-current="page"' : ''}>${I(n.i)}<span class="lbl">${n.l}</span>${n.c ? `<span class="count">${nf.format(n.c())}</span>` : ''}</a>`;
    $('#navSections').innerHTML = SECTIONS.map((sec) => `${sec.label ? `<div class="side-label">${sec.label}</div>` : ''}<nav class="nav" aria-label="${sec.label || 'Accueil'}">${sec.items.map(item).join('')}</nav>`).join('');
    $$('#tabbar a').forEach((a) => { if (a.dataset.k === on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    const more = $('#tabMore'); if (more) more.toggleAttribute('data-on', !TABS.includes(on));
  }
  // Menu « Plus » sur iPhone : toutes les sections en grille.
  function menuSheet() {
    sheetState = null;
    sheet(`<div class="sheet-top" style="padding-top:18px"><div class="crumb" style="font:600 17px var(--font-display);color:var(--ink)">Menu</div><button class="icon-btn" data-close aria-label="Fermer">${I('x')}</button></div>
      <div class="sheet-scroll">${SECTIONS.filter((s) => s.label).map((sec) => `<div class="group-h">${sec.label}</div><div class="menu-grid">${sec.items.map((n) => `<a href="${n.h}" class="menu-tile">${I(n.i)}<span>${n.l}</span></a>`).join('')}</div>`).join('')}</div>`,
      (s) => $$('.menu-tile', s).forEach((a) => (a.onclick = () => closeSheet())));
  }

  function applyTheme() {
    if (prefs.theme === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', prefs.theme);
    const b = $('#themeBtn');
    if (b) b.innerHTML = I(prefs.theme === 'dark' ? 'moon' : prefs.theme === 'light' ? 'sun' : 'auto');
  }

  /* ———————————————————— Routeur ———————————————————— */
  const routes = { '': viewDash, accueil: viewDash, affaires: viewDeals, projets: viewProjects, activites: viewActivities, organisations: viewClients, clients: viewClients, personnes: viewPersons,
    client: () => viewClient(routeId), etablissement: () => viewEtab(routeId), equipement: () => viewEquip(routeId),
    avalider: viewAValider, valider: () => viewValider(routeId), soumissions: viewSoumissions };
  let current = '', routeId = null;
  function route() {
    const raw = location.hash.replace(/^#\/?/, '').split('?')[0];
    const pm = raw.match(/^(client|etablissement|equipement|valider)-(\d+)$/);
    const h = pm ? pm[1] : raw;
    const prevId = routeId; routeId = pm ? +pm[2] : null;
    const k = routes[h] && h !== 'accueil' ? h : '';
    const changed = k !== current || routeId !== prevId;
    current = k;
    navRefresh(k || 'dash');
    closePop();
    if (changed) { closeSheet(); $$('.modal-wrap').forEach((m) => m.parentElement.remove()); }
    render();
    if (changed) window.scrollTo(0, 0);
  }
  function render() {
    const v = $('#view');
    v.classList.toggle('wide', current === 'affaires' || current === 'projets');
    v.classList.toggle('dash', current === '');
    document.body.dataset.view = current || 'accueil';
    const qa = $('#quickAdd'); const lbl = current === 'projets' ? 'Nouveau projet' : 'Nouvelle affaire';
    qa.setAttribute('aria-label', lbl); qa.dataset.tip = current === 'projets' ? lbl : `${lbl} (N)`;
    routes[current]();
    navRefresh(current || 'dash');
    onScroll();
  }
  // La fiche Organisation du CRM est maintenant la fiche Établissement du parc.
  function openEtab(id) { location.hash = `etablissement-${id}`; }

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

    // Ma journée : mes activités d'aujourd'hui (par heure), puis celles en retard.
    const mine = db.activities.filter((a) => !a.done && a.ownerId === 1);
    const myToday = mine.filter((a) => daysFrom(a.due) === 0).sort((a, b) => (a.time < b.time ? -1 : 1));
    const myLate = mine.filter((a) => daysFrom(a.due) < 0).sort((a, b) => (a.due > b.due ? -1 : 1));
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
      <section class="kpis dash-kpis">
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
          <div class="delta">Équipe · ${todayActs.length} aujourd’hui</div>
        </a>
      </section>

      <section class="grid-2 dash-main">
        <div class="card dash-chart">
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
        <div class="card dash-day">
          <div class="card-head"><h2>Ma journée</h2><span class="meta num">${plural(myToday.length, 'activité')}</span><div class="end"><a class="btn plain" href="#activites">Tout voir</a></div></div>
          <div class="card-body" style="padding-top:2px">
            <ul class="rows" id="todo">${myToday.slice(0, 7).map(actRow).join('')}${myLate.length ? `<li class="rows-sec" aria-hidden="true">En retard · ${myLate.length}</li>${myLate.slice(0, 3).map(actRow).join('')}` : ''}${!myToday.length && !myLate.length ? `<li class="empty" style="display:block"><b>Journée libre</b><button class="btn primary" data-quick style="margin-top:12px">${I('plus')}Nouvelle affaire</button></li>` : ''}</ul>
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
    $$('[data-quick]', v).forEach((b) => (b.onclick = () => dealForm()));
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
      <div class="r-end ${n < 0 && !a.done ? 'late' : ''}">${n === 0 ? `<span class="r-time">${a.time}</span>` : `${rel(a.due)}<br><span style="color:var(--ink-3);font-weight:400">${a.time}</span>`}</div>
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
    return `<article class="dcard ${rot ? 'rotten' : ''}" data-deal="${d.id}" data-id="${d.id}" tabindex="0" role="button" aria-keyshortcuts="ArrowLeft ArrowRight" aria-label="${esc(d.title)}, ${esc(o.name)}, ${money(d.value)}, ${esc(stageOf(d).name)}${rot ? `, inactive depuis ${rot} jours` : ''}">
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
    // Alternative au glisser-déposer : ← / → déplace la carte ciblée d'une étape.
    $$('.dcard', body).forEach((c) => c.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      const d = deal(+c.dataset.id); const i = stageIdx(d) + (e.key === 'ArrowRight' ? 1 : -1);
      if (i < 0 || i >= pl.stages.length) return;
      const from = d.stageId, pc = d.stageChanged; d.stageId = pl.stages[i].id; d.stageChanged = TODAY; save(); render();
      const again = $(`.dcard[data-id="${d.id}"]`); if (again) again.focus();
      toast(`Déplacée vers « ${stageOf(d).name} »`, () => { d.stageId = from; d.stageChanged = pc; save(); render(); });
    }));
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
    const hasProj = db.projects.some((p) => p.dealId === d.id);
    toast(status === 'won' ? `Affaire gagnée · ${money(d.value)}` : status === 'lost' ? `Perdue · ${d.lostReason}` : 'Affaire rouverte', () => { Object.assign(d, prev); save(); render(); refreshSheet(); }, status === 'won',
      status === 'won' && !hasProj ? { l: 'Créer le projet', fn: () => projectFromDeal(d) } : null);
    render(); refreshSheet();
  }

  // Affaire gagnée → projet : tableau selon le type de travail, première phase, liste de tâches standard.
  const PROJ_TASKS = {
    1: ['Confirmer la date avec le client', 'Relevé des plafonds', 'Plans d’installation', 'Commande des rails', 'Commande des moteurs', 'Réception du matériel', 'Installation des rails', 'Installation des moteurs', 'Test de charge 150 %', 'Formation du personnel', 'Remise du rapport de conformité'],
    2: ['Planifier la visite', 'Confirmer l’accès aux chambres', 'Inspection des moteurs', 'Inspection des toiles', 'Test de charge', 'Saisir les non-conformités', 'Produire le rapport PDF', 'Envoyer la facture'],
  };
  function projectFromDeal(d) {
    const existing = db.projects.find((p) => p.dealId === d.id);
    if (existing) return openProject(existing.id);
    const b = board(d.pipelineId === 9 ? 2 : 1);
    const span = b.id === 1 ? 45 : 21;
    const tasks = PROJ_TASKS[b.id].map((t, k, all) => ({ id: Date.now() + k, title: t, done: false, due: isoAdd(Math.round(((k + 1) / all.length) * span)), assigneeId: d.ownerId }));
    const p = { id: Math.max(...db.projects.map((x) => x.id)) + 1, title: `${org(d.orgId).name} — ${d.title}`, boardId: b.id, phaseId: b.phases[0].id, orgId: d.orgId, dealId: d.id, ownerId: d.ownerId, start: TODAY, end: isoAdd(span), status: 'open', health: 'ok', value: d.value, labels: [], tasks };
    db.projects.push(p); save(); render(); refreshSheet();
    toast(`Projet créé · ${b.name}`, () => { db.projects.splice(db.projects.indexOf(p), 1); save(); render(); refreshSheet(); }, false, { l: 'Ouvrir', fn: () => openProject(p.id) });
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

  /* ———————————————————— Parc : clients, établissements, équipements ———————————————————— */
  const client = (id) => db.clients.find((c) => c.id === id);
  const equip = (id) => db.equipements.find((e) => e.id === id);
  const tech = (id) => db.techniciens.find((t) => t.id === id);
  const modele = (id) => db.modeles.find((m) => m.id === id);
  const marque = (id) => db.marques.find((m) => m.id === id);
  const modeleName = (m) => (m ? `${marque(m.marqueId).name} ${m.name}` : '');
  const eqTitle = (e) => (e.modeleId ? modeleName(modele(e.modeleId)) : e.type === 'Rail' ? 'Rail' : 'Modèle à identifier');
  // Index recalculés à chaque rendu (≈ 2 000 équipements : instantané).
  let IX = null;
  function ix() {
    if (IX && IX.v === db.equipements.length + db.interventions.length) return IX;
    const byEtab = new Map(), intByEq = new Map();
    db.equipements.forEach((e) => { if (!byEtab.has(e.etabId)) byEtab.set(e.etabId, []); byEtab.get(e.etabId).push(e); });
    db.interventions.forEach((x) => { if (!intByEq.has(x.eqId)) intByEq.set(x.eqId, []); intByEq.get(x.eqId).push(x); });
    intByEq.forEach((l) => l.sort((a, b) => (a.date > b.date ? -1 : 1)));
    IX = { v: db.equipements.length + db.interventions.length, byEtab, intByEq };
    return IX;
  }
  const eqsOf = (etabId) => ix().byEtab.get(etabId) || [];
  const intsOf = (eqId) => ix().intByEq.get(eqId) || [];
  const etabsOf = (clientId) => db.orgs.filter((o) => o.clientId === clientId);
  // État affiché : la dernière intervention en attente de décision passe avant tout.
  const eqState = (e) => { const l = intsOf(e.id)[0]; return l && l.status === 'a_valider' ? 'decider' : e.etat; };
  const STATE = { decider: ['À décider', 'warn'], nc: ['Non conforme', 'danger'], ok: ['Conforme', 'ok'], jamais: ['Pas encore fait', ''] };
  const stateBadge = (e) => { const [l, c] = STATE[eqState(e)]; return `<span class="badge ${c}">${l}</span>`; };
  const lastOf = (list) => list.reduce((m, e) => (e.last && (!m || e.last > m) ? e.last : m), null);
  const statsOf = (eqs) => {
    const s = { n: eqs.length, decider: 0, nc: 0, ok: 0, jamais: 0, inconnu: 0, last: lastOf(eqs) };
    eqs.forEach((e) => { s[eqState(e)]++; if (!e.modeleId && e.type !== 'Rail') s.inconnu++; });
    return s;
  };
  const openValue = (etabIds) => sum(db.deals.filter((d) => d.status === 'open' && etabIds.includes(d.orgId)), (d) => d.value);
  const crumbs = (items) => `<nav class="crumbs" aria-label="Fil d’Ariane">${items.map(([l, h]) => (h ? `<a href="${h}">${esc(l)}</a>` : `<span>${esc(l)}</span>`)).join(I('right', 'crumb-sep'))}</nav>`;

  function viewClients() {
    const v = $('#view');
    const q = norm(parcState.clientQ || '');
    let rows = db.clients.map((c) => { const es = etabsOf(c.id); const eqs = es.flatMap((o) => eqsOf(o.id)); return { c, es, s: statsOf(eqs), open: openValue(es.map((o) => o.id)) }; });
    const total = sum(rows, (r) => r.s.n);
    if (q) rows = rows.filter((r) => norm(`${r.c.name} ${r.es.map((o) => o.name + ' ' + o.ville).join(' ')}`).includes(q));
    if (parcState.clientF === 'decider') rows = rows.filter((r) => r.s.decider);
    rows.sort((a, b) => b.s.n - a.s.n);
    v.innerHTML = `<div class="page-head"><div><h1>Clients</h1><div class="sub">${plural(db.clients.length, 'client')} · ${plural(db.orgs.length, 'établissement')} · ${nf.format(total)} équipements suivis</div></div>
      <div class="tools"><label class="search inline" for="cq">${I('search')}<input id="cq" type="search" placeholder="Client, établissement ou ville" autocomplete="off" value="${esc(parcState.clientQ || '')}"></label>
      <div class="seg" id="cf">${[['tous', 'Tous'], ['decider', 'À décider']].map(([k, l]) => `<button aria-pressed="${(parcState.clientF || 'tous') === k}" data-f="${k}">${l}</button>`).join('')}</div></div></div>
      <div class="card table-card"><div class="tbl-scroll"><table class="tbl">
        <thead><tr><th>Client</th><th class="r hide-sm">Établissements</th><th class="r"><span class="hide-sm">Équipements</span><span class="mobile-only">Équip.</span></th><th class="r hide-sm hide-md">Modèle inconnu</th><th class="hide-sm">Dernier passage</th><th class="r">À décider</th><th class="r hide-sm hide-md">Ventes en cours</th></tr></thead>
        <tbody>${rows.map((r) => `<tr data-href="#client-${r.c.id}"><td><div class="ell t-main" style="max-width:320px">${esc(r.c.name)}</div><div class="ell muted" style="font-size:12.5px">${esc(r.c.type)}${r.es.length > 1 ? '' : ` · ${esc(r.es[0].ville)}`}</div></td>
          <td class="r hide-sm">${r.es.length}</td><td class="r" style="font-weight:600">${nf.format(r.s.n)}</td>
          <td class="r hide-sm hide-md" style="${r.s.inconnu / Math.max(1, r.s.n) > 0.15 ? 'color:var(--warn);font-weight:600' : ''}">${nf.format(r.s.inconnu)}</td>
          <td class="hide-sm muted">${r.s.last ? rel(r.s.last) : '—'}</td>
          <td class="r">${r.s.decider ? `<span class="badge warn">${r.s.decider}</span>` : '<span class="muted">—</span>'}</td>
          <td class="r hide-sm hide-md">${r.open ? moneyC(r.open) : '<span class="muted">—</span>'}</td></tr>`).join('') || '<tr><td colspan="7"><div class="empty"><b>Aucun client trouvé</b>Essayez un autre nom ou une ville.</div></td></tr>'}</tbody></table></div></div>`;
    const cq = $('#cq'); cq.oninput = () => { parcState.clientQ = cq.value; render(); const n = $('#cq'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); };
    $$('#cf button').forEach((b) => (b.onclick = () => { parcState.clientF = b.dataset.f; render(); }));
    bindRows(v);
  }
  const parcState = {};

  function viewClient(id) {
    const v = $('#view'); const c = client(id);
    if (!c) return viewClients();
    const es = etabsOf(id); const eqs = es.flatMap((o) => eqsOf(o.id)); const s = statsOf(eqs);
    const deals = db.deals.filter((d) => d.status === 'open' && es.some((o) => o.id === d.orgId)).sort((a, b) => b.value - a.value);
    const won12 = sum(db.deals.filter((d) => d.status === 'won' && es.some((o) => o.id === d.orgId) && -daysFrom(d.closeDate) <= 365), (d) => d.value);
    v.innerHTML = `${crumbs([['Clients', '#clients'], [c.name]])}
      <div class="page-head"><div><h1>${esc(c.name)}</h1><div class="sub">${esc(c.type)} · ${plural(es.length, 'établissement')} · ${nf.format(s.n)} équipements · client Acomba <span class="mono">${c.acomba}</span></div></div>
      <div class="tools"><button class="btn primary" id="cNew" aria-label="Nouvelle affaire">${I('plus')}<span class="hide-sm">Nouvelle affaire</span></button></div></div>
      <section class="kpis">
        <div class="card kpi"><div class="lbl">Équipements</div><div class="val">${nf.format(s.n)}</div><div class="delta">${Math.round(((s.n - s.jamais) / Math.max(1, s.n)) * 100)} % inspectés au moins une fois</div></div>
        <div class="card kpi"><div class="lbl">À décider</div><div class="val" style="${s.decider ? 'color:var(--warn)' : ''}">${s.decider}</div><div class="delta">${s.nc} non conformes ouverts</div></div>
        <div class="card kpi"><div class="lbl">Ventes en cours</div><div class="val">${moneyC(sum(deals, (d) => d.value)).replace(/ (k\$|M\$|\$)$/, '<small> $1</small>')}</div><div class="delta">${plural(deals.length, 'affaire')}</div></div>
        <div class="card kpi"><div class="lbl">Gagné 12 mois</div><div class="val" style="color:var(--money)">${moneyC(won12).replace(/ (k\$|M\$|\$)$/, '<small> $1</small>')}</div><div class="delta">Dernier passage ${s.last ? rel(s.last).toLowerCase() : '—'}</div></div>
      </section>
      <div class="grid-2">
        <div class="card table-card"><div class="card-head"><h2>Établissements</h2><span class="meta num">${es.length}</span></div><div class="tbl-scroll"><table class="tbl">
          <thead><tr><th>Établissement</th><th class="r"><span class="hide-sm">Équipements</span><span class="mobile-only">Équip.</span></th><th class="hide-sm">Dernier passage</th><th class="r">À décider</th></tr></thead>
          <tbody>${es.map((o) => { const t = statsOf(eqsOf(o.id)); return `<tr data-href="#etablissement-${o.id}"><td><span class="who">${orgAvatar(o)}<span><span class="ell t-main" style="display:block;max-width:280px">${esc(o.name)}</span><span class="muted" style="font-size:12.5px">${esc(o.type)} · ${esc(o.ville)}</span></span></span></td><td class="r" style="font-weight:600">${nf.format(t.n)}</td><td class="hide-sm muted">${t.last ? rel(t.last) : '—'}</td><td class="r">${t.decider ? `<span class="badge warn">${t.decider}</span>` : '<span class="muted">—</span>'}</td></tr>`; }).join('')}</tbody></table></div></div>
        <div class="card"><div class="card-head"><h2>Ventes en cours</h2><div class="end"><a class="btn plain" href="#affaires">Pipeline</a></div></div>
          <div class="card-body" style="padding-top:2px"><ul class="rows">${deals.slice(0, 7).map((d) => `<li data-deal="${d.id}">${orgAvatar(org(d.orgId), 'lg')}<div class="r-main"><b>${esc(d.title)}</b><span>${esc(stageOf(d).name)} · ${esc(org(d.orgId).name)}</span></div><div class="r-end" style="font-weight:600;color:var(--ink)">${moneyC(d.value)}</div></li>`).join('') || `<li class="empty" style="display:block"><b>Aucune affaire en cours</b><button class="btn primary" data-quick style="margin-top:12px">${I('plus')}Nouvelle affaire</button></li>`}</ul></div></div>
      </div>`;
    $('#cNew').onclick = () => dealForm({ orgId: es[0].id });
    $$('[data-quick]', v).forEach((b) => (b.onclick = () => dealForm({ orgId: es[0].id })));
    bindRows(v);
  }

  const TYPE_ORDER = ['Lève-personne sur rail', 'Rail', 'Lève-personne mobile', 'Chaise de douche', 'Chaise de bain'];
  const TYPE_PL = { 'Lève-personne sur rail': 'lève-personnes sur rail', Rail: 'rails', 'Lève-personne mobile': 'lève-personnes mobiles', 'Chaise de douche': 'chaises de douche', 'Chaise de bain': 'chaises de bain' };
  function viewEtab(id) {
    const v = $('#view'); const o = org(id);
    if (!o) return viewClients();
    const c = client(o.clientId); const eqs = eqsOf(id).slice().sort((a, b) => (a.local < b.local ? -1 : a.local > b.local ? 1 : TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type)));
    const s = statsOf(eqs); const locaux = new Set(eqs.map((e) => e.local)).size;
    const tab = parcState.etabTab && parcState.etabFor === id ? parcState.etabTab : 'apercu';
    const f = parcState.eqF || 'tous'; const q = norm(parcState.eqQ || '');
    const deals = db.deals.filter((d) => d.orgId === id).sort((a, b) => (a.status === 'open' ? 0 : 1) - (b.status === 'open' ? 0 : 1) || b.value - a.value);
    const projs = db.projects.filter((p) => p.orgId === id && p.status === 'open');
    const ppl = db.persons.filter((p) => p.orgId === id);
    const TABS = [['apercu', 'Aperçu'], ['equipements', 'Équipements', s.n], ['ventes', 'Ventes', deals.filter((d) => d.status === 'open').length], ['contacts', 'Contacts', ppl.length]];
    const shown = eqs.filter((e) => (f === 'tous' || (f === 'action' ? ['decider', 'nc'].includes(eqState(e)) : eqState(e) === f)) && (!q || norm(`${e.local} ${e.ns} ${eqTitle(e)} ${e.type}`).includes(q)));
    let body = '';
    if (tab === 'equipements') {
      body = `<div class="eq-tools"><label class="search inline" for="eqq">${I('search')}<input id="eqq" type="search" placeholder="Local, n° de série, modèle" autocomplete="off" value="${esc(parcState.eqQ || '')}"></label>
        <div class="seg" id="eqf">${[['tous', 'Tous'], ['action', 'À traiter', s.decider + s.nc], ['ok', 'Conformes'], ['jamais', 'Jamais faits']].map(([k, l, n]) => `<button aria-pressed="${f === k}" data-f="${k}">${l}${n ? `<span class="tab-n">${n}</span>` : ''}</button>`).join('')}</div></div>
        <div class="card table-card"><div class="tbl-scroll"><table class="tbl">
        <thead><tr><th>Local</th><th>Équipement</th><th class="hide-sm">N° de série</th><th class="hide-sm">Dernier passage</th><th>État</th></tr></thead>
        <tbody>${shown.slice(0, 300).map((e) => `<tr data-href="#equipement-${e.id}"><td class="mono" style="font-weight:600">${esc(e.local)}</td><td><div class="ell t-main" style="max-width:280px;${e.modeleId || e.type === 'Rail' ? '' : 'color:var(--warn)'}">${esc(eqTitle(e))}</div><div class="muted" style="font-size:12.5px">${esc(e.type)}</div></td><td class="hide-sm mono muted">${esc(e.ns)}</td><td class="hide-sm muted">${e.last ? dShort(e.last) + (e.last.slice(0, 4) !== TODAY.slice(0, 4) ? ' ' + e.last.slice(0, 4) : '') : '—'}</td><td>${stateBadge(e)}</td></tr>`).join('') || '<tr><td colspan="5"><div class="empty"><b>Aucun équipement</b>Aucun équipement ne correspond à ce filtre.</div></td></tr>'}</tbody>
        ${shown.length > 300 ? `<tfoot><tr><td colspan="5">${nf.format(shown.length - 300)} autres : précisez la recherche</td></tr></tfoot>` : ''}</table></div></div>`;
    } else if (tab === 'ventes') {
      body = `<div class="grid-2"><div class="card"><div class="card-head"><h2>Affaires</h2><div class="end"><button class="btn plain" data-quick>${I('plus')}Affaire</button></div></div><div class="card-body" style="padding-top:2px"><ul class="rows">${deals.slice(0, 12).map((d) => `<li data-deal="${d.id}"><span class="act-ico">${I('deal')}</span><div class="r-main"><b>${esc(d.title)}</b><span>${d.status === 'open' ? esc(stageOf(d).name) : d.status === 'won' ? 'Gagnée' : 'Perdue'} · ${esc(pipeline(d.pipelineId).name)}</span></div><div class="r-end" style="font-weight:600;color:var(--ink)">${moneyC(d.value)}</div></li>`).join('') || '<li class="empty" style="display:block"><b>Aucune affaire</b></li>'}</ul></div></div>
        <div class="card"><div class="card-head"><h2>Projets</h2></div><div class="card-body" style="padding-top:2px"><ul class="rows">${projs.map((p) => { const pr = progress(p); return `<li data-proj="${p.id}">${ringSvg(pr.r, 32)}<div class="r-main"><b>${esc(projName(p))}</b><span>${pr.n}/${pr.N} tâches · échéance ${dShort(p.end)}</span></div></li>`; }).join('') || '<li class="empty" style="display:block"><b>Aucun projet actif</b>Un projet se crée d’un tap depuis une affaire gagnée.</li>'}</ul></div></div></div>`;
    } else if (tab === 'contacts') {
      body = `<div class="card"><div class="card-body" style="padding-top:8px"><ul class="rows">${ppl.map((p) => `<li data-person="${p.id}"><span class="avatar lg" style="--h:${hueOf(p.name)}">${initials(p.name)}</span><div class="r-main"><b>${esc(p.name)}</b><span>${esc(p.role)}</span></div><div class="r-end">${esc(p.telephone)}</div></li>`).join('') || '<li class="empty" style="display:block"><b>Aucun contact</b></li>'}</ul></div></div>`;
    } else {
      const todo = [
        s.decider && [`${s.decider} intervention${s.decider > 1 ? 's' : ''} à décider`, 'Envoyées par les techniciens, en attente du bureau', 'warn', 'action'],
        s.nc && [`${s.nc} non conforme${s.nc > 1 ? 's' : ''} ouvert${s.nc > 1 ? 's' : ''}`, 'Soumission décidée, en attente de réparation', 'danger', 'action'],
        s.inconnu && [`${s.inconnu} modèle${s.inconnu > 1 ? 's' : ''} à identifier`, 'Équipements sans modèle (rails exclus)', 'warn', 'tous'],
        s.jamais && [`${s.jamais} jamais inspecté${s.jamais > 1 ? 's' : ''}`, 'À placer dans la prochaine tournée', '', 'jamais'],
      ].filter(Boolean);
      body = `<div class="grid-2"><div class="card"><div class="card-head"><h2>À faire sur ce site</h2></div><div class="card-body" style="padding-top:2px"><ul class="rows">${todo.map(([t, sub, cls, ff]) => `<li data-eqf="${ff}"><span class="act-ico ${cls === 'danger' ? 'late' : ''}" style="${cls === 'warn' ? 'background:color-mix(in srgb,var(--warn-fill) 16%,transparent);color:var(--warn)' : ''}">${I(cls ? 'warn' : 'clock')}</span><div class="r-main"><b>${t}</b><span>${sub}</span></div>${I('right', 'chev')}</li>`).join('') || '<li class="empty" style="display:block"><b>Rien en attente</b>Tout le parc de ce site est à jour.</li>'}</ul></div></div>
        <div class="card"><div class="card-head"><h2>Informations du site</h2></div><div class="card-body" style="padding:0 0 8px"><div class="group flat">
          ${kv('Client', esc(c.name), `data-href="#client-${c.id}"`)}${kv('Adresse', `${esc(o.adresse)}, ${esc(o.ville)}`)}${kv('Téléphone', esc(o.telephone))}${kv('Lits', o.lits)}${kv('Locaux équipés', locaux)}${kv('Client depuis', o.clientDepuis || '—')}${kv('Code Acomba', `<span class="mono">${o.acomba}</span>`)}
        </div></div></div></div>`;
    }
    const types = TYPE_ORDER.map((t) => [t, eqs.filter((e) => e.type === t).length]).filter(([, n]) => n);
    v.innerHTML = `${crumbs([['Clients', '#clients'], [c.name, `#client-${c.id}`], [o.name]])}
      <div class="page-head"><div><h1>${esc(o.name)}</h1><div class="sub">${nf.format(s.n)} équipements · ${plural(locaux, 'local', 'locaux')} · dernier passage ${s.last ? rel(s.last).toLowerCase() : '—'}</div></div>
        <div class="tools"><button class="btn primary" id="eNew" aria-label="Nouvelle affaire">${I('plus')}<span class="hide-sm">Nouvelle affaire</span></button></div></div>
      <div class="card type-strip">${types.map(([t, n]) => `<div><b class="num">${nf.format(n)}</b><span>${TYPE_PL[t]}</span></div>`).join('')}</div>
      <div class="seg page-tabs" id="etabTabs" role="tablist">${TABS.map(([k, l, n]) => `<button role="tab" aria-selected="${tab === k}" aria-pressed="${tab === k}" data-t="${k}">${l}${n != null ? `<span class="tab-n">${nf.format(n)}</span>` : ''}</button>`).join('')}</div>
      <div id="etabBody">${body}</div>`;
    $('#eNew').onclick = () => dealForm({ orgId: id });
    $$('[data-quick]', v).forEach((b) => (b.onclick = () => dealForm({ orgId: id })));
    $$('#etabTabs button').forEach((b) => (b.onclick = () => { parcState.etabTab = b.dataset.t; parcState.etabFor = id; render(); }));
    $$('[data-eqf]', v).forEach((li) => (li.onclick = () => { parcState.etabTab = 'equipements'; parcState.etabFor = id; parcState.eqF = li.dataset.eqf; render(); }));
    const eqq = $('#eqq'); if (eqq) eqq.oninput = () => { parcState.eqQ = eqq.value; render(); const n = $('#eqq'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); };
    $$('#eqf button').forEach((b) => (b.onclick = () => { parcState.eqF = b.dataset.f; render(); }));
    bindRows(v);
  }

  function viewEquip(id) {
    const v = $('#view'); const e = equip(id);
    if (!e) return viewClients();
    const o = org(e.etabId), c = client(o.clientId), m = e.modeleId ? modele(e.modeleId) : null;
    const ints = intsOf(id); const st = eqState(e);
    const sibs = eqsOf(o.id).slice().sort((a, b) => (a.local < b.local ? -1 : a.local > b.local ? 1 : TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type)));
    const k = sibs.indexOf(e); const prev = sibs[k - 1], next = sibs[k + 1];
    const soum = db.soumissions.find((x) => x.eqId === id && x.status !== 'annulee');
    const pieceLine = ([pid, qty]) => { const p = db.pieces.find((x) => x.id === pid); return p ? `<li><span class="mono">${esc(p.code)}</span><span class="ell">${esc(p.desc.split(' — ')[0])}</span><span class="num">× ${qty}</span></li>` : ''; };
    v.innerHTML = `${crumbs([['Clients', '#clients'], [c.name, `#client-${c.id}`], [o.name, `#etablissement-${o.id}`], [`Local ${e.local}`]])}
      <div class="page-head"><div><h1>${esc(eqTitle(e))}</h1><div class="sub">${esc(e.type)} · local <b class="mono">${esc(e.local)}</b> · <span class="mono">${esc(e.ns)}</span></div>
        <div style="margin-top:10px">${stateBadge(e)}</div></div>
        <div class="tools"><span class="muted num" style="font-size:13px">${k + 1} sur ${sibs.length}</span>
          <a class="icon-btn" ${prev ? `href="#equipement-${prev.id}"` : 'aria-disabled="true"'} aria-label="Équipement précédent" data-tip="Précédent">${I('right', 'flip')}</a>
          <a class="icon-btn" ${next ? `href="#equipement-${next.id}"` : 'aria-disabled="true"'} aria-label="Équipement suivant" data-tip="Suivant">${I('right')}</a></div></div>
      <div class="grid-2">
        <div style="display:flex;flex-direction:column;gap:16px;min-width:0">
          <div class="card"><div class="card-head"><h2>Interventions</h2><span class="meta num">${ints.length}</span></div><div class="card-body" style="padding-top:4px">
            ${ints.length ? `<ul class="timeline int-list">${ints.map((x) => `<li><span class="act-ico ${x.verdict === 'nc' ? 'late' : ''}">${I(x.verdict === 'nc' ? 'warn' : 'check')}</span><div class="tl-main"><b>${esc(x.type)}</b><span>${dLong(x.date)} · ${esc(tech(x.techId).name)}</span>
              ${x.note ? `<p>« ${esc(x.note)} »</p>` : ''}${x.pieces.length ? `<ul class="piece-list">${x.pieces.map(pieceLine).join('')}</ul>` : ''}</div>
              <span class="badge ${x.status === 'a_valider' ? 'warn' : x.verdict === 'nc' ? 'danger' : 'ok'}">${x.status === 'a_valider' ? 'À décider' : x.verdict === 'nc' ? 'Non conforme' : 'Conforme'}</span></li>`).join('')}</ul>`
              : `<div class="empty" style="padding:28px 12px"><b>Jamais inspecté</b>La première intervention apparaîtra ici dès qu’un technicien l’envoie.</div>`}
          </div></div>
          ${soum ? `<div class="card"><div class="card-head"><h2>Soumission</h2><span class="badge ${soum.status === 'saisie' ? 'ok' : 'warn'}">${soum.status === 'saisie' ? `Saisie dans Acomba · ${esc(soum.acomba)}` : 'À saisir dans Acomba'}</span></div><div class="card-body"><div class="muted" style="font-size:13px">Décidée lors de la validation du ${dLong(db.interventions.find((x) => x.id === soum.interventionId).date)}. Les prix se font dans Acomba.</div></div></div>` : ''}
        </div>
        <div style="display:flex;flex-direction:column;gap:16px;min-width:0">
          <div class="card"><div class="card-head"><h2>Informations</h2></div><div class="card-body" style="padding:0 0 8px"><div class="group flat">
            ${kv('Établissement', esc(o.name), `data-href="#etablissement-${o.id}"`)}${kv('Local', `<span class="mono">${esc(e.local)}</span>`)}${kv('Type', esc(e.type))}
            ${kv('Marque', m ? esc(marque(m.marqueId).name) : '<span style="color:var(--warn)">À identifier</span>')}${kv('Modèle', m ? esc(m.name) : '<span style="color:var(--warn)">À identifier</span>')}
            ${m && m.capacite ? kv('Capacité', `${m.capacite} kg`) : ''}${kv('N° de série', `<span class="mono">${esc(e.ns)}</span>`)}${kv('Année de fabrication', e.annee)}
          </div></div></div>
          <div class="card"><div class="card-head"><h2>Photos</h2><span class="meta">Dernière intervention</span></div><div class="card-body"><div class="photos">${['Plaque signalétique', 'Vue d’ensemble', 'Rail et local', st === 'nc' || st === 'decider' ? 'Anomalie' : 'Étiquette d’inspection'].map((l) => `<figure>${I('cam')}<figcaption>${l}</figcaption></figure>`).join('')}</div></div></div>
        </div>
      </div>`;
    bindRows(v);
  }

  /* ———————————————————— Parc : À valider, validation, soumissions ———————————————————— */
  const intv = (id) => db.interventions.find((x) => x.id === id);
  const eqWhere = (e) => { const o = org(e.etabId); return `${o.name} · local ${e.local}`; };
  // File « À décider » : non-conformités envoyées par les techniciens, plus récentes d'abord, filtres client/technicien.
  function queue() {
    const f = parcState;
    return db.interventions.filter((x) => x.status === 'a_valider').filter((x) => {
      const e = equip(x.eqId);
      return (!f.qClient || org(e.etabId).clientId === f.qClient) && (!f.qTech || x.techId === f.qTech);
    }).sort((a, b) => (a.date > b.date ? -1 : a.date < b.date ? 1 : a.id - b.id));
  }
  const unknownEqs = () => db.equipements.filter((e) => !e.modeleId && e.type !== 'Rail' && (!parcState.qClient || org(e.etabId).clientId === parcState.qClient));

  function viewAValider() {
    const v = $('#view');
    const tab = parcState.vTab || 'nc';
    const q = queue(); const unk = unknownEqs();
    const cl = parcState.qClient ? client(parcState.qClient) : null; const te = parcState.qTech ? tech(parcState.qTech) : null;
    const TABS_V = [['nc', 'À décider', q.length, 'À décider'], ['modele', 'Modèle à identifier', unk.length, 'Modèles'], ['nouveau', 'Nouveaux équipements', 0, 'Nouveaux']];
    let list = '';
    if (tab === 'nc') {
      list = q.map((x) => { const e = equip(x.eqId); return `<li data-href="#valider-${x.id}"><span class="act-ico late">${I('warn')}</span><div class="r-main"><b>${esc(eqTitle(e))}<i class="r-type"> · ${esc(e.type.toLowerCase())}</i></b><span>${esc(eqWhere(e))}</span><span class="r-note">« ${esc(x.note)} »</span></div><div class="r-end hide-sm">${esc(tech(x.techId).name)}<br>${rel(x.date)}</div><span class="btn">Décider</span></li>`; }).join('');
    } else if (tab === 'modele') {
      list = unk.slice(0, 80).map((e) => `<li data-ident="${e.id}"><span class="act-ico" style="background:color-mix(in srgb,var(--warn-fill) 16%,transparent);color:var(--warn)">${I('cam')}</span><div class="r-main"><b>${esc(e.type)} · n° <span class="mono">${esc(e.ns)}</span></b><span>${esc(eqWhere(e))}</span></div><span class="btn">Identifier</span></li>`).join('');
    }
    v.innerHTML = `<div class="page-head"><div><h1>À valider</h1><div class="sub">Envoyé par les techniciens depuis RailConfig, en attente du bureau</div></div>
      <div class="tools">${tab === 'nc' && q.length ? `<a class="btn primary" href="#valider-${q[0].id}" aria-label="Traiter un par un">${I('check')}<span class="hide-sm">Traiter un par un</span></a>` : ''}</div></div>
      <div class="seg page-tabs" id="vTabs" role="tablist">${TABS_V.map(([k, l, n, sh]) => `<button role="tab" aria-selected="${tab === k}" aria-pressed="${tab === k}" data-t="${k}" title="${l}"><span class="hide-sm">${l}</span><span class="mobile-only">${sh}</span><span class="tab-n">${nf.format(n)}</span></button>`).join('')}</div>
      <div class="eq-tools"><button class="pill" id="vClient">${cl ? esc(cl.name) : 'Tous les clients'} ${I('down', 'chev')}</button>${tab === 'nc' ? `<button class="pill" id="vTech">${te ? esc(te.name) : 'Tous les techniciens'} ${I('down', 'chev')}</button>` : ''}<span class="muted" style="font-size:13px">Plus récents en premier</span></div>
      <div class="card" style="padding:0 16px 0 12px"><ul class="rows queue">${list || `<li class="empty" style="display:block"><b>${tab === 'nouveau' ? 'Aucun nouvel équipement' : 'Rien à valider'}</b>${tab === 'nouveau' ? 'Les équipements ajoutés sur le terrain par les techniciens apparaîtront ici.' : 'Les non-conformités envoyées par les techniciens apparaîtront ici.'}</li>`}</ul></div>`;
    $$('#vTabs button').forEach((b) => (b.onclick = () => { parcState.vTab = b.dataset.t; render(); }));
    $('#vClient').onclick = (ev) => menu(ev.currentTarget, [{ l: 'Tous les clients', on: !parcState.qClient, fn: () => { parcState.qClient = 0; render(); } }, { sep: true },
      ...db.clients.map((c) => ({ l: esc(c.name), on: parcState.qClient === c.id, fn: () => { parcState.qClient = c.id; render(); } }))], 'Client');
    const vt = $('#vTech'); if (vt) vt.onclick = (ev) => menu(ev.currentTarget, [{ l: 'Tous les techniciens', on: !parcState.qTech, fn: () => { parcState.qTech = 0; render(); } }, { sep: true },
      ...db.techniciens.map((t) => ({ l: esc(t.name), on: parcState.qTech === t.id, fn: () => { parcState.qTech = t.id; render(); } }))], 'Technicien');
    $$('[data-ident]', v).forEach((li) => (li.onclick = () => identifyModel(equip(+li.dataset.ident))));
    bindRows(v);
  }

  // Identifier ou corriger le modèle : les modèles du même type, en un tap.
  function identifyModel(e, after) {
    const opts = db.modeles.filter((m) => m.type === e.type);
    sheetState = null;
    sheet(`${sheetTop(`${esc(e.type)} · local ${esc(e.local)}`)}<div class="sheet-scroll"><h2>Quel modèle ?</h2><div class="lead">n° <span class="mono">${esc(e.ns)}</span> · ${esc(org(e.etabId).name)}</div>
      <div class="photos" style="margin-top:16px"><figure>${I('cam')}<figcaption>Plaque signalétique</figcaption></figure><figure>${I('cam')}<figcaption>Vue d’ensemble</figcaption></figure></div>
      <div class="group-h">Modèles · ${esc(e.type.toLowerCase())}</div><div class="group" style="margin-top:0">${opts.map((m) => kv(`<span style="color:var(--ink);font-weight:500">${esc(modeleName(m))}</span>`, e.modeleId === m.id ? `<span class="badge ok">${I('check')}Actuel</span>` : '', `data-pick="${m.id}"`)).join('')}</div></div>`, (s) => {
      $$('[data-pick]', s).forEach((r) => (r.onclick = () => {
        const prev = e.modeleId; e.modeleId = +r.dataset.pick; save(); closeSheet(); render();
        toast(`Identifié : ${modeleName(modele(e.modeleId))}`, () => { e.modeleId = prev; save(); render(); });
        if (after) after();
      }));
    });
  }

  const DECISIONS = [['corrige', '1', 'Corrigé sur place', 'Rien à facturer'], ['soumission', '2', 'Soumission requise', 'Pièces ou main-d’œuvre à proposer'], ['aucune', '3', 'Pas de soumission', 'Client avisé, aucune suite']];
  const pieceRow = ([pid, qty]) => { const p = db.pieces.find((x) => x.id === pid); return p ? `<li><span class="mono">${esc(p.code)}</span><span class="ell">${esc(p.desc.split(' — ')[0])}</span><span class="num">× ${qty}</span></li>` : ''; };
  function viewValider(id) {
    const v = $('#view'); const x = intv(id);
    if (!x) return viewAValider();
    const e = equip(x.eqId), o = org(e.etabId), c = client(o.clientId), m = e.modeleId ? modele(e.modeleId) : null;
    const q = queue(); let pos = q.findIndex((y) => y.id === id);
    const done = x.status === 'valide';
    const list = pos >= 0 ? q : [x];
    if (pos < 0) pos = 0;
    const choice = parcState.choice && parcState.choiceFor === id ? parcState.choice : x.decision || 'soumission';
    const photo = parcState.photoFor === id ? parcState.photo || 0 : 0;
    const PH = ['Plaque signalétique', 'Vue d’ensemble', 'Anomalie signalée'];
    v.innerHTML = `${crumbs([['À valider', '#avalider'], ['À décider', '#avalider'], [done ? 'Décidée' : `${pos + 1} sur ${list.length}`]])}
      <div class="page-head"><div><h1>${esc(eqTitle(e))} · local ${esc(e.local)}</h1><div class="sub"><a href="#client-${c.id}">${esc(c.name)}</a> · <a href="#etablissement-${o.id}">${esc(o.name)}</a></div></div>
        <div class="tools"><span class="muted num" style="font-size:13px">${done ? 'Déjà décidée' : `${pos + 1} sur ${list.length}`}</span>
          <button class="icon-btn" id="vPrev" aria-label="Précédent (flèche gauche)" ${pos <= 0 || done ? 'disabled' : ''} data-tip="Précédent (←)">${I('right', 'flip')}</button>
          <button class="icon-btn" id="vNext" aria-label="Suivant (flèche droite)" ${pos >= list.length - 1 || done ? 'disabled' : ''} data-tip="Suivant (→)">${I('right')}</button></div></div>
      ${done ? '' : `<div class="qbar" role="progressbar" aria-label="Progression dans la file" aria-valuemin="0" aria-valuemax="${list.length}" aria-valuenow="${pos + 1}"><i style="width:${((pos + 1) / list.length) * 100}%"></i></div>`}
      <div class="grid-2 val-grid">
        <div class="card"><div class="card-head"><h2>Photos du technicien</h2><span class="meta">${PH.length}</span></div><div class="card-body">
          <div class="photo-main">${I('cam')}<span>${PH[photo]}</span></div>
          <div class="photo-thumbs">${PH.map((l, k) => `<button type="button" aria-pressed="${k === photo}" data-ph="${k}">${l}</button>`).join('')}</div></div></div>
        <div style="display:flex;flex-direction:column;gap:16px;min-width:0">
          <div class="card"><div class="card-head"><h2>${esc(x.type)}</h2><div class="end"><span class="badge danger">Non conforme</span></div></div><div class="card-body" style="padding-top:2px">
            <div class="muted" style="font-size:13px">${dLong(x.date)} · ${esc(tech(x.techId).name)}</div><p class="quote">« ${esc(x.note)} »</p>
            ${x.pieces.length ? `<div class="sub-h">Pièces notées par le technicien</div><ul class="piece-list">${x.pieces.map(pieceRow).join('')}</ul>` : '<div class="muted" style="font-size:13px">Aucune pièce notée.</div>'}</div></div>
          <div class="card"><div class="card-head"><h2 id="dec-h">Décision</h2></div><div class="card-body" style="padding-top:4px">
            <div class="decisions" role="radiogroup" aria-labelledby="dec-h">${DECISIONS.map(([k, key, l, hint]) => `<button type="button" role="radio" aria-checked="${choice === k}" data-dec="${k}"><kbd>${key}</kbd><span><b>${l}</b><span>${hint}</span></span></button>`).join('')}</div>
            <button class="btn primary lg" id="vSave" style="width:100%;margin-top:14px">${done ? 'Modifier la décision' : 'Enregistrer et passer au suivant'} <kbd class="on-accent">↵</kbd></button>
            <div class="kbd-help hide-sm"><span><kbd>←</kbd><kbd>→</kbd> précédent / suivant</span><span><kbd>1</kbd><kbd>2</kbd><kbd>3</kbd> décision</span><span><kbd>E</kbd> corriger</span><span><kbd>Échap</kbd> retour</span></div>
          </div></div>
          <div class="card"><div class="card-head"><h2>Équipement identifié</h2><div class="end"><button class="btn plain" id="vFix">Corriger <kbd class="hide-sm">E</kbd></button></div></div><div class="card-body" style="padding:0 0 6px"><div class="group flat">
            ${kv('Type', esc(e.type))}${kv('Marque', m ? esc(marque(m.marqueId).name) : '<span style="color:var(--warn)">À identifier</span>')}${kv('Modèle', m ? esc(m.name) : '<span style="color:var(--warn)">À identifier</span>')}${kv('N° de série', `<span class="mono">${esc(e.ns)}</span>`)}${kv('Fiche équipement', 'Ouvrir', `data-href="#equipement-${e.id}"`)}
          </div></div></div>
        </div>
      </div>`;
    const go = (d) => { const n = list[pos + d]; if (n && !done) location.hash = `valider-${n.id}`; };
    $('#vPrev').onclick = () => go(-1); $('#vNext').onclick = () => go(1);
    $$('[data-ph]', v).forEach((b) => (b.onclick = () => { parcState.photo = +b.dataset.ph; parcState.photoFor = id; render(); }));
    $$('[data-dec]', v).forEach((b) => (b.onclick = () => { parcState.choice = b.dataset.dec; parcState.choiceFor = id; render(); }));
    $('#vFix').onclick = () => identifyModel(e, () => location.hash === `#valider-${id}` && render());
    $('#vSave').onclick = () => decide(x, choice, list, pos);
    bindRows(v);
  }
  function decide(x, choice, list, pos) {
    const e = equip(x.eqId); const prev = { status: x.status, decision: x.decision, etat: e.etat };
    x.status = 'valide'; x.decision = choice;
    if (choice === 'corrige') e.etat = 'ok';
    let so = db.soumissions.find((s) => s.interventionId === x.id);
    let created = null;
    if (choice === 'soumission' && !so) { created = { id: Math.max(8000, ...db.soumissions.map((s) => s.id)) + 1, interventionId: x.id, eqId: e.id, etabId: e.etabId, status: 'a_saisir', acomba: null, dealId: null, created: TODAY }; db.soumissions.push(created); }
    if (choice !== 'soumission' && so && so.status === 'a_saisir') db.soumissions.splice(db.soumissions.indexOf(so), 1);
    save(); IX = null; parcState.choice = null;
    const next = queue()[0];
    toast(choice === 'soumission' ? 'Soumission à saisir dans Acomba' : choice === 'corrige' ? 'Corrigé sur place' : 'Pas de soumission', () => {
      Object.assign(x, { status: prev.status, decision: prev.decision }); e.etat = prev.etat; if (created) db.soumissions.splice(db.soumissions.indexOf(created), 1); save(); IX = null; location.hash = `valider-${x.id}`; render();
    });
    location.hash = next ? `valider-${next.id}` : 'avalider';
    if (!next) setTimeout(() => toast('File terminée : tout est décidé'), 2600);
  }

  const SO_ST = [['a_saisir', 'À saisir dans Acomba'], ['saisie', 'Attend le client'], ['acceptee', 'Acceptées'], ['refusee', 'Refusées ou sans suite']];
  function soLines(so) { const x = intv(so.interventionId); return x ? x.pieces : []; }
  function viewSoumissions() {
    const v = $('#view'); const st = parcState.soSt || 'a_saisir';
    const items = db.soumissions.filter((s) => s.status === st).sort((a, b) => (a.created > b.created ? -1 : 1));
    let sel = items.find((s) => s.id === parcState.soSel) || items[0];
    const mobile = matchMedia('(max-width: 760px)').matches;
    v.innerHTML = `${crumbs([['À valider', '#avalider'], ['Soumissions']])}<div class="page-head"><div><h1>Soumissions</h1><div class="sub">L’appli prépare les pièces ; la soumission se saisit dans Acomba, puis son numéro devient une affaire</div></div>
      <div class="tools"><button class="btn" id="soXls">${I('doc')}<span class="hide-sm">Exporter en Excel</span></button></div></div>
      <div class="seg page-tabs" id="soTabs" role="tablist" style="max-width:860px">${SO_ST.map(([k, l]) => `<button role="tab" aria-selected="${st === k}" aria-pressed="${st === k}" data-s="${k}">${l}<span class="tab-n">${db.soumissions.filter((s) => s.status === k).length}</span></button>`).join('')}</div>
      ${items.length ? `<div class="so-split"><div class="card so-list"><ul class="rows">${items.map((s) => { const e = equip(s.eqId); const x = intv(s.interventionId); return `<li data-so="${s.id}" ${!mobile && sel && s.id === sel.id ? 'aria-current="true"' : ''}><div class="r-main"><b>${esc(eqTitle(e))}</b><span>${esc(eqWhere(e))}</span><span>${s.acomba ? `<span class="mono">${esc(s.acomba)}</span> · ` : ''}${plural(soLines(s).length, 'pièce')} · ${esc(tech(x.techId).name)}</span></div><div class="r-end">${rel(s.created)}</div></li>`; }).join('')}</ul></div>
        ${mobile ? '' : `<div class="card so-detail" id="soDetail"></div>`}</div>`
        : `<div class="card"><div class="empty"><b>${{ a_saisir: 'Rien à saisir', saisie: 'Aucune soumission en attente', acceptee: 'Aucune soumission acceptée', refusee: 'Aucune soumission refusée' }[st]}</b>${{ a_saisir: 'Les non-conformités avec la décision « Soumission requise » arrivent ici.', saisie: 'Une fois le n° Acomba noté, la soumission attend la réponse du client ici.', acceptee: 'Les travaux acceptés deviennent une intervention à planifier.', refusee: 'Les soumissions refusées ou sans suite restent consultables ici.' }[st]}</div></div>`}`;
    $$('#soTabs button').forEach((b) => (b.onclick = () => { parcState.soSt = b.dataset.s; parcState.soSel = null; render(); }));
    $('#soXls').onclick = () => toast(`${plural(items.length, 'soumission')} prête${items.length > 1 ? 's' : ''} pour Excel (simulation)`);
    $$('[data-so]', v).forEach((li) => (li.onclick = () => { parcState.soSel = +li.dataset.so; if (mobile) soSheet(+li.dataset.so); else render(); }));
    if (!mobile && sel) soDetail($('#soDetail'), sel);
  }
  function soSheet(id) {
    sheetState = { fn: soSheet, id, same: sheetState && sheetState.id === id };
    sheet(`${sheetTop('Soumission')}<div class="sheet-scroll" id="soSheetBody"></div>`, (s) => soDetail($('#soSheetBody', s), db.soumissions.find((x) => x.id === id), true));
  }
  function soDetail(el, so, inSheet) {
    const e = equip(so.eqId), x = intv(so.interventionId), d = so.dealId ? deal(so.dealId) : null;
    const lines = soLines(so); const ticks = parcState.ticks && parcState.ticksFor === so.id ? parcState.ticks : {};
    const nDone = Object.values(ticks).filter(Boolean).length;
    el.innerHTML = `<div class="${inSheet ? '' : 'card-body'}" style="${inSheet ? '' : 'padding-top:18px'}">
      <div class="so-h"><div><h2 style="margin:0;font:600 19px/1.3 var(--font-display);letter-spacing:-.015em">${esc(eqTitle(e))}</h2><div class="muted" style="font-size:13px">${esc(eqWhere(e))} · ${dShort(x.date)} · ${esc(tech(x.techId).name)}</div></div><a class="btn plain" href="#equipement-${e.id}">Fiche équipement</a></div>
      <p class="quote">« ${esc(x.note)} »</p>
      ${so.status === 'a_saisir' ? `${lines.length ? `<div class="sub-h" style="display:flex">À saisir dans Acomba<span class="muted" style="margin-left:auto;font-weight:500">${nDone} sur ${lines.length}</span></div>
        <ol class="acomba-lines">${lines.map(([pid, qty], k) => { const p = db.pieces.find((y) => y.id === pid); return `<li><button type="button" class="check ${ticks[k] ? 'on' : ''}" role="checkbox" aria-checked="${!!ticks[k]}" aria-label="Ligne ${esc(p.code)} saisie dans Acomba" data-tick="${k}"><svg viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg></button><span class="al-main"><b class="mono">${esc(p.code)}</b><span>${esc(p.desc.split(' — ')[0])}</span></span><span class="num">× ${qty}</span><button type="button" class="btn sm" data-copy="${esc(p.code)}">Copier</button></li>`; }).join('')}</ol>`
        : `<div class="int-note">${I('warn')}<span>Le technicien n’a pas noté de pièces : à choisir dans la fiche du modèle.</span></div>`}
        <form class="acomba-form" id="soForm"><div class="field"><label for="so-no">N° de soumission Acomba</label><input id="so-no" required placeholder="ex. S-26-123" autocomplete="off"></div>
          <div class="field"><label for="so-v">Montant ($)</label><input id="so-v" inputmode="numeric" placeholder="Optionnel" autocomplete="off"></div>
          <button class="btn primary lg">Marquer comme saisie</button></form>`
      : `<div class="group" style="margin-top:16px">${kv('N° Acomba', `<span class="mono">${esc(so.acomba || '—')}</span>`)}${d ? kv('Affaire', `${esc(stageOf(d).name)} · ${moneyC(d.value)}`, `data-deal="${d.id}"`) : ''}</div>
        ${so.status === 'saisie' ? `<div class="actions"><button class="btn ok lg" data-res="acceptee">${I('check')}Acceptée</button><button class="btn danger lg" data-res="refusee">${I('x')}Refusée</button></div>` : ''}`}
    </div>`;
    $$('[data-tick]', el).forEach((b) => (b.onclick = () => { const t = Object.assign({}, ticks); t[b.dataset.tick] = !t[b.dataset.tick]; parcState.ticks = t; parcState.ticksFor = so.id; soDetail(el, so, inSheet); }));
    $$('[data-copy]', el).forEach((b) => (b.onclick = () => {
      const txt = b.dataset.copy; const done = () => { b.textContent = 'Copié'; setTimeout(() => (b.textContent = 'Copier'), 1400); };
      try { navigator.clipboard.writeText(txt).then(done, done); } catch (er) { done(); }
    }));
    const f = $('#soForm', el);
    if (f) f.onsubmit = (ev) => { ev.preventDefault(); markEntered(so, $('#so-no', el).value.trim(), +String($('#so-v', el).value).replace(/[^\d]/g, '') || 0); };
    $$('[data-res]', el).forEach((b) => (b.onclick = () => resolveSo(so, b.dataset.res)));
    bindRows(el);
  }
  // Soumission saisie dans Acomba → affaire « Soumission d'achat » (créée, ou avancée si elle existe).
  function markEntered(so, no, value) {
    if (!no) return;
    const e = equip(so.eqId), x = intv(so.interventionId), m = e.modeleId ? modele(e.modeleId) : null;
    const pc = x.pieces[0] ? db.pieces.find((p) => p.id === x.pieces[0][0]) : null;
    let d = so.dealId ? deal(so.dealId) : null; const isNew = !d;
    if (!d) {
      d = { id: Math.max(...db.deals.map((q) => q.id)) + 1, title: `${pc ? pc.desc.split(' — ')[0] : 'Réparation'} — ${m ? m.name : e.type} local ${e.local}`, pipelineId: 7, stageId: 71, orgId: e.etabId,
        personId: (db.persons.find((p) => p.orgId === e.etabId) || {}).id || null, ownerId: 1, value, status: 'open', created: TODAY, stageChanged: TODAY, expectedClose: isoAdd(30), lostReason: null, closeDate: null, soumission: no, labels: [] };
      db.deals.push(d);
    } else { d.stageId = 71; d.stageChanged = TODAY; d.soumission = no; if (value) d.value = value; }
    Object.assign(so, { status: 'saisie', acomba: no, dealId: d.id }); save();
    closeSheet(); parcState.soSel = null; render();
    toast(`${isNew ? 'Affaire créée' : 'Affaire mise à jour'} · Soumission d’achat`, () => { Object.assign(so, { status: 'a_saisir', acomba: null, dealId: isNew ? null : so.dealId }); if (isNew) db.deals.splice(db.deals.indexOf(d), 1); save(); render(); }, false, { l: 'Ouvrir', fn: () => openDeal(d.id) });
  }
  function resolveSo(so, res) {
    const d = so.dealId ? deal(so.dealId) : null; const prev = { so: so.status, d: d && { stageId: d.stageId, status: d.status, lostReason: d.lostReason, closeDate: d.closeDate } };
    so.status = res;
    if (d && res === 'acceptee') { d.stageId = 74; d.stageChanged = TODAY; }
    if (d && res === 'refusee') { d.status = 'lost'; d.lostReason = 'Refusée par le client'; d.closeDate = TODAY; }
    save(); closeSheet(); render();
    toast(res === 'acceptee' ? 'Soumission acceptée · affaire à « Acceptée »' : 'Soumission refusée · affaire perdue', () => { so.status = prev.so; if (d) Object.assign(d, prev.d); save(); render(); });
  }

  /* ———————————————————— Liaisons des lignes ———————————————————— */
  function bindRows(root) {
    $$('[data-done]', root).forEach((b) => (b.onclick = (e) => {
      e.stopPropagation();
      const a = db.activities.find((x) => x.id === +b.dataset.done);
      a.done = !a.done; save();
      b.classList.toggle('on', a.done);
      const d = deal(a.dealId);
      // Plus rien de planifié sur cette affaire : proposer la suite tout de suite.
      const needsNext = a.done && d && d.status === 'open' && !db.activities.some((x) => x.dealId === d.id && !x.done);
      if (needsNext) setTimeout(() => nextStep(a), 280);
      else if (a.done) toast('Activité terminée', () => { a.done = false; save(); render(); refreshSheet(); });
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
  let sheetState = null, lastFocus = null;
  function sheet(html, onBind) {
    let s = $('#sheet');
    if (!s) {
      lastFocus = document.activeElement;
      document.body.insertAdjacentHTML('beforeend', '<div class="scrim" id="scrim"></div><aside class="sheet" id="sheet" role="dialog" aria-modal="true" tabindex="-1"></aside>');
      s = $('#sheet');
      setTimeout(() => { if (!s.contains(document.activeElement)) s.focus({ preventScroll: true }); }, 60);
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
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
    lastFocus = null;
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
          ${d.status === 'open' ? `<button class="btn ok lg" data-st="won">${I('check')}Gagnée</button><button class="btn danger lg" data-st="lost">${I('x')}Perdue</button>` : `${d.status === 'won' && !proj.length ? `<button class="btn primary lg" data-mkproj>${I('proj')}Créer le projet</button>` : ''}<button class="btn lg" data-st="open">${I('undo')}Rouvrir</button>`}
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
      $$('[data-mkproj]', s).forEach((b) => (b.onclick = () => projectFromDeal(d)));
      $('#noteAdd', s).onclick = () => {
        const t = $('#noteTxt', s).value.trim(); if (!t) return;
        db.notes.push({ id: Date.now(), dealId: d.id, date: TODAY, authorId: 1, text: t }); save(); refreshSheet(); toast('Note ajoutée');
      };
      const ta = $('#noteTxt', s); ta.oninput = () => { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; };
      bindRows(s);
    });
  }

  const LOST_REASONS = ['Prix trop élevé', 'Compétiteur choisi', 'Budget reporté', 'Aucune réponse', 'Projet annulé'];
  function lostReason(anchor, cb) {
    menu(anchor, LOST_REASONS.map((r) => ({ l: r, fn: () => cb(r) })), 'Raison de la perte');
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

  function openOrg(id) { closeSheet(); openEtab(id); }
  function openOrgSheet(id) {
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
  function modal(title, body, primary, onOk, focusId) {
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
    setTimeout(() => { const f = focusId ? $('#' + focusId, w) : $('input:not([type=hidden])', w); if (f) f.focus(); }, 60);
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

  // Après une activité terminée : note facultative + suivi en un tap.
  const FOLLOW = [['Demain', 1], ['1 semaine', 7], ['2 semaines', 14], ['1 mois', 30]];
  function nextStep(a) {
    const d = deal(a.dealId); const o = org(d.orgId);
    const draftKey = `note-${a.id}`;
    const w = document.createElement('div');
    w.innerHTML = `<div class="scrim on" style="z-index:65"></div><div class="modal-wrap"><div class="modal next-step" role="dialog" aria-modal="true" aria-labelledby="ns-h">
      <div class="modal-h"><span class="ns-ok">${I('check')}</span><div style="flex:1;min-width:0"><h2 id="ns-h">${esc(a.subject)}</h2><div class="ns-sub">${esc(d.title)} · ${esc(o.name)}</div></div><button type="button" class="icon-btn" data-x aria-label="Fermer">${I('x')}</button></div>
      <div class="modal-b">
        <textarea id="ns-note" class="ns-note" rows="3" placeholder="Ce qui s’est dit (facultatif)">${esc(drafts[draftKey] || '')}</textarea>
        <div class="ns-lbl">Planifier le suivi</div>
        <div class="ns-grid">${FOLLOW.map(([l, n]) => `<button type="button" class="ns-chip" data-in="${n}"><b>${l}</b><span>${dShort(isoAdd(n))}</span></button>`).join('')}</div>
        <div class="ns-out" id="ns-out"><span class="ns-lbl" style="margin:0">Ou clore l’affaire</span><button type="button" class="btn ok" data-won>${I('check')}Gagnée</button><button type="button" class="btn danger" data-lost>${I('x')}Perdue</button></div>
        <div class="ns-reasons" id="ns-reasons" hidden><div class="ns-lbl">Raison de la perte</div><div class="chips">${LOST_REASONS.map((r) => `<button type="button" class="chip" data-reason="${esc(r)}">${esc(r)}</button>`).join('')}</div></div>
      </div>
      <div class="modal-f"><button type="button" class="btn lg" data-none>Pas de suivi</button></div></div></div>`;
    document.body.appendChild(w);
    const ta = $('#ns-note', w);
    ta.oninput = () => { drafts[draftKey] = ta.value; };
    const saveNote = () => { const t = ta.value.trim(); if (t) db.notes.push({ id: Date.now(), dealId: d.id, date: TODAY, authorId: 1, text: t }); delete drafts[draftKey]; return !!t; };
    const close = () => { w.remove(); render(); refreshSheet(); };
    $$('[data-in]', w).forEach((b) => (b.onclick = () => {
      const noted = saveNote(); const due = isoAdd(+b.dataset.in);
      const f = { id: Date.now() + 1, dealId: d.id, type: 'appel', subject: 'Suivi', due, time: a.time || '10:00', done: false, ownerId: a.ownerId };
      db.activities.push(f); save(); close();
      toast(`${noted ? 'Note ajoutée · ' : ''}Suivi le ${dShort(due)}`, () => { db.activities.splice(db.activities.indexOf(f), 1); save(); render(); refreshSheet(); });
    }));
    $('[data-won]', w).onclick = () => { saveNote(); w.remove(); setStatus(d, 'won'); };
    $('[data-lost]', w).onclick = () => { $('#ns-reasons', w).hidden = false; $('#ns-out', w).hidden = true; $('[data-reason]', w).focus(); };
    $$('[data-reason]', w).forEach((b) => (b.onclick = () => { saveNote(); w.remove(); setStatus(d, 'lost', b.dataset.reason); }));
    $('[data-none]', w).onclick = () => { const noted = saveNote(); save(); close(); toast(noted ? 'Note ajoutée' : 'Activité terminée'); };
    // Fermer garde la note : rien de ce qui a été tapé n'est perdu.
    $$('[data-x]', w).forEach((b) => (b.onclick = () => { const noted = saveNote(); save(); close(); if (noted) toast('Note ajoutée'); }));
    w.addEventListener('keydown', (e) => { if (e.key === 'Escape') $('[data-x]', w).click(); });
    setTimeout(() => ta.focus({ preventScroll: true }), 80);
  }
  const drafts = {};

  // Ajout rapide : organisation (récentes en un tap, sinon autocomplétion), titre, valeur.
  // Pipeline = le dernier utilisé ; étape, responsable et date de clôture prennent des valeurs par défaut.
  const PL_SHORT = { 1: 'Vente', 7: 'Achat', 9: 'Entretien', 6: 'Montérégie', 10: 'Terrain' };
  const TITLE_HINTS = {
    1: ['Lève-personnes sur rail', 'Rails de plafond', 'Demande d’info'],
    7: ['Achat moteurs', 'Achat toiles', 'Chargeurs muraux'],
    9: ['Entretien préventif', 'Inspection des toiles', 'Réparation'],
    6: ['Démonstration', 'Projet pilote'],
    10: ['Rail endommagé', 'Sangle usée', 'Moteur défectueux', 'Ajout de chargeur'],
  };
  function recentOrgs() {
    const seen = new Set(), out = [];
    db.deals.filter((d) => d.ownerId === 1).sort((a, b) => (a.created > b.created ? -1 : a.created < b.created ? 1 : b.id - a.id))
      .forEach((d) => { if (!seen.has(d.orgId) && out.length < 4) { seen.add(d.orgId); out.push(org(d.orgId)); } });
    return out;
  }
  function dealForm(pre = {}) {
    let plId = pre.pipelineId || prefs.lastPipeline || prefs.pipelineId;
    let orgId = pre.orgId || null;
    const orgRow = (o) => `<button type="button" class="opt-row" data-org-pick="${o.id}">${orgAvatar(o)}<span class="m-lbl">${esc(o.name)}<small>${esc(o.type)} · ${esc(o.ville)}</small></span></button>`;
    modal('Nouvelle affaire', `
      <div class="seg qa-seg" id="qa-pl" role="group" aria-label="Pipeline">${db.pipelines.map((p) => `<button type="button" data-pl="${p.id}" aria-pressed="${p.id === plId}" title="${esc(p.name)}">${esc(PL_SHORT[p.id] || p.name)}</button>`).join('')}</div>
      <div class="field"><label for="qa-o">Organisation</label>
        <div class="org-pick" id="qa-org">
          <input id="qa-o" autocomplete="off" placeholder="Rechercher un établissement" ${orgId ? 'hidden' : ''}>
          <div class="org-chosen" id="qa-chosen" ${orgId ? '' : 'hidden'}></div>
          <div class="opt-list" id="qa-list"></div>
        </div></div>
      <div class="field"><label for="qa-t">Titre</label><input id="qa-t" name="title" required autocomplete="off" placeholder="Ex. : Rails de plafond aile B"><div class="chips hints" id="qa-hints"></div></div>
      <div class="field"><label for="qa-v">Valeur ($)</label><input id="qa-v" name="value" inputmode="numeric" autocomplete="off" placeholder="Optionnelle"></div>`, 'Créer', (f) => {
      if (!orgId) { $('#qa-o').focus(); $('#qa-org').classList.add('need'); return false; }
      const pl = pipeline(plId);
      const stageId = pre.stageId && pl.stages.some((x) => x.id === pre.stageId) ? pre.stageId : pl.stages[0].id;
      const d = { id: Math.max(...db.deals.map((x) => x.id)) + 1, title: f.get('title').trim(), pipelineId: pl.id, stageId, orgId, personId: (db.persons.find((p) => p.orgId === orgId) || {}).id || null, ownerId: 1, value: +String(f.get('value') || '').replace(/[^\d]/g, '') || 0, status: 'open', created: TODAY, stageChanged: TODAY, expectedClose: isoAdd(30), lostReason: null, closeDate: null, soumission: null, labels: [] };
      db.deals.push(d); prefs.lastPipeline = pl.id; savePrefs(); save(); render();
      toast(`Affaire créée · ${pl.stages.find((x) => x.id === stageId).name}`, () => { db.deals.splice(db.deals.indexOf(d), 1); save(); render(); }, false, { l: 'Ouvrir', fn: () => openDeal(d.id) });
    }, orgId ? 'qa-t' : 'qa-o');
    const list = $('#qa-list'), input = $('#qa-o');
    const choose = (id) => {
      orgId = id; const o = org(id);
      $('#qa-chosen').innerHTML = `${orgAvatar(o)}<span class="m-lbl">${esc(o.name)}<small>${esc(o.type)} · ${esc(o.ville)}</small></span><button type="button" class="icon-btn" id="qa-clear" aria-label="Changer d’organisation">${I('x')}</button>`;
      $('#qa-chosen').hidden = false; input.hidden = true; list.innerHTML = ''; $('#qa-org').classList.remove('need');
      $('#qa-clear').onclick = () => { orgId = null; $('#qa-chosen').hidden = true; input.hidden = false; input.value = ''; showList(); input.focus(); };
      $('#qa-t').focus();
    };
    const showList = () => {
      const q = norm(input.value).split(/\s+/).filter(Boolean);
      const items = q.length ? db.orgs.filter((o) => { const h = norm(`${o.name} ${o.ville} ${o.acomba}`); return q.every((w) => h.includes(w)); }).slice(0, 5) : recentOrgs();
      list.innerHTML = (q.length ? '' : '<div class="m-sec">Récentes</div>') + (items.map(orgRow).join('') || '<div class="opt-empty">Aucun établissement trouvé</div>');
      $$('[data-org-pick]', list).forEach((b) => (b.onclick = () => choose(+b.dataset.orgPick)));
    };
    const showHints = () => { $('#qa-hints').innerHTML = (TITLE_HINTS[plId] || []).map((h) => `<button type="button" class="chip sm" data-hint="${esc(h)}">${esc(h)}</button>`).join(''); $$('[data-hint]').forEach((b) => (b.onclick = () => { const t = $('#qa-t'); t.value = b.dataset.hint + ' — '; t.focus(); })); };
    $$('#qa-pl [data-pl]').forEach((b) => (b.onclick = () => { plId = +b.dataset.pl; $$('#qa-pl [data-pl]').forEach((x) => x.setAttribute('aria-pressed', x === b)); showHints(); }));
    input.addEventListener('input', showList);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); const b = $('[data-org-pick]', list); if (b) b.click(); } });
    if (orgId) choose(orgId); else showList();
    showHints();
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
    el.innerHTML = (title ? `<div class="m-sec">${title}</div>` : '') + items.map((it, i) => it.sep ? '<hr>' : it.sec ? `<div class="m-sec">${it.sec}</div>` : `<button class="m" role="menuitem" data-i="${i}">${it.on != null ? `<svg class="i m-check" viewBox="0 0 24 24" style="visibility:${it.on ? 'visible' : 'hidden'}">${P.check}</svg>` : ''}${it.icon || ''}<span class="m-lbl">${it.l}${it.sub ? `<small>${it.sub}</small>` : ''}</span>${it.meta != null ? `<span class="m-meta">${it.meta}</span>` : ''}</button>`).join('');
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
  const norm = (x) => String(x).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  function searchResults(q) {
    const words = norm(q).split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    // Chaque mot tapé doit se retrouver quelque part (titre, organisation, ville…).
    const m = (...fields) => { const hay = norm(fields.join(' ')); return words.every((w) => hay.includes(w)); };
    const out = [];
    db.deals.filter((d) => m(d.title, org(d.orgId).name, d.soumission || ''))
      .sort((a, b) => (a.status === 'open' ? 0 : 1) - (b.status === 'open' ? 0 : 1) || b.value - a.value).slice(0, 6)
      .forEach((d) => out.push({ sec: 'Affaires', l: esc(d.title), sub: `${esc(org(d.orgId).name)}${d.status !== 'open' ? ` · ${d.status === 'won' ? 'gagnée' : 'perdue'}` : ''}`, meta: moneyC(d.value), icon: I('deal'), fn: () => openDeal(d.id) }));
    db.projects.filter((p) => m(p.title)).slice(0, 4).forEach((p) => out.push({ sec: 'Projets', l: esc(projName(p)), sub: esc(org(p.orgId).name), icon: I('proj'), fn: () => openProject(p.id) }));
    db.orgs.filter((o) => m(o.name, o.ville, o.acomba, o.type)).slice(0, 4).forEach((o) => out.push({ sec: 'Organisations', l: esc(o.name), sub: `${esc(o.type)} · ${esc(o.ville)}`, icon: I('org'), fn: () => openOrg(o.id) }));
    db.persons.filter((p) => m(p.name, p.email, p.role, org(p.orgId).name)).slice(0, 4).forEach((p) => out.push({ sec: 'Personnes', l: esc(p.name), sub: `${esc(p.role)} · ${esc(org(p.orgId).name)}`, icon: I('person'), fn: () => openPerson(p.id) }));
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
      const typing = e.target.closest && e.target.closest('input, textarea, select, [contenteditable]');
      if (!typing && !e.metaKey && !e.ctrlKey && !e.altKey && !$('.modal') && e.key.toLowerCase() === 'n') { e.preventDefault(); dealForm(); }
      // Validation au clavier : ← → naviguer, 1 2 3 décider, E corriger, Entrée enregistrer, Échap revenir à la file.
      if (current === 'valider' && !typing && !$('.modal') && !$('#sheet') && !$('#pop') && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const k = e.key; const click = (sel) => { const b = $(sel); if (b && !b.disabled) { e.preventDefault(); b.click(); return true; } return false; };
        if (k === 'ArrowLeft' && click('#vPrev')) return;
        if (k === 'ArrowRight' && click('#vNext')) return;
        if (['1', '2', '3'].includes(k) && click(`[data-dec="${DECISIONS[+k - 1][0]}"]`)) return;
        if (k.toLowerCase() === 'e' && click('#vFix')) return;
        if (k === 'Enter' && !(document.activeElement && document.activeElement.closest('button, a, [role=radio]')) && click('#vSave')) return;
        if (k === 'Escape') { e.preventDefault(); location.hash = 'avalider'; return; }
      }
      if (!typing && !$('.modal') && e.key === '/') { e.preventDefault(); if (getComputedStyle($('#searchBox')).display === 'none') searchSheet(); else q.focus(); }
    });
  }
  function searchSheet() {
    sheetState = null;
    sheet(`<div class="sheet-top" style="padding-top:18px"><label class="search" style="flex:1;width:auto;height:38px">${I('search')}<input id="q2" type="search" placeholder="Affaires, projets, contacts" autocomplete="off"></label><button class="btn plain" data-close>Annuler</button></div><div class="sheet-scroll" id="q2r"></div>`, (s) => {
      const i = $('#q2', s); setTimeout(() => i.focus(), 350);
      i.oninput = () => {
        const items = searchResults(i.value);
        $('#q2r', s).innerHTML = items.map((it, n) => it.sec ? `<div class="group-h">${it.sec}</div>` : `<div class="kv link" data-n="${n}" style="background:var(--surface-2);border-radius:12px;margin-bottom:4px"><span style="display:flex;gap:10px;align-items:center;flex:1;min-width:0;font-weight:500">${it.icon}<span class="m-lbl" style="min-width:0">${it.l}${it.sub ? `<small>${it.sub}</small>` : ''}</span></span><span class="v" style="flex:none;color:var(--ink-3);font-weight:400">${it.meta || ''}</span></div>`).join('');
        $$('[data-n]', s).forEach((r) => (r.onclick = () => items[+r.dataset.n].fn()));
      };
    });
  }

  /* ———————————————————— Toast & infobulles ———————————————————— */
  let toastT;
  function toast(msg, undo, celebrate, action) {
    const t = $('#toast');
    t.innerHTML = `<span class="ti" style="${celebrate ? '' : ''}"><svg viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg></span><span>${esc(msg)}</span>${action ? `<button data-a>${esc(action.l)}</button>` : ''}${undo ? '<button data-u>Annuler</button>' : '<span style="width:8px"></span>'}`;
    if (undo) $('[data-u]', t).onclick = () => { undo(); t.classList.remove('on'); };
    if (action) $('[data-a]', t).onclick = () => { t.classList.remove('on'); action.fn(); };
    t.classList.add('on');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), undo || action ? 5200 : 2400);
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
  // Accès lecture seule pour les scénarios de test (scripts/scenarios.js).
  window.__crm = { get db() { return db; }, TODAY };

  shell();
  applyTheme();
  wireTips();
  window.addEventListener('hashchange', route);
  window.addEventListener('scroll', onScroll, { passive: true });
  let rz; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { if (!current) render(); }, 150); });
  route();
})();
