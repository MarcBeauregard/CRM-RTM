// Captures QA : node scripts/shots.js [dossier] — 3 largeurs, clair/sombre, vues principales.
const { chromium } = require('playwright');
const path = require('path');
const out = process.argv[2] || 'shots';
const url = 'file://' + path.resolve(__dirname, '..', 'index.html');
const only = process.argv[3];
(async () => {
  const b = await chromium.launch();
  const errors = [];
  const run = async (name, w, h, theme, hash, act, full = false) => {
    if (only && !name.includes(only)) return;
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: w > 1500 ? 1 : 2, colorScheme: theme, hasTouch: w < 800, isMobile: w < 800 });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errors.push(name + ': ' + e.message));
    p.on('console', (m) => { if (m.type() === 'error') errors.push(name + ': ' + m.text()); });
    await p.goto(url + hash);
    await p.waitForTimeout(250);
    if (act) await act(p);
    await p.waitForTimeout(600);
    const sw = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    if (sw > 0) errors.push(`${name}: débordement horizontal ${sw}px`);
    await p.screenshot({ path: `${out}/${name}.png`, fullPage: full });
    await ctx.close();
  };
  const W = [[1440, 900, 'd'], [390, 844, 'm']];
  for (const [w, h, s] of W) {
    await run(`${s}-dash`, w, h, 'light', '#accueil', null, s === 'm');
    await run(`${s}-deals`, w, h, 'light', '#affaires');
    await run(`${s}-deal-sheet`, w, h, 'light', '#affaires', (p) => p.click('.dcard >> nth=1'));
    await run(`${s}-list`, w, h, 'light', '#affaires', (p) => p.click('.seg button[data-v=liste]'));
    await run(`${s}-fc`, w, h, 'light', '#affaires', (p) => p.click('.seg button[data-v=previsions]'));
    await run(`${s}-proj`, w, h, 'light', '#projets');
    await run(`${s}-gantt`, w, h, 'light', '#projets', (p) => p.click('.seg button[data-v=chronologie]'));
    await run(`${s}-proj-sheet`, w, h, 'light', '#projets', (p) => p.click('.dcard >> nth=0'));
    await run(`${s}-acts`, w, h, 'light', '#activites');
    await run(`${s}-clients`, w, h, 'light', '#clients');
    await run(`${s}-etab`, w, h, 'light', '#etablissement-100', (p) => p.click('#etabTabs button[data-t=equipements]'));
    await run(`${s}-equip`, w, h, 'light', '#equipement-10000');
    await run(`${s}-avalider`, w, h, 'light', '#avalider');
    await run(`${s}-valider`, w, h, 'light', '#avalider', (p) => p.click('.queue li >> nth=0'));
    await run(`${s}-soumissions`, w, h, 'light', '#soumissions');
    await run(`${s}-rapports`, w, h, 'light', '#rapports');
    await run(`${s}-dash-dark`, w, h, 'dark', '#accueil');
    await run(`${s}-deals-dark`, w, h, 'dark', '#affaires');
  }
  await run('w-dash', 2200, 1200, 'light', '#accueil');
  await run('t-deals', 1024, 768, 'light', '#affaires');
  await run('d-newdeal', 1440, 900, 'light', '#affaires', (p) => p.click('#newDeal'));
  await run('d-menu', 1440, 900, 'light', '#affaires', (p) => p.click('#plBtn'));
  await run('d-search', 1440, 900, 'light', '#accueil', async (p) => { await p.fill('#q', 'chsld'); });
  await run('d-tip', 1440, 900, 'light', '#accueil', async (p) => { await p.hover('.chart .bcol >> nth=8', { force: true }); });
  console.log(errors.length ? errors.join('\n') : 'OK — aucune erreur');
  await b.close();
})();
