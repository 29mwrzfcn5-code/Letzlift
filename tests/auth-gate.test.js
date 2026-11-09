require('./helpers/tz.js');
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, ev, sleep } = require('../tools/sandbox.js');
const { makeFakeDom } = require('./helpers/fakedom.js');

const NOW = Date.parse('2026-11-10T09:00:00Z');

async function boot(storage) {
  const app = loadApp({ now: NOW, storage });
  assert.deepEqual(app.errors, []);
  await sleep(30);
  const dom = makeFakeDom();
  app.ctx.document = dom;
  const gate = dom.add('auth-gate'); const appEl = dom.add('app');
  appEl.attrs = {}; appEl.setAttribute = (k, v) => { appEl.attrs[k] = v; }; appEl.removeAttribute = k => { delete appEl.attrs[k]; };
  for (const id of ['gate-user', 'gate-pass', 'gate-pass2', 'gate-key', 'gate-url']) dom.add(id);
  app.ctx.AbortController = AbortController;
  return { ctx: app.ctx, dom, gate, appEl };
}
const html = dom => dom.els.get('auth-gate').innerHTML;
const AUTH = JSON.stringify({ url: 'https://sync.example', username: 'maxime', token: 'a'.repeat(64), lastSyncAt: 1 });

test('sans compte connecté : l’écran s’ouvre et l’app est neutralisée ; avec un jeton valide : pas d’écran', async () => {
  const a = await boot();
  ev(a.ctx, 'syncGateStartup()');
  assert.equal(ev(a.ctx, 'authGateIsOpen()'), true);
  assert.match(html(a.dom), /Moien/); assert.ok('inert' in a.appEl.attrs);
  const b = await boot({ 'letzlift:sync-auth': AUTH });
  ev(b.ctx, 'syncGateStartup()');
  assert.equal(ev(b.ctx, 'authGateIsOpen()'), false);
});

test('jeton illisible ou adresse non https : traité comme déconnecté', async () => {
  for (const bad of ['pas du json', JSON.stringify({ url: 'http://x.example', username: 'a', token: 't' }), JSON.stringify({ url: 'https://x.example', username: 'a' })]) {
    const a = await boot({ 'letzlift:sync-auth': bad });
    ev(a.ctx, 'syncGateStartup()');
    assert.equal(ev(a.ctx, 'authGateIsOpen()'), true, bad);
  }
});

test('l’identifiant affiché est échappé ; « créer un compte » ajoute confirmation et clé d’accès', async () => {
  const a = await boot();
  ev(a.ctx, `syncLastUser = '"><img src=x onerror=alert(1)>'`);
  ev(a.ctx, 'authGateShow()');
  assert.ok(!html(a.dom).includes('<img'));
  assert.ok(!html(a.dom).includes('gate-key'));
  ev(a.ctx, 'gateToggleMode()');
  assert.match(html(a.dom), /gate-pass2/); assert.match(html(a.dom), /gate-key/); assert.match(html(a.dom), /Continuer/);
});

function fillRegister(a, over = {}) {
  const v = { 'gate-user': 'maxime', 'gate-pass': 'correct-horse-9', 'gate-pass2': 'correct-horse-9', 'gate-key': 'LZ-AAAAA-BBBBB', ...over };
  for (const [id, val] of Object.entries(v)) a.dom.els.get(id).value = val;
}

test('création : champs invalides refusés sans appel réseau', async () => {
  const a = await boot(); let calls = 0;
  a.ctx.fetch = async () => { calls++; throw new Error('pas de réseau attendu'); };
  ev(a.ctx, 'authGateShow(); gateToggleMode()');
  const tries = [[{ 'gate-pass2': 'autre-chose-1234' }, /pas identiques/], [{ 'gate-pass': 'court', 'gate-pass2': 'court' }, /au moins 10/], [{ 'gate-user': 'Max Blanchard' }, /Identifiant/], [{ 'gate-key': '  ' }, /clé d’accès/]];
  for (const [over, re] of tries) {
    fillRegister(a, over); await ev(a.ctx, 'gateSubmit(null)');
    assert.match(html(a.dom), re); assert.equal(ev(a.ctx, 'authGateIsOpen()'), true);
  }
  assert.equal(calls, 0);
});

