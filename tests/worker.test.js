const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { makeD1 } = require('./helpers/fake-d1.js');

const ORIGIN = 'https://29mwrzfcn5-code.github.io';
const PW = 'correct-horse-9';
const DAY = 86400000;
let worker;
test.before(async () => { worker = (await import('../worker/worker.mjs')).default; });

const sha = text => crypto.createHash('sha256').update(text).digest('hex');
const keyHash = code => sha(String(code).trim().toUpperCase().replace(/\s+/g, '')); // comme normalizeKey() du serveur

function setup(extra) {
  const env = { DB: makeD1(), ...extra };
  let n = 0;
  const call = async (method, p, body, token, headers) => {
    const h = { 'Content-Type': 'application/json', Origin: ORIGIN, 'CF-Connecting-IP': '10.0.0.' + ((n++ % 200) + 1), ...headers };
    if (token) h.Authorization = 'Bearer ' + token;
    const res = await worker.fetch(new Request('https://sync.example' + p, { method, headers: h, body: body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)) }), env);
    return { status: res.status, body: await res.json().catch(() => null), headers: res.headers };
  };
  return { env, call, db: env.DB.raw };
}

// Clé d'accès posée directement en base (le premier compte n'a pas d'administrateur pour en créer une).
function seedKey(s, code, over = {}) {
  const row = { id: crypto.randomBytes(16).toString('hex'), label: 'test', plan: 'free', entitlements: '[]', trial_days: null, created_at: Date.now(), expires_at: null, max_uses: 1, uses: 0, revoked_at: null, ...over };
  s.db.prepare('INSERT INTO invites (id, code_hash, label, plan, entitlements, trial_days, created_at, expires_at, max_uses, uses, revoked_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
    .run(row.id, keyHash(code), row.label, row.plan, row.entitlements, row.trial_days, row.created_at, row.expires_at, row.max_uses, row.uses, row.revoked_at);
  return row.id;
}
const reg = (username, key, extra) => ({ username, password: PW, key, acceptTerms: true, age16: true, termsVersion: '2026-11', ...extra });
async function register(s, username = 'maxime', key = 'KEY-' + username, extra) {
  if (!s.db.prepare('SELECT 1 FROM invites WHERE code_hash = ?').get(keyHash(key))) seedKey(s, key);
  const r = await s.call('POST', '/api/register', reg(username, key, extra));
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return r.body;
}
async function admin(s) {
  const r = await register(s, 'chef');
  s.db.prepare("UPDATE users SET role = 'admin' WHERE username = 'chef'").run();
  return r.token;
}

// ---------- inscription ----------
test('inscription : clé individuelle à usage unique, conditions et âge exigés, réponse avec le profil', async () => {
  const s = setup(); seedKey(s, 'LZ-AAAAA-BBBBB');
  assert.equal((await s.call('POST', '/api/register', reg('maxime', 'FAUSSE'))).status, 403);
  assert.equal((await s.call('POST', '/api/register', { ...reg('maxime', 'LZ-AAAAA-BBBBB'), acceptTerms: false })).status, 400);
  assert.equal((await s.call('POST', '/api/register', { ...reg('maxime', 'LZ-AAAAA-BBBBB'), age16: undefined })).status, 400);
  assert.equal((await s.call('POST', '/api/register', { ...reg('maxime', 'LZ-AAAAA-BBBBB'), termsVersion: undefined })).status, 400);
  const ok = await s.call('POST', '/api/register', reg(' Maxime ', ' lz-aaaaa-bbbbb ')); // casse et espaces tolérés
  assert.equal(ok.status, 201); assert.equal(ok.body.username, 'maxime'); assert.match(ok.body.token, /^[0-9a-f]{64}$/);
  assert.match(ok.body.me.id, /^[0-9a-f]{32}$/); assert.equal(ok.body.me.role, 'user'); assert.equal(ok.body.me.analyticsConsent, null); assert.equal(ok.body.me.termsVersion, '2026-11');
  assert.equal((await s.call('POST', '/api/register', reg('autre', 'LZ-AAAAA-BBBBB'))).status, 403); // déjà utilisée
});

test('inscription : identifiant pris → la clé n’est pas consommée ; clé révoquée ou expirée refusée', async () => {
  const s = setup(); await register(s, 'maxime');
  seedKey(s, 'K2');
  assert.equal((await s.call('POST', '/api/register', reg('maxime', 'K2'))).status, 409);
  assert.equal(s.db.prepare('SELECT uses FROM invites WHERE code_hash = ?').get(keyHash('K2')).uses, 0);
  assert.equal((await s.call('POST', '/api/register', reg('nouveau', 'K2'))).status, 201);
  seedKey(s, 'REV', { revoked_at: Date.now() }); seedKey(s, 'EXP', { expires_at: Date.now() - 1000 });
  assert.equal((await s.call('POST', '/api/register', reg('user1', 'REV'))).status, 403);
  assert.equal((await s.call('POST', '/api/register', reg('user2', 'EXP'))).status, 403);
});

test('inscription : identifiant et mot de passe valides exigés', async () => {
  const s = setup();
  for (const [u, p] of [['ab', PW], ['Max Blanchard', PW], ['maxime!', PW], ['maxime', 'court'], ['maxime', 'x'.repeat(129)]]) {
    seedKey(s, 'K' + u + p.length);
    assert.equal((await s.call('POST', '/api/register', { ...reg(u, 'K' + u + p.length), password: p })).status, 400, `${u} / ${p.length}`);
  }
});

test('la clé accorde formule, modules et essai ; clé à plusieurs usages', async () => {
  const s = setup(); const now = Date.now();
  seedKey(s, 'BETA', { plan: 'free', entitlements: '["course"]', trial_days: 14, max_uses: 2 });
  const a = await s.call('POST', '/api/register', reg('lea', 'BETA'));
  assert.deepEqual(a.body.me.entitlements, ['course', 'premium']); // l'essai ouvre la formule premium
  assert.ok(a.body.me.trialEndsAt > now + 13 * DAY && a.body.me.trialEndsAt < now + 15 * DAY);
  assert.equal((await s.call('POST', '/api/register', reg('paul', 'BETA'))).status, 201);
  assert.equal((await s.call('POST', '/api/register', reg('zoe', 'BETA'))).status, 403);
});

test('consentement aux statistiques : enregistré à l’inscription avec date et version, modifiable ensuite', async () => {
  const s = setup();
  const yes = await register(s, 'oui', undefined, { analytics: true, consentVersion: 'c1' });
  const no = await register(s, 'non', undefined, { analytics: false, consentVersion: 'c1' });
  assert.equal(yes.me.analyticsConsent, true); assert.equal(no.me.analyticsConsent, false); assert.equal(yes.me.consentVersion, 'c1');
  assert.ok(s.db.prepare("SELECT consent_at FROM users WHERE username = 'oui'").get().consent_at);
  const r = await s.call('POST', '/api/consent', { analytics: true, version: 'c2' }, no.token);
  assert.equal(r.body.me.analyticsConsent, true); assert.equal(r.body.me.consentVersion, 'c2');
  assert.equal((await s.call('POST', '/api/consent', { analytics: 'oui', version: 'c2' }, no.token)).status, 400);
});

test('l’adresse IP n’est jamais stockée : seules des empreintes salées', async () => {
  const s = setup(); await register(s);
  await s.call('POST', '/api/login', { username: 'maxime', password: PW }, undefined, { 'CF-Connecting-IP': '203.0.113.7' });
  const keys = s.db.prepare('SELECT key FROM rate_limits').all().map(r => r.key);
  assert.ok(keys.length >= 2);
  for (const k of keys) { assert.ok(!k.includes('203.0.113.7')); assert.match(k, /^(reg|login):[0-9a-f]{32}$/); }
});

// ---------- connexion ----------
test('connexion : erreur identique pour mauvais mot de passe et compte inconnu ; verrouillage après 5 échecs', async () => {
  const s = setup(); await register(s);
  const bad = await s.call('POST', '/api/login', { username: 'maxime', password: 'mauvais-mot-de-passe' });
  const unknown = await s.call('POST', '/api/login', { username: 'personne', password: PW });
  assert.equal(bad.status, 401); assert.deepEqual(bad.body, unknown.body);
  for (let i = 0; i < 3; i++) await s.call('POST', '/api/login', { username: 'maxime', password: 'mauvais-mot-de-passe' });
  assert.equal((await s.call('POST', '/api/login', { username: 'maxime', password: 'mauvais-mot-de-passe' })).status, 429);
  assert.equal((await s.call('POST', '/api/login', { username: 'maxime', password: PW })).status, 429);
  s.db.prepare('UPDATE users SET locked_until = 1').run();
  const ok = await s.call('POST', '/api/login', { username: 'MAXIME', password: PW });
  assert.equal(ok.status, 200); assert.equal(ok.body.me.username, 'maxime');
});

test('limite par adresse : trop de connexions en dix minutes', async () => {
  const s = setup(); await register(s);
  let last;
  for (let i = 0; i < 31; i++) last = await s.call('POST', '/api/login', { username: 'inconnu' + i, password: PW }, undefined, { 'CF-Connecting-IP': '1.2.3.4' });
  assert.equal(last.status, 429);
});

test('compte suspendu : connexion et jeton refusés', async () => {
  const s = setup(); const t = (await register(s)).token;
  s.db.prepare("UPDATE users SET status = 'suspended'").run();
  assert.equal((await s.call('GET', '/api/me', undefined, t)).status, 403);
  assert.equal((await s.call('POST', '/api/login', { username: 'maxime', password: PW })).status, 403);
});

test('jetons stockés hachés ; déconnexion ; expiration ; 10 sessions au maximum', async () => {
  const s = setup(); const t = (await register(s)).token;
  const stored = s.db.prepare('SELECT token_hash FROM sessions').all();
  assert.equal(stored.length, 1); assert.notEqual(stored[0].token_hash, t);
  await s.call('POST', '/api/logout', {}, t);
  assert.equal((await s.call('GET', '/api/me', undefined, t)).status, 401);
  const t2 = (await s.call('POST', '/api/login', { username: 'maxime', password: PW })).body.token;
  s.db.prepare('UPDATE sessions SET expires_at = 1').run();
  assert.equal((await s.call('GET', '/api/me', undefined, t2)).status, 401);
  for (let i = 0; i < 14; i++) await s.call('POST', '/api/login', { username: 'maxime', password: PW });
  assert.ok(s.db.prepare('SELECT COUNT(*) AS n FROM sessions').get().n <= 10);
});

test('changement de mot de passe et suppression de compte', async () => {
  const s = setup(); const t1 = (await register(s, 'maxime', undefined, { analytics: true, consentVersion: 'c1' })).token;
  const t2 = (await s.call('POST', '/api/login', { username: 'maxime', password: PW })).body.token;
  assert.equal((await s.call('POST', '/api/password', { oldPassword: 'faux-faux-faux', newPassword: 'nouveau-mot-de-passe' }, t1)).status, 401);
  assert.equal((await s.call('POST', '/api/password', { oldPassword: PW, newPassword: 'nouveau-mot-de-passe' }, t1)).status, 200);
  assert.equal((await s.call('GET', '/api/me', undefined, t1)).status, 200); assert.equal((await s.call('GET', '/api/me', undefined, t2)).status, 401);
  await s.call('POST', '/api/events', { events: [{ name: 'app_open' }] }, t1);
  await s.call('POST', '/api/sync', { data: { vocabProgress: {} } }, t1);
  assert.equal((await s.call('DELETE', '/api/account', { password: PW }, t1)).status, 401);
  assert.equal((await s.call('DELETE', '/api/account', { password: 'nouveau-mot-de-passe' }, t1)).status, 200);
  for (const table of ['users', 'sessions', 'user_data', 'events']) assert.equal(s.db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n, 0, table);
});

// ---------- synchronisation ----------
test('synchronisation : le serveur fusionne, renvoie le résultat ; deux appareils convergent', async () => {
  const s = setup(); const t = (await register(s)).token;
  const bureau = { vocabProgress: { v1: { box: 3, dueAt: 5, updatedAt: 100 } }, xpState: { enduranceXP: 50 } };
  const maison = { vocabProgress: { v2: { box: 2, dueAt: 9, updatedAt: 200 }, v1: { box: 1, dueAt: 1, updatedAt: 50 } }, xpState: { enduranceXP: 10 } };
  const r1 = await s.call('POST', '/api/sync', { data: bureau }, t);
  assert.equal(r1.status, 200); assert.equal(r1.body.rev, 1);
  const r2 = await s.call('POST', '/api/sync', { data: maison }, t);
  assert.equal(r2.body.rev, 2); assert.deepEqual(Object.keys(r2.body.data.vocabProgress).sort(), ['v1', 'v2']);
  assert.equal(r2.body.data.vocabProgress.v1.box, 3); assert.equal(r2.body.data.xpState.enduranceXP, 50);
  const exp = await s.call('GET', '/api/data', undefined, t);
  assert.equal(exp.body.rev, 2); assert.deepEqual(exp.body.data, r2.body.data);
});

test('synchronisation : forme invalide, trop volumineuse, sans jeton ; chaque compte voit ses données', async () => {
  const s = setup(); const t1 = (await register(s, 'maxime')).token; const t2 = (await register(s, 'autre')).token;
  assert.equal((await s.call('POST', '/api/sync', { data: [] }, t1)).status, 400);
  assert.equal((await s.call('POST', '/api/sync', '{pas du json', t1)).status, 400);
  assert.equal((await s.call('POST', '/api/sync', { data: { vocabProgress: {}, courseProgress: { x: 'y'.repeat(1_600_000) } } }, t1)).status, 413);
  assert.equal((await s.call('POST', '/api/sync', { data: { vocabProgress: {} } })).status, 401);
  await s.call('POST', '/api/sync', { data: { vocabProgress: { v1: { box: 5, dueAt: 1 } } } }, t1);
  assert.equal((await s.call('GET', '/api/data', undefined, t2)).body.data, null);
});

test('ancienne version de l’app : PUT /api/data avec numéro de version toujours accepté', async () => {
  const s = setup(); const t = (await register(s)).token;
  const D = n => ({ vocabProgress: { v1: { box: n, dueAt: 1 } } });
  assert.equal((await s.call('PUT', '/api/data', { expectedRev: 0, data: D(2) }, t)).body.rev, 1);
  const stale = await s.call('PUT', '/api/data', { expectedRev: 0, data: D(3) }, t);
  assert.equal(stale.status, 409); assert.equal(stale.body.rev, 1);
});

// ---------- événements d'usage ----------
test('événements : rien n’est stocké sans consentement ; avec consentement, seuls les événements valides', async () => {
  const s = setup();
  const sans = (await register(s, 'sans')).token; const avec = (await register(s, 'avec', undefined, { analytics: true, consentVersion: 'c1' })).token;
  assert.equal((await s.call('POST', '/api/events', { events: [{ name: 'app_open' }] }, sans)).body.stored, 0);
  const r = await s.call('POST', '/api/events', { events: [
    { name: 'app_open', props: { v: '1.29.0' } }, { name: 'screen', props: { name: 'vocab' } },
    { name: 'inconnu' }, { name: 'screen', props: { name: 'x<script>' } }, { name: 'screen', props: { 'MAUVAISE CLÉ': 1 } },
    { name: 'session_end', props: { kind: 'vocab', seconds: 120, answered: 10, correct: 8, wrong: ['v1', 'v2'] } },
    { name: 'session_end', props: { wrong: ['<bad>'] } }, 42, null,
  ] }, avec);
  assert.equal(r.body.stored, 4);
  const rows = s.db.prepare('SELECT name, props FROM events').all();
  assert.equal(rows.length, 4); assert.ok(rows.every(x => !x.props.includes('<')));
  assert.equal(s.db.prepare('SELECT COUNT(*) AS n FROM events WHERE user_id = (SELECT id FROM users WHERE username = ?)').get('sans').n, 0);
});

test('événements : lots limités, horodatage borné, retrait du consentement = effacement', async () => {
  const s = setup(); const t = (await register(s, 'maxime', undefined, { analytics: true, consentVersion: 'c1' })).token;
  assert.equal((await s.call('POST', '/api/events', { events: Array.from({ length: 51 }, () => ({ name: 'app_open' })) }, t)).status, 400);
  assert.equal((await s.call('POST', '/api/events', { events: [] }, t)).status, 400);
  const now = Date.now();
  await s.call('POST', '/api/events', { events: [{ name: 'app_open', ts: 1 }, { name: 'app_open', ts: now + 10 * DAY }] }, t);
  for (const { ts } of s.db.prepare('SELECT ts FROM events').all()) assert.ok(ts >= now - DAY - 1000 && ts <= now + 301000);
  await s.call('POST', '/api/consent', { analytics: false, version: 'c2' }, t);
  assert.equal(s.db.prepare('SELECT COUNT(*) AS n FROM events').get().n, 0);
  assert.equal((await s.call('POST', '/api/events', { events: [{ name: 'app_open' }] }, t)).body.stored, 0);
});

// ---------- administration ----------
test('administration : réservée au rôle admin', async () => {
  const s = setup(); const user = (await register(s, 'simple')).token;
  for (const [m, p] of [['GET', '/api/admin/overview'], ['GET', '/api/admin/users'], ['GET', '/api/admin/invites'], ['GET', '/api/admin/stats'], ['POST', '/api/admin/invites']]) {
    assert.equal((await s.call(m, p, m === 'POST' ? { label: 'x' } : undefined, user)).status, 403, p);
    assert.equal((await s.call(m, p, m === 'POST' ? { label: 'x' } : undefined)).status, 401, p);
  }
});

test('administration : créer une clé (montrée une seule fois), l’utiliser, voir son statut, la révoquer', async () => {
  const s = setup(); const t = await admin(s);
  const made = await s.call('POST', '/api/admin/invites', { label: 'Sophie, collègue', entitlements: ['course'], trialDays: 7, expiresInDays: 30 }, t);
  assert.equal(made.status, 201); assert.match(made.body.code, /^LZ-[A-HJ-NP-Z2-9]{5}-[A-HJ-NP-Z2-9]{5}$/);
  const row = s.db.prepare('SELECT * FROM invites WHERE id = ?').get(made.body.id);
  assert.equal(row.code_hash, keyHash(made.body.code)); assert.ok(!JSON.stringify(row).includes(made.body.code));
  const list = await s.call('GET', '/api/admin/invites', undefined, t);
  assert.ok(!JSON.stringify(list.body).includes(made.body.code));
  assert.equal(list.body.invites.find(i => i.id === made.body.id).status, 'open');
  const sophie = await s.call('POST', '/api/register', reg('sophie', made.body.code));
  assert.equal(sophie.status, 201); assert.deepEqual(sophie.body.me.entitlements, ['course', 'premium']);
  assert.equal((await s.call('GET', '/api/admin/invites', undefined, t)).body.invites.find(i => i.id === made.body.id).status, 'used');
  const second = (await s.call('POST', '/api/admin/invites', { label: 'à révoquer' }, t)).body;
  assert.equal((await s.call('POST', `/api/admin/invites/${second.id}/revoke`, {}, t)).status, 200);
  assert.equal((await s.call('POST', '/api/register', reg('paul', second.code))).status, 403);
  assert.equal((await s.call('POST', `/api/admin/invites/${second.id}/revoke`, {}, t)).status, 404);
  const users = await s.call('GET', '/api/admin/users', undefined, t);
  assert.equal(users.body.users.find(u => u.username === 'sophie').inviteLabel, 'Sophie, collègue');
  assert.ok(!JSON.stringify(users.body).includes('"hash"') && !JSON.stringify(users.body).includes('salt'));
});

test('administration : données de création de clé validées', async () => {
  const s = setup(); const t = await admin(s);
  for (const bad of [{}, { label: '' }, { label: 'x', plan: 'gratuit' }, { label: 'x', entitlements: ['Mauvais Nom'] }, { label: 'x', trialDays: 0 }, { label: 'x', trialDays: 'sept' }, { label: 'x', maxUses: 0 }, { label: 'x', expiresInDays: -1 }]) {
    assert.equal((await s.call('POST', '/api/admin/invites', bad, t)).status, 400, JSON.stringify(bad));
  }
});

test('administration : suspendre, rétablir, formule, essai, modules, suppression ; pas sur soi-même', async () => {
  const s = setup(); const t = await admin(s); const u = await register(s, 'lea');
  const post = (action, extra) => s.call('POST', `/api/admin/users/${u.me.id}`, { action, ...extra }, t);
  assert.equal((await post('suspend')).status, 200);
  const refused = await s.call('GET', '/api/me', undefined, u.token);
  assert.equal(refused.status, 403); assert.equal(refused.body.error, 'Compte suspendu.');
  assert.equal((await s.call('POST', '/api/login', { username: 'lea', password: PW })).status, 403);
  assert.equal((await post('unsuspend')).status, 200);
  assert.equal((await s.call('GET', '/api/me', undefined, u.token)).status, 200); // rétabli : l'ancien jeton refonctionne
  const t2 = (await s.call('POST', '/api/login', { username: 'lea', password: PW })).body.token;
  assert.equal((await post('set-plan', { plan: 'premium', expiresInDays: 30 })).status, 200);
  assert.deepEqual((await s.call('GET', '/api/me', undefined, t2)).body.me.entitlements, ['premium']);
  s.db.prepare('UPDATE users SET plan_expires_at = ? WHERE username = ?').run(Date.now() - 1000, 'lea'); // formule expirée
  assert.deepEqual((await s.call('GET', '/api/me', undefined, t2)).body.me.entitlements, []);
  assert.equal((await post('extend-trial', { days: 5 })).status, 200);
  assert.deepEqual((await s.call('GET', '/api/me', undefined, t2)).body.me.entitlements, ['premium']);
  assert.equal((await post('set-entitlements', { entitlements: ['course', 'beta'] })).status, 200);
  assert.deepEqual((await s.call('GET', '/api/me', undefined, t2)).body.me.entitlements, ['beta', 'course', 'premium']);
  assert.equal((await post('set-plan', { plan: 'gold' })).status, 400); assert.equal((await post('autre')).status, 400); assert.equal((await post('extend-trial', { days: 0 })).status, 400);
  const me = (await s.call('GET', '/api/me', undefined, t)).body.me;
  for (const a of ['suspend', 'delete']) assert.equal((await s.call('POST', `/api/admin/users/${me.id}`, { action: a }, t)).status, 400);
  assert.equal((await post('delete')).status, 200);
  assert.equal(s.db.prepare("SELECT COUNT(*) AS n FROM users WHERE username = 'lea'").get().n, 0);
  assert.equal((await s.call('POST', `/api/admin/users/${'0'.repeat(32)}`, { action: 'suspend' }, t)).status, 404);
  assert.ok(s.db.prepare('SELECT COUNT(*) AS n FROM admin_log').get().n >= 6);
});

test('administration : aperçu et statistiques agrégées', async () => {
  const s = setup(); const t = await admin(s);
  const a = await register(s, 'ana', undefined, { analytics: true, consentVersion: 'c1' });
  const b = await register(s, 'ben', undefined, { analytics: true, consentVersion: 'c1' });
  await register(s, 'cat', undefined, { analytics: false, consentVersion: 'c1' });
  await register(s, 'dan');
  const old = Date.now() - 10 * DAY;
  s.db.prepare("UPDATE users SET created_at = ? WHERE username IN ('ana','ben')").run(old);
  const ev = (token, events) => s.call('POST', '/api/events', { events }, token);
  await ev(a.token, [{ name: 'app_open' }, { name: 'screen', props: { name: 'vocab' } }, { name: 'screen', props: { name: 'course' } },
    { name: 'session_end', props: { kind: 'vocab', seconds: 100, answered: 10, correct: 7, wrong: ['v1', 'v2', 'v3'] } }, { name: 'onboarding_done' }]);
  await ev(b.token, [{ name: 'app_open' }, { name: 'screen', props: { name: 'vocab' } },
    { name: 'session_end', props: { kind: 'vocab', seconds: 200, answered: 10, correct: 5, wrong: ['v1', 'v2'] } }, { name: 'error', props: { msg: 'boom' } }]);
  s.db.prepare("UPDATE events SET ts = ? WHERE user_id = ? AND name = 'app_open'").run(old + 2 * DAY, b.me.id); // ben est revenu 2 jours après son inscription
  const ov = (await s.call('GET', '/api/admin/overview', undefined, t)).body;
  assert.deepEqual([ov.users, ov.consentYes, ov.consentNo, ov.consentUnknown], [5, 2, 1, 2]); // chef + dan : pas encore demandé
  assert.ok(ov.activeDay >= 5);
  const st = (await s.call('GET', '/api/admin/stats?days=30', undefined, t)).body;
  assert.equal(st.screens.find(x => x.name === 'vocab').n, 2); assert.equal(st.screens.find(x => x.name === 'vocab').users, 2);
  assert.equal(st.sessions[0].kind, 'vocab'); assert.equal(st.sessions[0].n, 2); assert.equal(st.sessions[0].avg_seconds, 150); assert.equal(st.sessions[0].answered, 20); assert.equal(st.sessions[0].correct, 12);
  assert.deepEqual(st.hardest.slice(0, 2).map(h => [h.card, h.misses]), [['v1', 2], ['v2', 2]]);
  assert.equal(st.errors[0].msg, 'boom'); assert.equal(st.onboarding, 1);
  assert.equal(st.retention.d1.eligible, 2); assert.equal(st.retention.d1.returned, 2); // ana : app_open le jour même après J+1 ? voir ci-dessous
  assert.equal(st.retention.d7.eligible, 2); assert.equal(st.retention.d7.returned, 1);
  assert.equal(st.retention.d30.eligible, 0);
  assert.ok(st.daily.length >= 1);
});

// ---------- divers ----------
test('CORS : origine du site autorisée, autre origine refusée, préflight', async () => {
  const s = setup();
  const ok = await s.call('GET', '/api/health');
  assert.equal(ok.headers.get('access-control-allow-origin'), ORIGIN); assert.equal(ok.body.version, 2);
  const bad = await s.call('GET', '/api/health', undefined, undefined, { Origin: 'https://evil.example' });
  assert.equal(bad.status, 403); assert.equal(bad.headers.get('access-control-allow-origin'), null);
  const pre = await worker.fetch(new Request('https://sync.example/api/me', { method: 'OPTIONS', headers: { Origin: ORIGIN } }), s.env);
  assert.equal(pre.status, 204); assert.match(pre.headers.get('access-control-allow-headers'), /Authorization/);
  assert.equal((await setup({ ALLOWED_ORIGINS: 'https://autre.example' }).call('GET', '/api/health')).status, 403);
});

test('route inconnue : 404 ; aucune fuite d’erreur interne', async () => {
  const s = setup(); const t = (await register(s)).token;
  assert.equal((await s.call('GET', '/api/nope', undefined, t)).status, 404);
  const err = await worker.fetch(new Request('https://sync.example/api/login', { method: 'POST', body: '{}' }), {});
  assert.equal(err.status, 500); assert.deepEqual(await err.json(), { error: 'Erreur du serveur.' });
});

test('le fichier à coller dans Cloudflare est à jour avec sa source', async () => {
  const { buildWorker } = await import('../tools/build-worker.mjs');
  assert.equal(fs.readFileSync(path.join(__dirname, '..', 'worker', 'worker.mjs'), 'utf8'), buildWorker());
});

// ---------- migration de la base version 1 ----------
test('migration v1 → v2 : compte, sessions et progression conservés ; premier compte administrateur ; IP effacées', async () => {
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(':memory:');
  db.exec(fs.readFileSync(path.join(__dirname, 'fixtures', 'schema-v1.sql'), 'utf8'));
  db.prepare('INSERT INTO users (username, salt, hash, iterations, created_at) VALUES (?,?,?,?,?)').run('maxime', 'c2FsdA==', 'aGFzaA==', 100000, 1000);
  db.prepare('INSERT INTO users (username, salt, hash, iterations, created_at) VALUES (?,?,?,?,?)').run('autre', 'c2FsdA==', 'aGFzaA==', 100000, 2000);
  const token = 'a'.repeat(64);
  db.prepare('INSERT INTO sessions (token_hash, username, created_at, expires_at) VALUES (?,?,?,?)').run(sha(token), 'maxime', 1, Date.now() + DAY);
  db.prepare('INSERT INTO user_data (username, rev, json, updated_at) VALUES (?,?,?,?)').run('maxime', 7, '{"vocabProgress":{"v1":{"box":2,"dueAt":1}}}', 5);
  db.prepare('INSERT INTO rate_limits (key, count, reset_at) VALUES (?,?,?)').run('login:203.0.113.7', 1, Date.now() + DAY);
  db.exec(fs.readFileSync(path.join(__dirname, '..', 'worker', 'migrations', '002_comptes_v2.sql'), 'utf8'));

  const users = db.prepare('SELECT * FROM users ORDER BY created_at').all();
  assert.deepEqual(users.map(u => [u.username, u.role, u.entitlements, u.status, u.plan]), [['maxime', 'admin', '["course"]', 'active', 'free'], ['autre', 'user', '["course"]', 'active', 'free']]);
  assert.match(users[0].id, /^[0-9a-f]{32}$/); assert.notEqual(users[0].id, users[1].id);
  assert.equal(db.prepare('SELECT user_id FROM sessions').get().user_id, users[0].id);
  const data = db.prepare('SELECT * FROM user_data').get(); assert.equal(data.user_id, users[0].id); assert.equal(data.rev, 7);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM rate_limits').get().n, 0);

  // le même schéma qu'une installation neuve
  const fresh = new DatabaseSync(':memory:'); fresh.exec(fs.readFileSync(path.join(__dirname, '..', 'worker', 'schema.sql'), 'utf8'));
  for (const table of ['users', 'sessions', 'user_data', 'invites', 'events', 'admin_log', 'rate_limits']) {
    const cols = d => d.prepare(`PRAGMA table_info(${table})`).all().map(c => [c.name, c.type, c.notnull, c.dflt_value, c.pk]);
    assert.deepEqual(cols(db), cols(fresh), table);
  }
  // l'ancien jeton fonctionne toujours avec le nouveau serveur
  const env = { DB: { raw: db, prepare: sql => { const st = (args) => ({ bind: (...a) => st(a), first: async () => db.prepare(sql).get(...args) || null, run: async () => ({ meta: { changes: Number(db.prepare(sql).run(...args).changes) } }), all: async () => ({ results: db.prepare(sql).all(...args) }) }); return st([]); }, batch: async () => [] } };
  const res = await worker.fetch(new Request('https://sync.example/api/me', { headers: { Authorization: 'Bearer ' + token } }), env);
  assert.equal(res.status, 200); const me = (await res.json()).me; assert.equal(me.username, 'maxime'); assert.equal(me.role, 'admin'); assert.deepEqual(me.entitlements, ['course']);
});

test('fichiers SQL sans commentaire : le texte collé sur une seule ligne dans la console D1 reste exécutable', () => {
  for (const f of ['worker/schema.sql', 'worker/migrations/002_comptes_v2.sql']) {
    const sql = fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
    assert.ok(!sql.includes('--') && !sql.includes('/*'), f);
    const { DatabaseSync } = require('node:sqlite');
    const db = new DatabaseSync(':memory:');
    if (f.includes('migrations')) db.exec(fs.readFileSync(path.join(__dirname, 'fixtures', 'schema-v1.sql'), 'utf8'));
    db.exec(sql.replace(/\s*\n\s*/g, ' ')); // collé sur une seule ligne
  }
});
