// Mesure des 8 scénarios d'usage : node scripts/scenarios.js [sortie.json]
// Compte les interactions (tap/clic/touche), les champs saisis et les écrans traversés,
// en suivant le chemin le plus court disponible dans l'interface actuelle.
const { chromium } = require('playwright');
const path = require('path');
const url = 'file://' + path.resolve(__dirname, '..', 'index.html');

const plus = (iso, n) => new Date(new Date(iso + 'T12:00:00').getTime() + n * 864e5).toISOString().slice(0, 10);

function harness(p, mobile) {
  const m = { taps: 0, fields: 0, screens: 0, sig: '' };
  const sig = () => p.evaluate(() => [location.hash || '#accueil', (document.querySelector('#sheet h2') || {}).textContent || '', (document.querySelector('#sheet #q2') ? 'recherche' : ''), (document.querySelector('.modal h2') || {}).textContent || ''].join('|'));
  const settle = async () => { await p.waitForTimeout(450); const s = await sig(); if (s !== m.sig) { m.screens++; m.sig = s; } };
  return {
    m, mobile,
    async start() { m.sig = await sig(); },
    async tap(sel) { m.taps++; try { await p.locator(sel).first().click(); } catch (e) { throw new Error('tap ' + sel); } await settle(); },
    async fill(sel, txt) { m.fields++; await p.locator(sel).first().fill(txt); await p.waitForTimeout(250); },
    async key(k) { m.taps++; await p.keyboard.press(k); await settle(); },
    // Recherche puis choix du résultat qui contient `pick` (sinon le premier).
    async search(txt, pick) {
      const row = mobile ? '#q2r [data-n]' : '#pop button.m';
      if (mobile) { await this.tap('#qMobile'); await this.fill('#q2', txt); } else { await this.tap('#q'); await this.fill('#q', txt); }
      const picks = [].concat(pick || []);
      await this.tap(row + picks.map((x) => `:has-text("${x}")`).join(''));
    },
    // Calendrier : avance d'un mois tant que la date n'est pas affichée (chaque avance = 1 tap).
    async pickDate(field, iso) {
      await this.tap(field);
      for (let i = 0; i < 3 && !(await p.locator(`.cal-g [data-d="${iso}"]:not(.out)`).count()); i++) await this.tap('.cal-h [data-step="1"]');
      await this.tap(`.cal-g [data-d="${iso}"]:not(.out)`);
    },
    // Ouvre une affaire précise comme le ferait l'utilisateur : recherche par son titre, choix de la bonne organisation.
    async openDeal(d) { await this.search(`${d.org.split(' ').slice(-2).join(' ')} ${d.title.split(' ').slice(0, 2).join(' ')}`, [d.title, d.org]); },
    async expect(fn, label) { const ok = await p.evaluate(fn); if (!ok) throw new Error('Échec : ' + label); },
  };
}

