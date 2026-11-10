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

// ---- code de récupération ----
function recoveryFetch(seen, over = {}) {
  return async (url, init) => {
    const path = new URL(url).pathname; seen.push({ path, auth: (init.headers || {}).Authorization || null, body: init.body ? JSON.parse(init.body) : null });
    const me = { id: 'x'.repeat(32), username: 'maxime', role: 'user', entitlements: [], analyticsConsent: false, hasRecovery: true };
    if (path === '/api/register') return { status: 201, ok: true, json: async () => ({ token: 'c'.repeat(64), username: 'maxime', me, recoveryCode: 'LZR-AAAAA-BBBBB-CCCCC' }) };
    if (path === '/api/recover') {
      if (over.recoverFail) return { status: 401, ok: false, json: async () => ({ error: 'Identifiant ou code de récupération incorrect.' }) };
      return { status: 200, ok: true, json: async () => ({ token: 'd'.repeat(64), username: 'maxime', me, recoveryCode: 'LZR-DDDDD-EEEEE-FFFFF' }) };
    }
    if (path === '/api/recovery-code') return { status: 200, ok: true, json: async () => ({ recoveryCode: 'LZR-GGGGG-HHHHH-JJJJJ', me }) };
    return { status: 200, ok: true, json: async () => ({ rev: 1, data: { vocabProgress: {} }, me }) };
  };
}

test('création : le code de récupération est montré avant d’entrer, il faut cocher la case, puis il disparaît de l’écran', async () => {
  const a = await boot(); const seen = [];
  a.ctx.fetch = recoveryFetch(seen);
  ev(a.ctx, 'switchView = n => { globalThis.__view = n; }');
  ev(a.ctx, 'authGateShow(); gateToggleMode()');
  fillRegister(a); await ev(a.ctx, 'gateSubmit(null)');
  a.dom.add('gate-terms').checked = true;
  await ev(a.ctx, 'gateRegister(false)');
  assert.equal(ev(a.ctx, 'authGateIsOpen()'), true, 'l’écran reste ouvert pour montrer le code');
  assert.match(html(a.dom), /Ton code de récupération/); assert.match(html(a.dom), /LZR-AAAAA-BBBBB-CCCCC/);
  assert.notEqual(ev(a.ctx, 'globalThis.__view'), 'home');
  assert.equal(JSON.parse(a.ctx.__store.get('letzlift:sync-auth')).token, 'c'.repeat(64)); // le compte est bien créé
  const saved = a.dom.add('gate-saved'); saved.checked = false;
  await ev(a.ctx, 'gateRecoveryContinue()');
  assert.match(html(a.dom), /Coche la case/); assert.equal(ev(a.ctx, 'authGateIsOpen()'), true);
  saved.checked = true;
  await ev(a.ctx, 'gateRecoveryContinue()');
  assert.equal(ev(a.ctx, 'authGateIsOpen()'), false); assert.equal(ev(a.ctx, 'globalThis.__view'), 'home');
  assert.ok(!html(a.dom).includes('LZR-AAAAA'));
  assert.equal(ev(a.ctx, 'gateRecoveryCode'), null);
  assert.ok(!JSON.stringify([...a.ctx.__store.entries()]).includes('LZR-AAAAA'), 'le code n’est jamais enregistré sur l’appareil');
});

test('l’écran de connexion propose « Mot de passe oublié ? » (pas à la création) ; le formulaire demande identifiant, code et nouveau mot de passe', async () => {
  const a = await boot();
  ev(a.ctx, 'authGateShow()');
  assert.match(html(a.dom), /Mot de passe oublié \?/);
  ev(a.ctx, 'gateToggleMode()'); assert.ok(!/Mot de passe oublié \?/.test(html(a.dom)));
  ev(a.ctx, 'gateToggleMode(); gateShowRecover()');
  for (const id of ['gate-user', 'gate-code', 'gate-pass', 'gate-pass2']) assert.match(html(a.dom), new RegExp(id));
  assert.match(html(a.dom), /LZR-/); assert.match(html(a.dom), /Changer mon mot de passe/);
  ev(a.ctx, 'gateBackToLogin()'); assert.match(html(a.dom), /Se connecter/);
});

