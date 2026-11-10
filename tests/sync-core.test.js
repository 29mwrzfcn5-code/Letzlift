const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { makeD1 } = require('./helpers/fake-d1.js');
const core = require('../js/lib/sync-core.js');

let worker;
test.before(async () => { worker = (await import('../worker/worker.mjs')).default; });

const ORIGIN = 'https://29mwrzfcn5-code.github.io';
const keyHash = code => crypto.createHash('sha256').update(String(code).trim().toUpperCase()).digest('hex');
function server() {
  const env = { DB: makeD1() };
  const fetchFn = (url, init) => worker.fetch(new Request(url, { ...init, headers: { ...init.headers, Origin: ORIGIN, 'CF-Connecting-IP': '9.9.9.9' } }), env);
  let n = 0;
  const makeKey = () => { const code = 'KEY' + (n++); env.DB.raw.prepare('INSERT INTO invites (id, code_hash, label, created_at) VALUES (?,?,?,?)').run('id' + code, keyHash(code), 't', Date.now()); return code; };
  return { env, fetchFn, makeKey };
}
const fields = (username, key) => ({ username, password: 'correct-horse-9', key, acceptTerms: true, age16: true, termsVersion: 't1' });

// Un « appareil » : ses données locales, son client, et la même boucle que l'app.
function device(srv, data) {
  const dev = { data, client: core.createClient({ baseUrl: 'https://sync.example', fetch: srv.fetchFn }), applied: 0 };
  dev.sync = () => core.runSync({
    client: dev.client, getLocal: () => JSON.parse(JSON.stringify(dev.data)),
    validate: d => core.validOverlay(d.vocabOverlay), apply: async d => { dev.data = JSON.parse(JSON.stringify(d)); dev.applied++; },
  });
  return dev;
}
const answer = (id, box, t) => ({ [id]: { box, dueAt: t + 1000, updatedAt: t } });

test('deux appareils : ce que chacun apprend arrive chez l’autre, sans rien perdre', async () => {
  const srv = server();
  const bureau = device(srv, { vocabProgress: { ...answer('v1', 3, 100), ...answer('v2', 2, 110) }, courseProgress: {}, xpState: { enduranceXP: 50 } });
  const reg = await bureau.client.register(fields('maxime', srv.makeKey()));
  assert.equal(reg.status, 201); bureau.client.setToken(reg.body.token);
  const r1 = await bureau.sync();
  assert.equal(r1.applied, false);

  const maison = device(srv, { vocabProgress: { ...answer('v9', 1, 500) }, courseProgress: answer('l01:w:dësch', 2, 520), xpState: { enduranceXP: 10 } });
  const login = await maison.client.login('MAXIME', 'correct-horse-9');
  assert.equal(login.status, 200); maison.client.setToken(login.body.token);
  const r2 = await maison.sync();
  assert.equal(r2.applied, true);
  assert.deepEqual(Object.keys(maison.data.vocabProgress).sort(), ['v1', 'v2', 'v9']);
  assert.equal(maison.data.xpState.enduranceXP, 50);

  await bureau.sync();
  assert.deepEqual(Object.keys(bureau.data.vocabProgress).sort(), ['v1', 'v2', 'v9']);
  assert.ok(bureau.data.courseProgress['l01:w:dësch']);
  const r4 = await bureau.sync();
  assert.equal(r4.applied, false); // rien de nouveau : on n'applique rien
});

test('même carte révisée des deux côtés : la plus récente gagne partout', async () => {
  const srv = server();
  const a = device(srv, { vocabProgress: answer('v1', 2, 100) }), b = device(srv, { vocabProgress: answer('v1', 5, 900) });
  a.client.setToken((await a.client.register(fields('lea', srv.makeKey()))).body.token);
  b.client.setToken((await b.client.login('lea', 'correct-horse-9')).body.token);
  await a.sync(); await b.sync(); await a.sync();
  assert.equal(a.data.vocabProgress.v1.box, 5); assert.equal(b.data.vocabProgress.v1.box, 5);
});