// Chaque scénario : prépare une cible à partir des données, puis suit le chemin le plus court.
const SCENARIOS = [
  { id: 'S1', name: 'Noter une visite et planifier le suivi dans 2 semaines', run: async (t, p) => {
    // La visite est une activité d'aujourd'hui de l'utilisateur, dans « Ma journée » à l'accueil.
    const d = await p.evaluate(() => { const c = window.__crm; const shown = [...document.querySelectorAll('#todo [data-done]')].map((b) => +b.dataset.done); const a = c.db.activities.find((x) => shown.includes(x.id) && x.due === c.TODAY && !c.db.activities.some((y) => y !== x && y.dealId === x.dealId && !y.done)); return { id: a.dealId, act: a.id, today: c.TODAY }; });
    await t.tap(`#todo [data-done="${d.act}"]`);
    await t.fill('#ns-note', 'Visite faite, le client attend la soumission révisée.');
    await t.tap('.ns-chip[data-in="14"]');
    await t.expect(`(() => { const c = window.__crm; return c.db.notes.some((n) => n.dealId === ${d.id} && n.date === c.TODAY) && c.db.activities.some((a) => a.dealId === ${d.id} && !a.done && a.due === '${plus(d.today, 14)}'); })()`, 'note + suivi');
  } },
  { id: 'S2', name: 'Créer une affaire pour un CHSLD existant', run: async (t, p) => {
    await t.tap('#quickAdd');
    await t.fill('#qa-o', 'érables'); await t.tap('[data-org-pick]:has-text("CHSLD des Érables")');
    await t.fill('#qa-t', 'Remplacement de 4 moteurs');
    await t.fill('#qa-v', '18000');
    await t.tap('.modal .btn.primary');
    await t.expect(`window.__crm.db.deals.some((d) => d.title === 'Remplacement de 4 moteurs' && d.value === 18000 && d.pipelineId === 1)`, 'affaire créée');
  } },
  { id: 'S3', name: 'Voir ma journée et cocher une activité', run: async (t, p) => {
    const before = await p.evaluate(() => window.__crm.db.activities.filter((a) => a.done).length);
    await t.tap('#todo [data-done]');
    await t.expect(`window.__crm.db.activities.filter((a) => a.done).length === ${before + 1}`, 'activité cochée');
  } },
  { id: 'S4', name: 'Passer une soumission à « À relancer »', run: async (t, p) => {
    const d = await p.evaluate(() => { const c = window.__crm; const d = c.db.deals.find((x) => x.status === 'open' && x.pipelineId === 1 && x.stageId === 62) || c.db.deals.find((x) => x.status === 'open' && x.pipelineId === 1 && x.stageId === 3); return { id: d.id, title: d.title, org: c.db.orgs.find((o) => o.id === d.orgId).name }; });
    await t.openDeal(d);
    await t.tap('#sheet .stagebar [data-stage="13"]');
    await t.expect(`window.__crm.db.deals.find((d) => d.id === ${d.id}).stageId === 13`, 'étape À relancer');
  } },
  { id: 'S5', name: 'Trouver le téléphone de l’acheteuse d’un établissement', run: async (t, p) => {
    const x = await p.evaluate(() => { const c = window.__crm; const pr = c.db.persons.find((p) => /achet/i.test(p.role)); return { org: c.db.orgs.find((o) => o.id === pr.orgId).name, name: pr.name, id: pr.id, tel: pr.telephone }; });
    await t.search(`acheteuse ${x.org.split(' ').slice(-1)[0]}`, x.name);
    await t.expect(`document.querySelector('#sheet').textContent.includes('${x.tel}')`, 'téléphone visible');
  } },
  { id: 'S6', name: 'Marquer une affaire perdue avec la raison', run: async (t, p) => {
    // Le client annonce la perte pendant l'appel prévu aujourd'hui : on coche l'appel dans « Ma journée ».
    const d = await p.evaluate(() => { const c = window.__crm; const shown = [...document.querySelectorAll('#todo [data-done]')].map((b) => +b.dataset.done); const a = c.db.activities.find((x) => shown.includes(x.id) && x.due === c.TODAY && !c.db.activities.some((y) => y !== x && y.dealId === x.dealId && !y.done)); return { id: a.dealId, act: a.id }; });
    await t.tap(`#todo [data-done="${d.act}"]`);
    await t.tap('.next-step [data-lost]');
    await t.tap('.next-step [data-reason="Budget reporté"]');
    await t.expect(`(() => { const d = window.__crm.db.deals.find((d) => d.id === ${d.id}); return d.status === 'lost' && d.lostReason === 'Budget reporté'; })()`, 'perdue + raison');
  } },
  { id: 'S6b', name: 'Variante : perdue avec raison depuis la recherche', run: async (t, p) => {
    const d = await p.evaluate(() => { const c = window.__crm; const d = c.db.deals.find((x) => x.status === 'open' && x.pipelineId === 7); return { id: d.id, title: d.title, org: c.db.orgs.find((o) => o.id === d.orgId).name }; });
    await t.openDeal(d);
    await t.tap('#sheet [data-st=lost]');
    await t.tap('#pop button.m >> text=Budget reporté');
    await t.expect(`(() => { const d = window.__crm.db.deals.find((d) => d.id === ${d.id}); return d.status === 'lost' && d.lostReason === 'Budget reporté'; })()`, 'perdue + raison');
  } },
  { id: 'S7', name: 'Convertir une affaire gagnée en projet', run: async (t, p) => {
    const d = await p.evaluate(() => { const c = window.__crm; const d = c.db.deals.filter((x) => x.status === 'won' && !c.db.projects.some((p) => p.dealId === x.id)).sort((a, b) => (a.closeDate > b.closeDate ? -1 : 1))[0]; return { id: d.id, title: d.title, org: c.db.orgs.find((o) => o.id === d.orgId).name }; });
    await t.search(`${d.org.split(' ').slice(-2).join(' ')} ${d.title.split(' ').slice(0, 2).join(' ')}`, [d.title, `${d.org} · gagnée`]);
    await t.tap('#sheet [data-mkproj]');
    await t.expect(`(() => { const p = window.__crm.db.projects.find((p) => p.dealId === ${d.id}); return p && p.tasks.length > 5; })()`, 'projet créé avec tâches');
  } },
  { id: 'S8', name: 'Un technicien signale un rail endommagé', prefs: { lastPipeline: 10 }, run: async (t, p) => {
    // Appareil d'un technicien : le pipeline « Opportunités terrain » est mémorisé depuis son dernier signalement.
    await t.tap('#quickAdd');
    await t.fill('#qa-o', 'érables'); await t.tap('[data-org-pick]:has-text("CHSLD des Érables")');
    await t.fill('#qa-t', 'Rail endommagé — chambre 214');
    await t.tap('.modal .btn.primary');
    await t.expect(`window.__crm.db.deals.some((d) => d.title === 'Rail endommagé — chambre 214' && d.pipelineId === 10)`, 'opportunité terrain créée');
  } },
  { id: 'S9', name: 'Décider d’une non-conformité (soumission requise)', run: async (t, p) => {
    if (t.mobile) await t.tap('#tabbar a[data-k=avalider]'); else await t.tap('.nav a[href="#avalider"]');
    const id = +(await p.locator('.queue li').first().getAttribute('data-href')).split('-')[1];
    await t.tap('.queue li');
    await t.tap('#vSave');
    await t.expect(`(() => { const c = window.__crm.db; return c.interventions.find((x) => x.id === ${id}).status === 'valide' && c.soumissions.some((s) => s.interventionId === ${id} && s.status === 'a_saisir'); })()`, 'décision + soumission');
  } },
  { id: 'S10', name: 'Saisir une soumission dans Acomba → affaire', run: async (t, p) => {
    if (t.mobile) { await t.tap('#tabMore'); await t.tap('.menu-tile[href="#soumissions"]'); await t.tap('[data-so]'); }
    else await t.tap('.nav a[href="#soumissions"]');
    const so = await p.evaluate(() => window.__crm.db.soumissions.filter((s) => s.status === 'a_saisir').length);
    await t.fill('#so-no', 'S-26-777');
    await t.tap('#soForm .btn.primary');
    await t.expect(`(() => { const c = window.__crm.db; const s = c.soumissions.find((x) => x.acomba === 'S-26-777'); const d = s && c.deals.find((x) => x.id === s.dealId); return s && s.status === 'saisie' && d && d.pipelineId === 7 && d.stageId === 71; })()`, 'soumission saisie + affaire');
  } },
];

