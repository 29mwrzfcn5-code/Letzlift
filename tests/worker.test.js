const test = require('node:test');
const assert = require('node:assert/strict');
const { makeD1 } = require('./helpers/fake-d1.js');

const ORIGIN = 'https://29mwrzfcn5-code.github.io';
let worker;
test.before(async () => { worker = (await import('../worker/worker.mjs')).default; });

function setup(extra) {
  const env = { DB: makeD1(), INVITE_CODE: 'sesame-2026', ...extra };
  let n = 0;
  const call = async (method, p, body, token, headers) => {
    const h = { 'Content-Type': 'application/json', Origin: ORIGIN, 'CF-Connecting-IP': '10.0.0.' + ((n++ % 200) + 1), ...headers };
    if (token) h.Authorization = 'Bearer ' + token;
    const res = await worker.fetch(new Request('https://sync.example' + p, { method, headers: h, body: body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)) }), env);
    return { status: res.status, body: await res.json().catch(() => null), headers: res.headers };
  };
  return { env, call };
}
const PW = 'correct-horse-9';
const DATA = (n) => ({ app: 'letzlift', vocabProgress: { v1: { box: n, dueAt: 1 } }, courseProgress: {} });

async function register(s, username = 'maxime', password = PW) {
  const r = await s.call('POST', '/api/register', { username, password, invite: 'sesame-2026' });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return r.body.token;
}

test('inscription : code d’invitation requis, identifiant normalisé, doublon refusé', async () => {
  const s = setup();
  assert.equal((await s.call('POST', '/api/register', { username: 'maxime', password: PW, invite: 'faux' })).status, 403);
  const ok = await s.call('POST', '/api/register', { username: ' Maxime ', password: PW, invite: 'sesame-2026' });
  assert.equal(ok.status, 201); assert.equal(ok.body.username, 'maxime'); assert.match(ok.body.token, /^[0-9a-f]{64}$/);
  assert.equal((await s.call('POST', '/api/register', { username: 'MAXIME', password: PW, invite: 'sesame-2026' })).status, 409);
});

test('inscription : identifiant et mot de passe valides exigés', async () => {
  const s = setup();
  for (const [u, p] of [['ab', PW], ['Max Blanchard', PW], ['maxime!', PW], ['maxime', 'court'], ['maxime', 'x'.repeat(129)]]) {
    assert.equal((await s.call('POST', '/api/register', { username: u, password: p, invite: 'sesame-2026' })).status, 400, `${u} / ${p.length}`);
  }
});

test('inscription fermée sans INVITE_CODE', async () => {
  const s = setup({ INVITE_CODE: undefined });
  assert.equal((await s.call('POST', '/api/register', { username: 'maxime', password: PW, invite: '' })).status, 403);
});

test('mot de passe stocké haché, jeton stocké haché', async () => {
  const s = setup();
  const token = await register(s);
  const u = s.env.DB.raw.prepare('SELECT * FROM users').get();
  assert.ok(!JSON.stringify(u).includes(PW)); assert.equal(u.iterations, 100000);
  const sessions = s.env.DB.raw.prepare('SELECT token_hash FROM sessions').all();
  assert.equal(sessions.length, 1); assert.notEqual(sessions[0].token_hash, token); assert.match(sessions[0].token_hash, /^[0-9a-f]{64}$/);
});

test('connexion : bon mot de passe, mauvais mot de passe et compte inconnu donnent la même erreur', async () => {
  const s = setup(); await register(s);
  const good = await s.call('POST', '/api/login', { username: 'Maxime', password: PW });
  assert.equal(good.status, 200); assert.ok(good.body.token);
  const bad = await s.call('POST', '/api/login', { username: 'maxime', password: 'mauvais-mot-de-passe' });
  const unknown = await s.call('POST', '/api/login', { username: 'personne', password: PW });
  assert.equal(bad.status, 401); assert.equal(unknown.status, 401);
  assert.deepEqual(bad.body, unknown.body);
});

test('verrouillage de 15 minutes après 5 échecs, même avec le bon mot de passe', async () => {
  const s = setup(); await register(s);
  for (let i = 0; i < 4; i++) assert.equal((await s.call('POST', '/api/login', { username: 'maxime', password: 'mauvais-mot-de-passe' })).status, 401);
  assert.equal((await s.call('POST', '/api/login', { username: 'maxime', password: 'mauvais-mot-de-passe' })).status, 429);
  assert.equal((await s.call('POST', '/api/login', { username: 'maxime', password: PW })).status, 429);
  s.env.DB.raw.prepare('UPDATE users SET locked_until = 1').run(); // le verrou expire
  assert.equal((await s.call('POST', '/api/login', { username: 'maxime', password: PW })).status, 200);
});

test('limite par adresse : trop de connexions en dix minutes', async () => {
  const s = setup(); await register(s);
  let last;
  for (let i = 0; i < 31; i++) last = await s.call('POST', '/api/login', { username: 'inconnu' + i, password: PW }, undefined, { 'CF-Connecting-IP': '1.2.3.4' });
  assert.equal(last.status, 429);
});

test('données : authentification obligatoire, version attendue, conflit 409', async () => {
  const s = setup(); const token = await register(s);
  assert.equal((await s.call('GET', '/api/data')).status, 401);
  assert.equal((await s.call('GET', '/api/data', undefined, 'a'.repeat(64))).status, 401);
  const empty = await s.call('GET', '/api/data', undefined, token);
  assert.deepEqual(empty.body, { rev: 0, data: null });
  const put1 = await s.call('PUT', '/api/data', { expectedRev: 0, data: DATA(2) }, token);
  assert.equal(put1.status, 200); assert.equal(put1.body.rev, 1);
  const stale = await s.call('PUT', '/api/data', { expectedRev: 0, data: DATA(3) }, token);
  assert.equal(stale.status, 409); assert.equal(stale.body.rev, 1);
  const put2 = await s.call('PUT', '/api/data', { expectedRev: 1, data: DATA(4) }, token);
  assert.equal(put2.body.rev, 2);
  const got = await s.call('GET', '/api/data', undefined, token);
  assert.equal(got.body.rev, 2); assert.equal(got.body.data.vocabProgress.v1.box, 4);
});

