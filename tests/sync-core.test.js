const test = require('node:test');
const assert = require('node:assert/strict');
const { makeD1 } = require('./helpers/fake-d1.js');
const { mergeData } = require('../js/lib/sync-merge.js');
const core = require('../js/lib/sync-core.js');

let worker;
test.before(async () => { worker = (await import('../worker/worker.mjs')).default; });

const ORIGIN = 'https://29mwrzfcn5-code.github.io';
function server() {
  const env = { DB: makeD1(), INVITE_CODE: 'sesame' };
  const fetchFn = (url, init) => worker.fetch(new Request(url, { ...init, headers: { ...init.headers, Origin: ORIGIN, 'CF-Connecting-IP': '9.9.9.9' } }), env);
  return { env, fetchFn };
}

// Un « appareil » : ses données locales, son client, et la même boucle que l'app.
function device(srv, data) {
  const dev = { data, client: core.createClient({ baseUrl: 'https://sync.example', fetch: srv.fetchFn }), applied: 0 };
  dev.sync = () => core.runSync({
    client: dev.client, getLocal: () => JSON.parse(JSON.stringify(dev.data)), merge: mergeData,
    validate: d => core.validOverlay(d.vocabOverlay), apply: async d => { dev.data = JSON.parse(JSON.stringify(d)); dev.applied++; },
  });
  return dev;
}
const answer = (id, box, t) => ({ [id]: { box, dueAt: t + 1000, updatedAt: t } });

test('deux appareils : ce que chacun apprend arrive chez l’autre, sans rien perdre', async () => {
  const srv = server();
  const bureau = device(srv, { vocabProgress: { ...answer('v1', 3, 100), ...answer('v2', 2, 110) }, courseProgress: {}, xpState: { enduranceXP: 50 } });
  const reg = await bureau.client.register('maxime', 'correct-horse-9', 'sesame');
  assert.equal(reg.status, 201); bureau.client.setToken(reg.body.token);
  const r1 = await bureau.sync();
  assert.deepEqual([r1.uploaded, r1.applied], [true, false]);

  const maison = device(srv, { vocabProgress: { ...answer('v9', 1, 500) }, courseProgress: answer('l01:w:dësch', 2, 520), xpState: { enduranceXP: 10 } });
  const login = await maison.client.login('MAXIME', 'correct-horse-9');
  assert.equal(login.status, 200); maison.client.setToken(login.body.token);
  const r2 = await maison.sync();
  assert.deepEqual([r2.uploaded, r2.applied], [true, true]);
  assert.deepEqual(Object.keys(maison.data.vocabProgress).sort(), ['v1', 'v2', 'v9']);
  assert.equal(maison.data.xpState.enduranceXP, 50);

  const r3 = await bureau.sync();
  assert.deepEqual(Object.keys(bureau.data.vocabProgress).sort(), ['v1', 'v2', 'v9']);
  assert.ok(bureau.data.courseProgress['l01:w:dësch']);
  const r4 = await bureau.sync();
  assert.deepEqual([r4.uploaded, r4.applied], [false, false]); // rien à faire : aucune écriture
  assert.equal(r4.rev, r3.rev);
});

test('même carte révisée des deux côtés : la plus récente gagne partout', async () => {
  const srv = server();
  const a = device(srv, { vocabProgress: answer('v1', 2, 100) }), b = device(srv, { vocabProgress: answer('v1', 5, 900) });
  a.client.setToken((await a.client.register('lea', 'un-mot-de-passe-1', 'sesame')).body.token);
  b.client.setToken((await b.client.login('lea', 'un-mot-de-passe-1')).body.token);
  await a.sync(); await b.sync(); await a.sync();
  assert.equal(a.data.vocabProgress.v1.box, 5); assert.equal(b.data.vocabProgress.v1.box, 5);
});

test('conflit : un autre appareil écrit entre la lecture et l’envoi → on refait la fusion', async () => {
  const srv = server();
  const a = device(srv, { vocabProgress: answer('v1', 2, 100) }), b = device(srv, { vocabProgress: answer('v2', 3, 200) });
  a.client.setToken((await a.client.register('lea', 'un-mot-de-passe-1', 'sesame')).body.token);
  b.client.setToken((await b.client.login('lea', 'un-mot-de-passe-1')).body.token);
  await a.sync();
  // b lit, puis a écrit avant que b n'envoie
  const realPut = b.client.putData; let injected = false;
  b.client.putData = async (rev, data) => {
    if (!injected) { injected = true; a.data.vocabProgress = { ...a.data.vocabProgress, ...answer('v3', 4, 300) }; await a.sync(); }
    return realPut(rev, data);
  };
  const r = await b.sync();
  assert.equal(r.uploaded, true);
  await a.sync();
  for (const d of [a, b]) assert.deepEqual(Object.keys(d.data.vocabProgress).sort(), ['v1', 'v2', 'v3']);
});

test('session expirée : erreur « auth » ; données serveur invalides : rien n’est appliqué', async () => {
  const srv = server();
  const a = device(srv, { vocabProgress: {} });
  a.client.setToken((await a.client.register('lea', 'un-mot-de-passe-1', 'sesame')).body.token);
  await a.sync();
  srv.env.DB.raw.prepare('UPDATE sessions SET expires_at = 1').run();
  await assert.rejects(a.sync(), e => e.code === 'auth');
  const b = device(srv, { vocabProgress: { v1: { box: 1, dueAt: 1 } } });
  b.client.setToken((await b.client.login('lea', 'un-mot-de-passe-1')).body.token);
  const bad = { vocabProgress: {}, vocabOverlay: { perso1: { lu: '<script>', updatedAt: 1 } } };
  srv.env.DB.raw.prepare('UPDATE user_data SET json = ?').run(JSON.stringify(bad));
  await assert.rejects(b.sync(), e => e.code === 'invalid');
  assert.equal(b.applied, 0); assert.ok(b.data.vocabProgress.v1);
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
