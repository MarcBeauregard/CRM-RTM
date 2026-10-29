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
    const d = await p.evaluate(() => { const c = window.__crm; const a = c.db.activities.find((x) => !x.done && x.due === c.TODAY && x.type === 'visite') || c.db.activities.find((x) => !x.done && x.due === c.TODAY); const d = c.db.deals.find((x) => x.id === a.dealId); return { title: d.title, org: c.db.orgs.find((o) => o.id === d.orgId).name, id: d.id, act: a.id, today: c.TODAY }; });
    await t.openDeal(d);
    await t.fill('#noteTxt', 'Visite faite, le client attend la soumission révisée.');
    await t.tap('#noteAdd');
    await t.tap('#sheet [data-newact]');
    await t.fill('#a-s', 'Suivi de la visite');
    await t.pickDate('#a-d', plus(d.today, 14));
    await t.tap('.modal .btn.primary');
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
    if (t.mobile) await t.tap('#tabbar a[data-k=activites]'); else await t.tap('.nav a[href="#activites"]');
    const before = await p.evaluate(() => window.__crm.db.activities.filter((a) => a.done).length);
    await t.tap('[data-done]');
    await t.expect(`window.__crm.db.activities.filter((a) => a.done).length === ${before + 1}`, 'activité cochée');
  } },
  { id: 'S4', name: 'Passer une soumission à « À relancer »', run: async (t, p) => {
    const d = await p.evaluate(() => { const c = window.__crm; const d = c.db.deals.find((x) => x.status === 'open' && x.pipelineId === 1 && x.stageId === 62) || c.db.deals.find((x) => x.status === 'open' && x.pipelineId === 1 && x.stageId === 3); return { id: d.id, title: d.title, org: c.db.orgs.find((o) => o.id === d.orgId).name }; });
    await t.openDeal(d);
    await t.tap('#sheet .stagebar [data-stage="13"]');
    await t.expect(`window.__crm.db.deals.find((d) => d.id === ${d.id}).stageId === 13`, 'étape À relancer');
  } },
  { id: 'S5', name: 'Trouver le téléphone de l’acheteuse d’un établissement', run: async (t, p) => {
    const x = await p.evaluate(() => { const c = window.__crm; const pr = c.db.persons.find((p) => /achet|approvision/i.test(p.role)); return { org: c.db.orgs.find((o) => o.id === pr.orgId).name, id: pr.id, tel: pr.telephone }; });
    await t.search(x.org, x.org);
    await t.tap(`#sheet [data-person="${x.id}"]`);
    await t.expect(`document.querySelector('#sheet').textContent.includes('${x.tel}')`, 'téléphone visible');
  } },
  { id: 'S6', name: 'Marquer une affaire perdue avec la raison', run: async (t, p) => {
    const d = await p.evaluate(() => { const c = window.__crm; const d = c.db.deals.find((x) => x.status === 'open' && x.pipelineId === 7); return { id: d.id, title: d.title, org: c.db.orgs.find((o) => o.id === d.orgId).name }; });
    await t.openDeal(d);
    await t.tap('#sheet [data-st=lost]');
    await t.tap('#pop button.m >> text=Budget reporté');
    await t.expect(`(() => { const d = window.__crm.db.deals.find((d) => d.id === ${d.id}); return d.status === 'lost' && d.lostReason === 'Budget reporté'; })()`, 'perdue + raison');
  } },
  { id: 'S7', name: 'Convertir une affaire gagnée en projet', run: async (t, p) => {
    const d = await p.evaluate(() => { const c = window.__crm; const d = c.db.deals.filter((x) => x.status === 'won' && !c.db.projects.some((p) => p.dealId === x.id)).sort((a, b) => (a.closeDate > b.closeDate ? -1 : 1))[0]; return { id: d.id, title: d.title }; });
    if (t.mobile) await t.tap('#tabbar a[data-k=projets]'); else await t.tap('.nav a[href="#projets"]');
    await t.tap('#newProj');
    await t.fill('#p-t', 'Installation');
    t.m.taps += 2; await p.selectOption('#p-d', String(d.id));
    await t.tap('.modal .btn.primary');
    await t.expect(`window.__crm.db.projects.some((p) => p.dealId === ${d.id})`, 'projet créé');
  } },
  { id: 'S8', name: 'Un technicien signale un rail endommagé', prefs: { lastPipeline: 10 }, run: async (t, p) => {
    // Appareil d'un technicien : le pipeline « Opportunités terrain » est mémorisé depuis son dernier signalement.
    await t.tap('#quickAdd');
    await t.fill('#qa-o', 'érables'); await t.tap('[data-org-pick]:has-text("CHSLD des Érables")');
    await t.fill('#qa-t', 'Rail endommagé — chambre 214');
    await t.tap('.modal .btn.primary');
    await t.expect(`window.__crm.db.deals.some((d) => d.title === 'Rail endommagé — chambre 214' && d.pipelineId === 10)`, 'opportunité terrain créée');
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
      await p.goto(url + '#accueil'); await p.evaluate((pr) => { localStorage.clear(); if (pr) localStorage.setItem('crm-rtm-proto-v1-prefs', JSON.stringify(pr)); }, s.prefs || null); await p.reload(); await p.waitForTimeout(300);
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