test('session expirée : erreur « auth » ; compte suspendu : erreur « suspended » ; données invalides : rien n’est appliqué', async () => {
  const srv = server();
  const a = device(srv, { vocabProgress: {} });
  a.client.setToken((await a.client.register(fields('lea', srv.makeKey()))).body.token);
  await a.sync();
  srv.env.DB.raw.prepare("UPDATE users SET status = 'suspended'").run();
  await assert.rejects(a.sync(), e => e.code === 'suspended');
  srv.env.DB.raw.prepare("UPDATE users SET status = 'active'").run();
  srv.env.DB.raw.prepare('UPDATE sessions SET expires_at = 1').run();
  await assert.rejects(a.sync(), e => e.code === 'auth');
  const b = device(srv, { vocabProgress: { v1: { box: 1, dueAt: 1 } } });
  b.client.setToken((await b.client.login('lea', 'correct-horse-9')).body.token);
  srv.env.DB.raw.prepare('UPDATE user_data SET json = ?').run(JSON.stringify({ vocabProgress: {}, vocabOverlay: { perso1: { lu: '<script>', updatedAt: 1 } } }));
  await assert.rejects(b.sync(), e => e.code === 'invalid');
  assert.equal(b.applied, 0); assert.ok(b.data.vocabProgress.v1);
});

test('le client appelle me, consentement et événements', async () => {
  const srv = server();
  const c = core.createClient({ baseUrl: 'https://sync.example', fetch: srv.fetchFn });
  c.setToken((await c.register({ ...fields('lea', srv.makeKey()), analytics: false, consentVersion: 'c1' })).body.token);
  assert.equal((await c.me()).body.me.analyticsConsent, false);
  assert.equal((await c.events([{ name: 'app_open' }])).body.stored, 0);
  assert.equal((await c.consent(true, 'c2')).body.me.analyticsConsent, true);
  assert.equal((await c.events([{ name: 'app_open' }])).body.stored, 1);
  assert.equal((await c.request('GET', '/api/admin/overview')).status, 403);
});

test('canonical : ordre des clés sans importance', () => {
  assert.equal(core.canonical({ a: 1, b: [2, { d: 1, c: 2 }] }), core.canonical({ b: [2, { c: 2, d: 1 }], a: 1 }));
  assert.notEqual(core.canonical({ a: 1 }), core.canonical({ a: 2 }));
});

test('normalizeServerUrl : https seulement (ou localhost)', () => {
  assert.equal(core.normalizeServerUrl(' https://x.y.workers.dev/ '), 'https://x.y.workers.dev');
  assert.equal(core.normalizeServerUrl('http://localhost:8787'), 'http://localhost:8787');
  for (const bad of ['http://x.workers.dev', 'ftp://x', 'x.workers.dev', 'https://x.dev/path', '', null, 'javascript:alert(1)']) assert.equal(core.normalizeServerUrl(bad), null, String(bad));
});

test('validOverlay : champs connus, courts, sans < >', () => {
  assert.equal(core.validOverlay(undefined), true);
  assert.equal(core.validOverlay({ perso1: { lu: 'Kuerf', fr: 'panier', cat: 'Divers', g: 'c', sentence: 'Ech hunn e ___.', sentenceFr: 'ok', updatedAt: 5 } }), true);
  for (const bad of [[], { 'a b': { lu: 'x' } }, { p: { evil: 'x' } }, { p: { lu: 'a<b' } }, { p: { lu: 'a"b' } }, { p: { sentence: 'x'.repeat(301) } }, { p: { updatedAt: 'x' } }, { p: [] }]) assert.equal(core.validOverlay(bad), false, JSON.stringify(bad));
});

test('client : récupération sans jeton, nouveau code avec jeton', async () => {
  const seen = [];
  const fetchFn = async (url, init) => { seen.push({ url, init }); return { status: 200, ok: true, json: async () => ({}) }; };
  const c = require('../js/lib/sync-core.js').createClient({ baseUrl: 'https://s.example', fetch: fetchFn, token: 't'.repeat(64) });
  await c.recover('maxime', 'LZR-AAAAA-BBBBB-CCCCC', 'nouveau-mot-de-passe');
  await c.newRecoveryCode('mot-de-passe-actuel');
  assert.equal(seen[0].url, 'https://s.example/api/recover'); assert.equal(seen[0].init.method, 'POST');
  assert.equal(seen[0].init.headers.Authorization, undefined);
  assert.deepEqual(JSON.parse(seen[0].init.body), { username: 'maxime', code: 'LZR-AAAAA-BBBBB-CCCCC', newPassword: 'nouveau-mot-de-passe' });
  assert.equal(seen[1].url, 'https://s.example/api/recovery-code'); assert.equal(seen[1].init.headers.Authorization, 'Bearer ' + 't'.repeat(64));
  assert.deepEqual(JSON.parse(seen[1].init.body), { password: 'mot-de-passe-actuel' });
});