(async () => {
  const b = await chromium.launch();
  const out = {};
  for (const [label, w, h, mobile] of [['iPhone', 390, 844, true], ['Ordinateur', 1440, 900, false]]) {
    out[label] = {};
    for (const s of SCENARIOS) {
      const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile });
      const p = await ctx.newPage(); p.setDefaultTimeout(4000);
      const errs = []; p.on('pageerror', (e) => errs.push(e.message));
      await p.goto(url + '#accueil'); await p.evaluate((pr) => { localStorage.clear(); if (pr) localStorage.setItem('crm-rtm-fusion-v1-prefs', JSON.stringify(pr)); }, s.prefs || null); await p.reload(); await p.waitForTimeout(300);
      const t = harness(p, mobile); await t.start();
      let ok = true, err = '';
      try { await s.run(t, p); } catch (e) { ok = false; err = e.message.split('\n')[0]; }
      if (errs.length) { ok = false; err = errs.join(' | '); }
      out[label][s.id] = { name: s.name, taps: t.m.taps, fields: t.m.fields, screens: t.m.screens, ok, err };
      await ctx.close();
    }
  }
  await b.close();
  const rows = Object.keys(out.iPhone).map((id) => `${id}  ${String(out.iPhone[id].taps).padStart(2)} taps ${out.iPhone[id].fields} champs ${out.iPhone[id].screens} écrans ${out.iPhone[id].ok ? '✓' : '✗ ' + out.iPhone[id].err} | ordi ${out.Ordinateur[id].taps}/${out.Ordinateur[id].fields}/${out.Ordinateur[id].screens} ${out.Ordinateur[id].ok ? '✓' : '✗ ' + out.Ordinateur[id].err}  ${out.iPhone[id].name}`);
  console.log(rows.join('\n'));
  if (process.argv[2]) require('fs').writeFileSync(process.argv[2], JSON.stringify(out, null, 2));
  if (Object.values(out).some((v) => Object.values(v).some((r) => !r.ok))) process.exitCode = 1;
})();