test('données : forme invalide ou trop volumineuse refusées ; chaque compte voit ses données seulement', async () => {
  const s = setup(); const t1 = await register(s, 'maxime'); const t2 = await register(s, 'autre', 'un-autre-mot-de-passe');
  assert.equal((await s.call('PUT', '/api/data', { expectedRev: 0, data: [] }, t1)).status, 400);
  assert.equal((await s.call('PUT', '/api/data', { expectedRev: 'x', data: DATA(1) }, t1)).status, 400);
  assert.equal((await s.call('PUT', '/api/data', '{pas du json', t1)).status, 400);
  const big = DATA(1); big.courseProgress = { x: 'y'.repeat(1_600_000) };
  assert.equal((await s.call('PUT', '/api/data', { expectedRev: 0, data: big }, t1)).status, 413);
  await s.call('PUT', '/api/data', { expectedRev: 0, data: DATA(5) }, t1);
  assert.equal((await s.call('GET', '/api/data', undefined, t2)).body.data, null);
});

test('CORS : origine du site autorisée, autre origine refusée, préflight', async () => {
  const s = setup();
  const ok = await s.call('GET', '/api/health');
  assert.equal(ok.headers.get('access-control-allow-origin'), ORIGIN);
  const bad = await s.call('GET', '/api/health', undefined, undefined, { Origin: 'https://evil.example' });
  assert.equal(bad.status, 403); assert.equal(bad.headers.get('access-control-allow-origin'), null);
  const pre = await worker.fetch(new Request('https://sync.example/api/data', { method: 'OPTIONS', headers: { Origin: ORIGIN } }), s.env);
  assert.equal(pre.status, 204); assert.match(pre.headers.get('access-control-allow-headers'), /Authorization/);
  const custom = setup({ ALLOWED_ORIGINS: 'https://autre.example' });
  assert.equal((await custom.call('GET', '/api/health')).status, 403);
});

test('changement de mot de passe : ancien refusé, autres appareils déconnectés, cet appareil garde sa session', async () => {
  const s = setup(); const t1 = await register(s);
  const t2 = (await s.call('POST', '/api/login', { username: 'maxime', password: PW })).body.token;
  assert.equal((await s.call('POST', '/api/password', { oldPassword: 'faux-faux-faux', newPassword: 'nouveau-mot-de-passe' }, t1)).status, 401);
  assert.equal((await s.call('POST', '/api/password', { oldPassword: PW, newPassword: 'court' }, t1)).status, 400);
  assert.equal((await s.call('POST', '/api/password', { oldPassword: PW, newPassword: 'nouveau-mot-de-passe' }, t1)).status, 200);
  assert.equal((await s.call('GET', '/api/data', undefined, t1)).status, 200);
  assert.equal((await s.call('GET', '/api/data', undefined, t2)).status, 401);
  assert.equal((await s.call('POST', '/api/login', { username: 'maxime', password: PW })).status, 401);
  assert.equal((await s.call('POST', '/api/login', { username: 'maxime', password: 'nouveau-mot-de-passe' })).status, 200);
});

test('déconnexion : le jeton ne sert plus ; jeton expiré refusé ; 10 sessions au maximum', async () => {
  const s = setup(); const t = await register(s);
  await s.call('POST', '/api/logout', {}, t);
  assert.equal((await s.call('GET', '/api/data', undefined, t)).status, 401);
  const t2 = (await s.call('POST', '/api/login', { username: 'maxime', password: PW })).body.token;
  s.env.DB.raw.prepare('UPDATE sessions SET expires_at = 1').run();
  assert.equal((await s.call('GET', '/api/data', undefined, t2)).status, 401);
  for (let i = 0; i < 14; i++) await s.call('POST', '/api/login', { username: 'maxime', password: PW });
  assert.ok(s.env.DB.raw.prepare('SELECT COUNT(*) AS n FROM sessions').get().n <= 10);
});

test('suppression du compte : mot de passe requis, tout est effacé', async () => {
  const s = setup(); const t = await register(s);
  await s.call('PUT', '/api/data', { expectedRev: 0, data: DATA(1) }, t);
  assert.equal((await s.call('DELETE', '/api/account', { password: 'faux-faux-faux' }, t)).status, 401);
  assert.equal((await s.call('DELETE', '/api/account', { password: PW }, t)).status, 200);
  for (const table of ['users', 'sessions', 'user_data']) assert.equal(s.env.DB.raw.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n, 0, table);
  assert.equal((await s.call('POST', '/api/login', { username: 'maxime', password: PW })).status, 401);
});

test('route inconnue : 404 ; aucune fuite d’erreur interne', async () => {
  const s = setup(); const t = await register(s);
  assert.equal((await s.call('GET', '/api/nope', undefined, t)).status, 404);
  const broken = await worker.fetch(new Request('https://sync.example/api/health'), {});
  assert.equal(broken.status, 200);
  const err = await worker.fetch(new Request('https://sync.example/api/login', { method: 'POST', body: '{}' }), {});
  assert.equal(err.status, 500); assert.deepEqual(await err.json(), { error: 'Erreur du serveur.' });
});
