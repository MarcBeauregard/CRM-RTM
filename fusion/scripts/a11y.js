// Audit d'accessibilité : node scripts/a11y.js
// 1) iPhone (390 px) : toute cible tactile visible fait au moins 44 × 44 px (zone de frappe comprise).
// 2) Contraste WCAG AA de chaque texte visible, sur son fond réel, en clair et en sombre.
const { chromium } = require('playwright');
const path = require('path');
const url = 'file://' + path.resolve(__dirname, '..', 'index.html');
const VIEWS = ['#accueil', '#affaires', '#projets', '#activites', '#clients', '#client-900', '#etablissement-100', '#equipement-10000', '#avalider', '#soumissions', '#rapports', '#modeles', '#modele-701', '#cartographie-701', '#marques', '#pieces', '#parametres', '#importer'];

const audit = () => {
  const parse = (c) => { const s = c.match(/color\(srgb ([^)]+)\)/); if (s) { const v = s[1].split(/[ /]+/).filter(Boolean).map(Number); return [v[0] * 255, v[1] * 255, v[2] * 255, v[3] == null ? 1 : v[3]]; } const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const v = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return [v[0], v[1], v[2], v[3] == null ? 1 : v[3]]; };
  const lum = (c) => { const f = (x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const over = (top, bot) => { const a = top[3]; return [top[0] * a + bot[0] * (1 - a), top[1] * a + bot[1] * (1 - a), top[2] * a + bot[2] * (1 - a), 1]; };
  const bgOf = (el) => { const stack = []; for (let e = el; e; e = e.parentElement) { const b = parse(getComputedStyle(e).backgroundColor); if (b && b[3] > 0) { stack.push(b); if (b[3] >= 1) break; } } let c = parse(getComputedStyle(document.body).backgroundColor) || [255, 255, 255, 1]; for (let i = stack.length - 1; i >= 0; i--) c = over(stack[i], c); return c; };
  const out = [];
  const seen = new Set();
  for (const el of document.querySelectorAll('body *')) {
    if (el.closest('svg, .tip, .dropbar:not(.on), [hidden], .chart')) continue;
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!own) continue;
    const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
    if (!r.width || !r.height || cs.visibility === 'hidden' || +cs.opacity === 0 || r.bottom < 0 || r.top > innerHeight) continue;
    if (el.closest('.out, [disabled], .done')) continue; // jours hors mois, textes barrés : décoratifs
    const fg = parse(cs.color); const bg = bgOf(el); const f = over(fg, bg);
    const L1 = lum(f), L2 = lum(bg); const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    const size = parseFloat(cs.fontSize), bold = +cs.fontWeight >= 600;
    const need = size >= 24 || (bold && size >= 18.66) ? 3 : 4.5;
    const key = el.className + '|' + cs.color + '|' + ratio.toFixed(1);
    if (ratio < need && !seen.has(key)) { seen.add(key); out.push(`${ratio.toFixed(2)} < ${need} « ${el.textContent.trim().slice(0, 28)} » .${String(el.className).split(' ')[0] || el.tagName.toLowerCase()}`); }
  }
  return out;
};
const targets = () => {
  const out = [];
  for (const el of document.querySelectorAll('a[href], button, [role=button], input, select, textarea, [tabindex="0"]')) {
    const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
    if (!r.width || !r.height || cs.visibility === 'hidden' || el.classList.contains('sr') || el.closest('[hidden], .dropbar:not(.on)') || r.bottom < 0 || r.top > innerHeight) continue;
    // zone de frappe étendue par ::after { inset: négatif }
    const af = getComputedStyle(el, '::after'); const ext = af.content !== 'none' && af.position === 'absolute' ? Math.max(0, -parseFloat(af.top) || 0) * 2 : 0;
    if (Math.min(r.width, r.height) + ext < 43.5) out.push(`${Math.round(r.width)}×${Math.round(r.height)} ${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]} « ${(el.getAttribute('aria-label') || el.textContent).trim().slice(0, 24)} »`);
  }
  return [...new Set(out)];
};

(async () => {
  const b = await chromium.launch(); let bad = 0;
  for (const theme of ['light', 'dark']) for (const [w, h, mobile] of [[390, 844, true], [1440, 900, false]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile, colorScheme: theme });
    const p = await ctx.newPage();
    for (const v of VIEWS) {
      await p.goto(url + v); await p.waitForTimeout(250);
      const c = await p.evaluate(audit); const t = mobile ? await p.evaluate(targets) : [];
      if (c.length || t.length) console.log(`— ${theme} ${w}px ${v}`);
      c.forEach((x) => console.log('  contraste ' + x)); t.forEach((x) => console.log('  cible ' + x));
      bad += c.length + t.length;
    }
    await ctx.close();
  }
  await b.close();
  console.log(bad ? `${bad} problème(s)` : 'OK — cibles ≥ 44 px et contraste AA');
  if (bad) process.exitCode = 1;
})();