test('création : étape « avant de commencer » — case obligatoire, deux choix de même poids, aucun préchoisi', async () => {
  const a = await boot(); let calls = 0;
  a.ctx.fetch = async () => { calls++; throw new Error('pas de réseau attendu'); };
  ev(a.ctx, 'authGateShow(); gateToggleMode()');
  fillRegister(a); await ev(a.ctx, 'gateSubmit(null)');
  assert.match(html(a.dom), /Avant de commencer/); assert.match(html(a.dom), /Accepter les statistiques/); assert.match(html(a.dom), /Refuser les statistiques/);
  assert.ok(!/checked/.test(html(a.dom)));
  const cls = fn => html(a.dom).match(new RegExp(`<button[^>]*class="([^"]*)"[^>]*onclick="${fn}"`))[1];
  assert.equal(cls('gateRegister\\(true\\)'), cls('gateRegister\\(false\\)')); // même style : aucun choix mis en avant
  a.dom.add('gate-terms').checked = false;
  await ev(a.ctx, 'gateRegister(true)');
  assert.match(html(a.dom), /Coche la case/); assert.equal(calls, 0);
});

test('création réussie : le serveur reçoit clé, conditions, âge et choix ; jeton et profil gardés', async () => {
  const a = await boot(); const seen = [];
  a.ctx.fetch = async (url, init) => {
    const path = new URL(url).pathname; seen.push({ path, body: init.body ? JSON.parse(init.body) : null });
    const me = { id: 'x'.repeat(32), username: 'maxime', role: 'user', entitlements: [], analyticsConsent: false };
    const body = path === '/api/register' ? { token: 'c'.repeat(64), username: 'maxime', me } : { rev: 1, data: { vocabProgress: {} } };
    return { status: path === '/api/register' ? 201 : 200, ok: true, json: async () => body };
  };
  ev(a.ctx, 'switchView = n => { globalThis.__view = n; }');
  ev(a.ctx, 'authGateShow(); gateToggleMode()');
  fillRegister(a); await ev(a.ctx, 'gateSubmit(null)');
  a.dom.add('gate-terms').checked = true;
  await ev(a.ctx, 'gateRegister(false)');
  const reg = seen.find(x => x.path === '/api/register').body;
  assert.deepEqual([reg.username, reg.key, reg.acceptTerms, reg.age16, reg.analytics, reg.termsVersion, reg.consentVersion], ['maxime', 'LZ-AAAAA-BBBBB', true, true, false, ev(a.ctx, 'TERMS_VERSION'), ev(a.ctx, 'CONSENT_VERSION')]);
  assert.equal(ev(a.ctx, 'authGateIsOpen()'), false);
  assert.equal(JSON.parse(a.ctx.__store.get('letzlift:sync-auth')).token, 'c'.repeat(64));
  assert.equal(JSON.parse(a.ctx.__store.get('letzlift:sync-me')).analyticsConsent, false);
});

test('connexion réussie : jeton enregistré sur l’appareil, écran fermé, vue d’accueil', async () => {
  const a = await boot(); const seen = [];
  a.ctx.fetch = async (url, init) => {
    seen.push(`${init.method} ${new URL(url).pathname}`);
    const me = { id: 'x'.repeat(32), username: 'maxime', role: 'user', entitlements: ['course'], analyticsConsent: true };
    const body = url.endsWith('/api/login') ? { token: 'b'.repeat(64), username: 'maxime', me } : url.endsWith('/api/sync') ? { rev: 1, data: { vocabProgress: {} } } : { me };
    return { status: 200, ok: true, json: async () => body };
  };
  ev(a.ctx, 'switchView = n => { globalThis.__view = n; }');
  ev(a.ctx, 'authGateShow()');
  a.dom.els.get('gate-user').value = ' Maxime '; a.dom.els.get('gate-pass').value = 'correct-horse-9';
  await ev(a.ctx, 'gateSubmit(null)');
  assert.equal(ev(a.ctx, 'authGateIsOpen()'), false); assert.ok(!('inert' in a.appEl.attrs));
  assert.deepEqual(seen.slice(0, 2), ['POST /api/login', 'POST /api/sync']);
  assert.equal(ev(a.ctx, 'globalThis.__view'), 'home');
  const stored = JSON.parse(a.ctx.__store.get('letzlift:sync-auth'));
  assert.equal(stored.username, 'maxime'); assert.equal(stored.token, 'b'.repeat(64));
  assert.equal(ev(a.ctx, "hasEntitlement('course')"), true); assert.equal(ev(a.ctx, "hasEntitlement('premium')"), false);
  assert.ok(!JSON.stringify(JSON.parse(ev(a.ctx, 'JSON.stringify(buildBackupPayload())'))).includes('b'.repeat(64)));
});

