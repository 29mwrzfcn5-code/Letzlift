require('./helpers/tz.js');
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, ev, sleep } = require('../tools/sandbox.js');
const { makeFakeDom } = require('./helpers/fakedom.js');

async function boot() {
  const app = loadApp({ now: Date.parse('2026-03-12T10:00:00Z') });
  assert.deepEqual(app.errors, []);
  await sleep(30);
  const dom = makeFakeDom();
  app.ctx.document = dom;
  for (const id of ['niveau-container', 'parametres-container', 'settings-minutes-slider', 'theme-grid', 'theme-locked']) dom.add(id);
  return { ctx: app.ctx, dom };
}
const html = (dom, id) => dom.els.get(id).innerHTML;

test('Moi : quatre onglets, Résumé par défaut, engrenage vers les Paramètres, pas de rond d’avatar', async () => {
  const { ctx, dom } = await boot();
  ev(ctx, 'renderNiveau()');
  const h = html(dom, 'niveau-container');
  for (const label of ['Résumé', 'Passeport', 'Badges', 'Données']) assert.match(h, new RegExp(`>${label}<`));
  assert.match(h, /aria-selected="true" onclick="setNiveauTab\('resume'\)"/);
  assert.match(h, /onclick="switchView\('parametres'\)" aria-label="Paramètres"/);
  assert.match(h, /Genre et règle du n/); assert.match(h, /Ma semaine en cours/); assert.match(h, /Test de placement/);
  assert.ok(!/Passeport<\/h/.test(h) && !h.includes('Ton passeport'), 'le passeport est dans son propre onglet');
  assert.equal(ev(ctx, "typeof toggleAvatarMenu"), 'undefined');
});

test('Moi : chaque onglet affiche sa partie seulement', async () => {
  const { ctx, dom } = await boot();
  ctx.scrollTo = () => {}; ctx.window.scrollTo = () => {};
  ev(ctx, "setNiveauTab('passeport')");
  assert.match(html(dom, 'niveau-container'), /Ton passeport/); assert.ok(!/Genre et règle du n/.test(html(dom, 'niveau-container')));
  ev(ctx, "setNiveauTab('badges')");
  assert.match(html(dom, 'niveau-container'), /\/ \d+ badges/); assert.ok(!/Ton passeport/.test(html(dom, 'niveau-container')));
  ev(ctx, "setNiveauTab('donnees')");
  assert.match(html(dom, 'niveau-container'), /Télécharger une sauvegarde/); assert.match(html(dom, 'niveau-container'), /id="backup-status"/);
  ev(ctx, "setNiveauTab('resume')");
  assert.match(html(dom, 'niveau-container'), /Toutes mes statistiques/);
});

test('Moi : le Cours n’apparaît que pour un compte qui y a droit', async () => {
  const { ctx, dom } = await boot();
  ev(ctx, 'renderNiveau()');
  assert.ok(!/Cours de luxembourgeois/.test(html(dom, 'niveau-container')));
  ev(ctx, "syncMe = { entitlements: ['course'], role: 'user' }; renderNiveau()");
  assert.match(html(dom, 'niveau-container'), /Cours de luxembourgeois/);
});

test('Paramètres : sections Profil, Apprentissage, Apparence et sons, Compte, Données ; objectif, durée et interrupteurs présents', async () => {
  const { ctx, dom } = await boot();
  ev(ctx, 'renderParametres()');
  const h = html(dom, 'parametres-container');
  for (const s of ['Profil', 'Apprentissage', 'Apparence et sons', 'Compte', 'Données']) assert.match(h, new RegExp(`class="set-sect">${s}<`));
  for (const id of ['settings-goal-row', 'settings-minutes-slider', 'settings-gcolors-toggle', 'settings-sound-toggle', 'settings-keyboard-toggle', 'settings-reminder-select', 'settings-reset-zone']) assert.match(h, new RegExp(id));
  assert.ok(!/initiale de ton avatar/.test(h));
});

test('Parler : thèmes ouverts en grille, thèmes verrouillés regroupés par niveau avec le prochain déblocage', async () => {
  const { ctx, dom } = await boot();
  ev(ctx, 'xpState.enduranceXP = 40; renderThemeList()');
  const grid = html(dom, 'theme-grid'), locked = html(dom, 'theme-locked');
  assert.match(grid, /theme-card-v2/); assert.match(grid, /connues/); assert.ok(!/lock-tag|Niveau \d requis/.test(grid));
  assert.match(locked, /À débloquer/); assert.match(locked, /Niveau 2 : 2 thèmes/); assert.match(locked, /encore \d+ XP/);
  const rows = (locked.match(/class="lock-row"/g) || []).length;
  const levels = JSON.parse(ev(ctx, 'JSON.stringify([...new Set(SMALLTALK.filter(t => !isThemeUnlocked(t.id)).map(t => THEME_UNLOCK_LEVELS[t.id]))])'));
  assert.equal(rows, levels.length);
});