test('récupération : champs vérifiés sans appel réseau, puis nouveau mot de passe, nouveau code à noter, connexion', async () => {
  const a = await boot(); const seen = [];
  a.ctx.fetch = recoveryFetch(seen);
  ev(a.ctx, 'switchView = n => { globalThis.__view = n; }');
  ev(a.ctx, 'authGateShow(); gateShowRecover()');
  a.dom.add('gate-code');
  const set = v => { for (const [id, val] of Object.entries(v)) a.dom.els.get(id).value = val; };
  set({ 'gate-user': 'maxime', 'gate-code': '', 'gate-pass': 'nouveau-mot-de-passe-7', 'gate-pass2': 'nouveau-mot-de-passe-7' });
  await ev(a.ctx, 'gateRecoverSubmit(null)'); assert.match(html(a.dom), /code de récupération/i);
  set({ 'gate-code': 'lzr-aaaaa-bbbbb-ccccc', 'gate-pass': 'court', 'gate-pass2': 'court' });
  await ev(a.ctx, 'gateRecoverSubmit(null)'); assert.match(html(a.dom), /au moins 10 caractères/);
  set({ 'gate-pass': 'nouveau-mot-de-passe-7', 'gate-pass2': 'autre-mot-de-passe-77' });
  await ev(a.ctx, 'gateRecoverSubmit(null)'); assert.match(html(a.dom), /pas identiques/);
  assert.equal(seen.length, 0, 'aucun appel tant que les champs sont invalides');
  set({ 'gate-pass2': 'nouveau-mot-de-passe-7' });
  await ev(a.ctx, 'gateRecoverSubmit(null)');
  const call = seen.find(x => x.path === '/api/recover');
  assert.deepEqual(call.body, { username: 'maxime', code: 'lzr-aaaaa-bbbbb-ccccc', newPassword: 'nouveau-mot-de-passe-7' }); assert.equal(call.auth, null);
  assert.match(html(a.dom), /LZR-DDDDD-EEEEE-FFFFF/); assert.match(html(a.dom), /nouveau/); assert.match(html(a.dom), /l'ancien ne fonctionne plus/);
  assert.equal(JSON.parse(a.ctx.__store.get('letzlift:sync-auth')).token, 'd'.repeat(64));
  a.dom.add('gate-saved').checked = true;
  await ev(a.ctx, 'gateRecoveryContinue()');
  assert.equal(ev(a.ctx, 'authGateIsOpen()'), false); assert.equal(ev(a.ctx, 'globalThis.__view'), 'home');
});

test('récupération refusée : message du serveur, on reste sur le formulaire, rien n’est enregistré', async () => {
  const a = await boot(); const seen = [];
  a.ctx.fetch = recoveryFetch(seen, { recoverFail: true });
  ev(a.ctx, 'authGateShow(); gateShowRecover()'); a.dom.add('gate-code');
  for (const [id, val] of Object.entries({ 'gate-user': 'maxime', 'gate-code': 'LZR-AAAAA-BBBBB-CCCCC', 'gate-pass': 'nouveau-mot-de-passe-7', 'gate-pass2': 'nouveau-mot-de-passe-7' })) a.dom.els.get(id).value = val;
  await ev(a.ctx, 'gateRecoverSubmit(null)');
  assert.match(html(a.dom), /Identifiant ou code de récupération incorrect/); assert.match(html(a.dom), /gate-code/);
  assert.equal(a.ctx.__store.get('letzlift:sync-auth'), undefined);
});

test('Paramètres : nouveau code avec le mot de passe actuel, montré une fois ; état « pas encore de code » signalé', async () => {
  const a = await boot({ 'letzlift:sync-auth': AUTH }); const seen = [];
  a.ctx.fetch = recoveryFetch(seen);
  ev(a.ctx, "renderParametres = () => { globalThis.__cardHtml = syncCardHtml(); }");
  ev(a.ctx, 'syncLoadAuth(); syncMe = { id: "x", username: "maxime", role: "user", entitlements: [], hasRecovery: false }');
  assert.match(ev(a.ctx, 'syncCardHtml()'), /tu n'en as pas encore/); assert.match(ev(a.ctx, 'syncCardHtml()'), /Créer mon code de récupération/);
  a.dom.add('sync-old-pass').value = '';
  await ev(a.ctx, 'syncNewRecoveryCode()');
  assert.equal(seen.length, 0, 'mot de passe actuel exigé');
  a.dom.els.get('sync-old-pass').value = 'correct-horse-9';
  await ev(a.ctx, 'syncNewRecoveryCode()');
  const c = seen.find(x => x.path === '/api/recovery-code');
  assert.deepEqual(c.body, { password: 'correct-horse-9' }); assert.equal(c.auth, 'Bearer ' + 'a'.repeat(64));
  assert.match(ev(a.ctx, 'syncCardHtml()'), /LZR-GGGGG-HHHHH-JJJJJ/);
  ev(a.ctx, 'syncRecoveryDone()');
  assert.ok(!ev(a.ctx, 'syncCardHtml()').includes('LZR-GGGGG'));
  assert.match(ev(a.ctx, 'syncCardHtml()'), /tu en as un/);
});
