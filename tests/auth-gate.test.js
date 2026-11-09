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
  for (const id of ['gate-user', 'gate-pass', 'gate-pass2', 'gate-invite', 'gate-url']) dom.add(id);
  app.ctx.AbortController = AbortController;
  return { ctx: app.ctx, dom, gate, appEl };
}
const html = dom => dom.els.get('auth-gate').innerHTML;
const AUTH = JSON.stringify({ url: 'https://sync.example', username: 'maxime', token: 'a'.repeat(64), lastSyncAt: 1 });

test('sans compte connecté : l’écran s’ouvre et l’app est neutralisée ; avec un jeton valide : pas d’écran', async () => {
  const a = await boot();
  ev(a.ctx, 'syncGateStartup()');
  assert.equal(ev(a.ctx, 'authGateIsOpen()'), true);
  assert.match(html(a.dom), /Connexion/); assert.ok('inert' in a.appEl.attrs);
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

test('l’identifiant affiché est échappé ; basculer vers « créer un compte » ajoute confirmation et code', async () => {
  const a = await boot();
  ev(a.ctx, `syncLastUser = '"><img src=x onerror=alert(1)>'`);
  ev(a.ctx, 'authGateShow()');
  assert.ok(!html(a.dom).includes('<img'));
  assert.ok(!html(a.dom).includes('gate-invite'));
  ev(a.ctx, 'gateToggleMode()');
  assert.match(html(a.dom), /gate-pass2/); assert.match(html(a.dom), /gate-invite/); assert.match(html(a.dom), /Créer le compte/);
});

test('création : mots de passe différents refusés sans appel réseau', async () => {
  const a = await boot(); let calls = 0;
  a.ctx.fetch = async () => { calls++; throw new Error('pas de réseau attendu'); };
  ev(a.ctx, 'authGateShow(); gateToggleMode()');
  a.dom.els.get('gate-user').value = 'maxime'; a.dom.els.get('gate-pass').value = 'correct-horse-9'; a.dom.els.get('gate-pass2').value = 'autre-chose-1234'; a.dom.els.get('gate-invite').value = 'x';
  await ev(a.ctx, 'gateSubmit(null)');
  assert.equal(calls, 0); assert.match(html(a.dom), /pas identiques/); assert.equal(ev(a.ctx, 'authGateIsOpen()'), true);
});

test('connexion réussie : jeton enregistré sur l’appareil, écran fermé, vue d’accueil', async () => {
  const a = await boot(); const seen = [];
  a.ctx.fetch = async (url, init) => {
    seen.push(`${init.method} ${new URL(url).pathname}`);
    const body = url.endsWith('/api/login') ? { token: 'b'.repeat(64), username: 'maxime' } : { rev: 0, data: null };
    return { status: 200, ok: true, json: async () => body };
  };
  ev(a.ctx, 'switchView = n => { globalThis.__view = n; }'); // l'écran d'accueil lui-même est testé ailleurs
  ev(a.ctx, 'authGateShow()');
  a.dom.els.get('gate-user').value = ' Maxime '; a.dom.els.get('gate-pass').value = 'correct-horse-9';
  await ev(a.ctx, 'gateSubmit(null)');
  assert.equal(ev(a.ctx, 'authGateIsOpen()'), false); assert.ok(!('inert' in a.appEl.attrs));
  assert.deepEqual(seen.slice(0, 2), ['POST /api/login', 'GET /api/data']);
  assert.equal(ev(a.ctx, 'globalThis.__view'), 'home');
  const stored = JSON.parse(a.ctx.__store.get('letzlift:sync-auth'));
  assert.equal(stored.username, 'maxime'); assert.equal(stored.token, 'b'.repeat(64));
  assert.ok(!JSON.stringify(JSON.parse(ev(a.ctx, 'JSON.stringify(buildBackupPayload())'))).includes('b'.repeat(64)));
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