test('compte existant sans choix : la question des statistiques est posée, « plus tard » ne collecte rien', async () => {
  const a = await boot({ 'letzlift:sync-auth': AUTH });
  ev(a.ctx, 'syncLoadAuth()');
  ev(a.ctx, 'authGateShowConsent()');
  assert.match(html(a.dom), /Statistiques d'usage/); assert.match(html(a.dom), /Plus tard/);
  assert.equal(ev(a.ctx, 'telemetryEnabled()'), false);
  ev(a.ctx, 'gateConsentLater()');
  assert.equal(ev(a.ctx, 'authGateIsOpen()'), false); assert.equal(ev(a.ctx, 'telemetryEnabled()'), false);
  a.ctx.fetch = async (url, init) => ({ status: 200, ok: true, json: async () => ({ me: { id: 'x', username: 'maxime', role: 'user', entitlements: [], analyticsConsent: JSON.parse(init.body).analytics } }) });
  ev(a.ctx, 'authGateShowConsent()');
  await ev(a.ctx, 'gateAnswerConsent(true)');
  assert.equal(ev(a.ctx, 'authGateIsOpen()'), false); assert.equal(ev(a.ctx, 'telemetryEnabled()'), true);
});

test('profil reçu après le premier affichage : l’écran est redessiné pour montrer les droits (bouton Cours)', async () => {
  const a = await boot({ 'letzlift:sync-auth': AUTH });
  ev(a.ctx, 'syncLoadAuth(); syncLoadMe()');
  assert.equal(ev(a.ctx, "hasEntitlement('course')"), false);
  ev(a.ctx, 'globalThis.__renders = 0; renderHome = () => { globalThis.__renders++; }');
  a.dom.querySelector = () => ({ id: 'view-home' });
  const me = ents => ({ me: { id: 'x', username: 'maxime', role: 'admin', entitlements: ents, analyticsConsent: true } });
  let answer = me(['course']);
  a.ctx.fetch = async () => ({ status: 200, ok: true, json: async () => answer });
  await ev(a.ctx, 'syncRefreshMe(true)');
  assert.equal(ev(a.ctx, "hasEntitlement('course')"), true); assert.equal(ev(a.ctx, 'globalThis.__renders'), 1);
  await ev(a.ctx, 'syncRefreshMe(true)'); // rien n'a changé : pas de nouveau dessin
  assert.equal(ev(a.ctx, 'globalThis.__renders'), 1);
  answer = me([]); await ev(a.ctx, 'syncRefreshMe(true)'); // droit retiré : l'écran se met à jour aussi
  assert.equal(ev(a.ctx, 'globalThis.__renders'), 2); assert.equal(ev(a.ctx, "hasEntitlement('course')"), false);
});

test('serveur injoignable : message clair et possibilité de continuer sans connexion (sans jeton)', async () => {
  const a = await boot();
  a.ctx.fetch = async () => { throw new TypeError('Failed to fetch'); };
  ev(a.ctx, 'authGateShow()');
  a.dom.els.get('gate-user').value = 'maxime'; a.dom.els.get('gate-pass').value = 'correct-horse-9';
  await ev(a.ctx, 'gateSubmit(null)');
  assert.match(html(a.dom), /Serveur injoignable/); assert.match(html(a.dom), /continuer sans connexion/);
  ev(a.ctx, 'gateContinueOffline()');
  assert.equal(ev(a.ctx, 'authGateIsOpen()'), false);
  assert.equal(a.ctx.__store.get('letzlift:sync-auth'), undefined);
});

test('déconnexion et session expirée : l’écran revient', async () => {
  const a = await boot({ 'letzlift:sync-auth': AUTH });
  a.ctx.fetch = async () => ({ status: 200, ok: true, json: async () => ({}) });
  ev(a.ctx, 'syncLoadAuth()');
  ev(a.ctx, 'syncDisconnectLocal()');
  assert.equal(ev(a.ctx, 'authGateIsOpen()'), true); assert.equal(a.ctx.__store.get('letzlift:sync-auth'), undefined);
  const b = await boot({ 'letzlift:sync-auth': AUTH });
  b.ctx.fetch = async () => ({ status: 401, ok: false, json: async () => ({ error: 'Session expirée : reconnecte-toi.' }) });
  ev(b.ctx, 'syncLoadAuth()');
  await ev(b.ctx, 'syncNow()');
  assert.equal(ev(b.ctx, 'authGateIsOpen()'), true); assert.match(html(b.dom), /Session expirée/);
});
