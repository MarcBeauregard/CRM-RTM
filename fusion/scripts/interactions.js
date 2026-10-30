// Tests d'interaction : node scripts/interactions.js
// Glisser-déposer (colonne, zone Gagnée), fiche (étape, perdue + raison), filtres, clavier.
const { chromium } = require('playwright');
const path = require('path');
const url = 'file://' + path.resolve(__dirname, '..', 'index.html');
const fails = [];
const check = (ok, label) => { console.log(`${ok ? '✓' : '✗'} ${label}`); if (!ok) fails.push(label); };

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  p.setDefaultTimeout(4000);
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(url + '#affaires'); await p.evaluate(() => localStorage.clear()); await p.reload();

  // Glisser une carte vers la 3e colonne
  const card = p.locator('.col >> nth=0').locator('.dcard >> nth=0'); const id = await card.getAttribute('data-id');
  const c = await card.boundingBox(); const t = await p.locator('.col >> nth=2').boundingBox();
  await p.mouse.move(c.x + 40, c.y + 20); await p.mouse.down(); await p.mouse.move(c.x + 60, c.y + 40, { steps: 5 }); await p.mouse.move(t.x + 100, t.y + 200, { steps: 15 }); await p.mouse.up(); await p.waitForTimeout(300);
  check(await p.locator('.col >> nth=2').locator(`[data-id="${id}"]`).count() === 1, 'glisser vers une autre étape');

  // Glisser sur la zone Gagnée
  const c2 = await p.locator('.dcard >> nth=0').boundingBox(); const id2 = await p.locator('.dcard >> nth=0').getAttribute('data-id');
  await p.mouse.move(c2.x + 40, c2.y + 20); await p.mouse.down(); await p.mouse.move(c2.x + 60, c2.y + 40, { steps: 5 }); await p.waitForTimeout(400);
  const z = await p.locator('[data-dz=won]').boundingBox(); await p.mouse.move(z.x + z.width / 2, z.y + z.height / 2, { steps: 15 }); await p.mouse.up(); await p.waitForTimeout(500);
  check(await p.locator(`.board [data-id="${id2}"]`).count() === 0 && await p.evaluate((i) => window.__crm.db.deals.find((d) => d.id === +i).status === 'won', id2), 'déposer sur Gagnée');

  // Fiche : changer d'étape, perdue avec raison
  await p.locator('.dcard >> nth=3').click(); await p.waitForTimeout(500);
  check(await p.locator('#sheet.on').count() === 1, 'ouvrir une fiche');
  await p.locator('.stagebar button >> nth=4').click(); await p.waitForTimeout(300);
  check((await p.locator('.sheet-top .crumb').textContent()).includes('À relancer'), 'changer d’étape depuis la fiche');
  await p.click('[data-st=lost]'); await p.locator('#pop button.m >> nth=1').click(); await p.waitForTimeout(300);
  check((await p.locator('#sheet .badge.danger').first().textContent()).includes('Compétiteur'), 'perdue avec raison');

  // Tous les filtres et vues, sans erreur
  await p.keyboard.press('Escape'); await p.waitForTimeout(450);
  for (const h of ['#affaires', '#projets', '#activites']) for (let o = 0; o < 6; o++) {
    await p.goto(url + h); await p.click('#ownBtn'); await p.locator('#pop button.m').nth(o).click(); await p.waitForTimeout(80);
    for (const v of await p.locator('.page-head .seg button').all()) { await v.click(); await p.waitForTimeout(60); }
  }
  check(errs.length === 0, 'filtres et vues sans erreur');

  // Clavier : Entrée ouvre, le focus entre dans la fiche, Échap ferme
  await p.goto(url + '#affaires'); await p.locator('.seg button[data-v=pipeline]').click();
  await p.locator('.dcard').first().focus(); await p.keyboard.press('Enter'); await p.waitForTimeout(500);
  check(await p.evaluate(() => !!document.activeElement.closest('#sheet')), 'focus dans la fiche ouverte au clavier');
  await p.keyboard.press('Escape'); await p.waitForTimeout(500);
  check(await p.locator('#sheet').count() === 0, 'Échap ferme la fiche');
  const kid = await p.locator('.dcard').first().getAttribute('data-id'); const st0 = await p.evaluate((i) => window.__crm.db.deals.find((d) => d.id === +i).stageId, kid);
  await p.locator('.dcard').first().focus(); await p.keyboard.press('ArrowRight'); await p.waitForTimeout(250);
  check(await p.evaluate(([i, s0]) => window.__crm.db.deals.find((d) => d.id === +i).stageId !== s0, [kid, st0]) && await p.evaluate((i) => document.activeElement.dataset.id === i, kid), '→ déplace la carte d’une étape, le focus suit');
  await p.keyboard.press('Escape'); await p.locator('body').click({ position: { x: 5, y: 5 } });
  await p.keyboard.press('/'); await p.waitForTimeout(150);
  check(await p.evaluate(() => document.activeElement.id === 'q'), 'touche / : recherche');
  await p.keyboard.press('Escape');
  await p.keyboard.press('n'); await p.waitForTimeout(300);
  check(await p.locator('.modal h2:has-text("Nouvelle affaire")').count() === 1, 'touche N : nouvelle affaire');

  if (errs.length) console.log(errs.join('\n'));
  await b.close();
  if (fails.length || errs.length) process.exitCode = 1;
})();
