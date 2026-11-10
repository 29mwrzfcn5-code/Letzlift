/*
 * Serveur LetzLift — Cloudflare Worker + base D1. SOURCE : ne se colle pas tel quel dans Cloudflare.
 * Le fichier à coller est worker/worker.mjs, produit par `node tools/build-worker.mjs` (il embarque
 * la bibliothèque de fusion js/lib/sync-merge.js).
 *
 * Le serveur gère les comptes (clés d'invitation individuelles), les sessions, la synchronisation
 * (avec fusion côté serveur), le consentement aux statistiques, les événements d'usage, les droits
 * d'accès (formule, essai, modules) et une administration réservée aux comptes de rôle « admin ».
 *
 * Routes (JSON) — publiques : GET /api/health, POST /api/register, POST /api/login, POST /api/recover.
 * Connecté : GET /api/me, POST /api/sync, GET /api/data (export), POST /api/consent, POST /api/events,
 *   POST /api/password, POST /api/recovery-code, POST /api/logout, DELETE /api/account.
 * Obsolète, conservée pour l'ancienne version de l'app : PUT /api/data.
 * Admin : GET /api/admin/overview|users|invites|stats, POST /api/admin/invites,
 *   POST /api/admin/invites/:id/revoke, POST /api/admin/users/:id (dont l'action new-recovery : nouveau code de récupération).
 *
 * Récupération du mot de passe sans e-mail : un code personnel « LZR-XXXXX-XXXXX-XXXXX » est donné à l'inscription (une seule
 * fois) ; seule son empreinte est stockée. Il permet de choisir un nouveau mot de passe, puis il est remplacé par un nouveau code.
 *
 * Configuration : liaison D1 « DB » (obligatoire) ; variable facultative ALLOWED_ORIGINS (origines
 * autorisées, séparées par des virgules) ; secret facultatif RATE_SALT (sel des empreintes d'adresses IP).
 */

const DEFAULT_ORIGINS = ['https://29mwrzfcn5-code.github.io'];
const PBKDF2_ITERATIONS = 100000;           // maximum accepté par Workers pour PBKDF2
const SESSION_DAYS = 90;
const MAX_SESSIONS_PER_USER = 10;
const MAX_BODY_BYTES = 1_500_000;           // sous la limite de ligne de D1 (2 Mo)
const MAX_FAILURES = 5;
const LOCK_MS = 15 * 60 * 1000;
const DAY = 86400000;
const EVENT_RETENTION_DAYS = 400;
const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{2,31}$/;
const MIN_PASSWORD = 10;
const MAX_PASSWORD = 128;
const GENERIC_AUTH_ERROR = 'Identifiant ou mot de passe incorrect.';
const PLANS = ['free', 'premium'];
const PLAN_ENTITLEMENTS = { free: [], premium: ['premium'] };
const ENTITLEMENT_RE = /^[a-z0-9_-]{1,24}$/;
const KEY_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sans 0, O, 1, I
const EVENT_NAMES = ['app_open', 'screen', 'session_end', 'onboarding_done', 'error'];
const MAX_EVENTS_PER_BATCH = 50;
const RECOVERY_ERROR = 'Identifiant ou code de récupération incorrect.';

const enc = new TextEncoder();

// ---------- utilitaires ----------
function b64(bytes) { let s = ''; bytes.forEach(b => { s += String.fromCharCode(b); }); return btoa(s); }
function unb64(str) { return Uint8Array.from(atob(str), c => c.charCodeAt(0)); }
function hex(bytes) { return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join(''); }
function newId() { return hex(crypto.getRandomValues(new Uint8Array(16))); }

async function pbkdf2(password, salt, iterations) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256));
}
async function sha256Hex(text) { return hex(new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(text)))); }

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

function allowedOrigins(env) {
  return env.ALLOWED_ORIGINS ? String(env.ALLOWED_ORIGINS).split(',').map(s => s.trim()).filter(Boolean) : DEFAULT_ORIGINS;
}
function corsHeaders(request, env) {
  const origin = request.headers.get('Origin');
  const h = { 'Vary': 'Origin' };
  if (origin && allowedOrigins(env).includes(origin)) {
    h['Access-Control-Allow-Origin'] = origin;
    h['Access-Control-Allow-Methods'] = 'GET, PUT, POST, DELETE, OPTIONS';
    h['Access-Control-Allow-Headers'] = 'Authorization, Content-Type';
    h['Access-Control-Max-Age'] = '86400';
  }
  return h;
}
function json(request, env, status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...corsHeaders(request, env) },
  });
}
function fail(status, message, extra) { const e = new Error(message); e.status = status; e.extra = extra; return e; }

async function readJson(request) {
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) throw fail(413, 'Données trop volumineuses.');
  try {
    const v = JSON.parse(text);
    if (v === null || typeof v !== 'object' || Array.isArray(v)) throw new Error('x');
    return v;
  } catch (_) { throw fail(400, 'Requête invalide.'); }
}

// Limite à fenêtre fixe, par empreinte salée de l'adresse IP (l'adresse n'est jamais stockée).
async function clientKey(request, env) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  return (await sha256Hex((env.RATE_SALT || 'letzlift-rate') + ':' + ip)).slice(0, 32);
}
async function rateLimit(env, key, limit, windowMs, now) {
  const row = await env.DB.prepare('SELECT count, reset_at FROM rate_limits WHERE key = ?').bind(key).first();
  if (!row || row.reset_at <= now) {
    await env.DB.prepare('INSERT OR REPLACE INTO rate_limits (key, count, reset_at) VALUES (?, 1, ?)').bind(key, now + windowMs).run();
    return true;
  }
  if (row.count >= limit) return false;
  await env.DB.prepare('UPDATE rate_limits SET count = count + 1 WHERE key = ?').bind(key).run();
  return true;
}

// ---------- comptes, droits d'accès ----------
function parseList(text) { try { const v = JSON.parse(text); return Array.isArray(v) ? v.filter(x => typeof x === 'string') : []; } catch (_) { return []; } }

// Droits effectifs : modules attribués + droits de la formule en cours + droits de l'essai en cours.
function effectiveEntitlements(user, now) {
  const set = new Set(parseList(user.entitlements));
  const planActive = user.plan !== 'free' && (user.plan_expires_at == null || user.plan_expires_at > now);
  if (planActive) (PLAN_ENTITLEMENTS[user.plan] || []).forEach(e => set.add(e));
  if (user.trial_ends_at != null && user.trial_ends_at > now) PLAN_ENTITLEMENTS.premium.forEach(e => set.add(e));
  return [...set].sort();
}
function meOf(user, now) {
  return {
    id: user.id, username: user.username, email: user.email || null, role: user.role, createdAt: user.created_at,
    plan: user.plan, planExpiresAt: user.plan_expires_at ?? null, trialEndsAt: user.trial_ends_at ?? null,
    entitlements: effectiveEntitlements(user, now),
    analyticsConsent: user.analytics_consent == null ? null : user.analytics_consent === 1,
    consentVersion: user.consent_version || null, termsVersion: user.terms_version || null,
    hasRecovery: !!user.recovery_hash,
  };
}

async function newSession(env, userId, now) {
  const token = hex(crypto.getRandomValues(new Uint8Array(32)));
  await env.DB.prepare('DELETE FROM sessions WHERE expires_at <= ?').bind(now).run();
  await env.DB.prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .bind(await sha256Hex(token), userId, now, now + SESSION_DAYS * DAY).run();
  await env.DB.prepare('DELETE FROM sessions WHERE user_id = ? AND token_hash NOT IN (SELECT token_hash FROM sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT ?)')
    .bind(userId, userId, MAX_SESSIONS_PER_USER).run();
  return token;
}

async function authenticate(request, env, now) {
  const m = /^Bearer ([0-9a-f]{64})$/.exec(request.headers.get('Authorization') || '');
  if (!m) return null;
  const tokenHash = await sha256Hex(m[1]);
  const user = await env.DB.prepare('SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?').bind(tokenHash, now).first();
  if (!user) return null;
  if (user.status !== 'active') throw fail(403, 'Compte suspendu.');
  if (!user.last_seen_at || now - user.last_seen_at > 3600000) {
    await env.DB.prepare('UPDATE users SET last_seen_at = ? WHERE id = ?').bind(now, user.id).run();
  }
  return { user, tokenHash };
}

// Vérifie un mot de passe en temps à peu près constant, que le compte existe ou non ; gère le verrouillage.
async function checkPassword(env, username, password, now) {
  const user = await env.DB.prepare('SELECT * FROM users WHERE username = ?').bind(username).first();
  const salt = user ? unb64(user.salt) : new Uint8Array(16);
  const derived = await pbkdf2(password, salt, user ? user.iterations : PBKDF2_ITERATIONS);
  if (!user) return { ok: false, locked: false, user: null };
  if (user.locked_until > now) return { ok: false, locked: true, user };
  const ok = timingSafeEqual(derived, unb64(user.hash));
  if (ok) {
    if (user.fail_count) await env.DB.prepare('UPDATE users SET fail_count = 0, locked_until = 0 WHERE id = ?').bind(user.id).run();
    return { ok: true, locked: false, user };
  }
  const fails = user.fail_count + 1;
  if (fails >= MAX_FAILURES) await env.DB.prepare('UPDATE users SET fail_count = 0, locked_until = ? WHERE id = ?').bind(now + LOCK_MS, user.id).run();
  else await env.DB.prepare('UPDATE users SET fail_count = ? WHERE id = ?').bind(fails, user.id).run();
  return { ok: false, locked: fails >= MAX_FAILURES, user };
}

function validCredentials(username, password) {
  if (typeof username !== 'string' || !USERNAME_RE.test(username)) return 'Identifiant : 3 à 32 caractères (lettres minuscules, chiffres, point, tiret, tiret bas).';
  if (typeof password !== 'string' || password.length < MIN_PASSWORD) return `Mot de passe : au moins ${MIN_PASSWORD} caractères.`;
  if (password.length > MAX_PASSWORD) return `Mot de passe : ${MAX_PASSWORD} caractères au maximum.`;
  return null;
}
function str(v, max) { return typeof v === 'string' && v.length > 0 && v.length <= max ? v : null; }
function cleanEntitlements(list) {
  if (!Array.isArray(list)) return null;
  const out = [...new Set(list)];
  if (out.length > 10 || !out.every(e => typeof e === 'string' && ENTITLEMENT_RE.test(e))) return null;
  return out.sort();
}
function normalizeKey(k) { return String(k || '').trim().toUpperCase().replace(/\s+/g, ''); }
function makeKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  const chars = Array.from(bytes, b => KEY_ALPHABET[b % KEY_ALPHABET.length]).join('');
  return `LZ-${chars.slice(0, 5)}-${chars.slice(5)}`;
}

// Code de récupération : 15 caractères d'un alphabet de 32 (75 bits), stocké sous forme d'empreinte liée au compte.
function makeRecoveryCode() {
  const chars = Array.from(crypto.getRandomValues(new Uint8Array(15)), b => KEY_ALPHABET[b % KEY_ALPHABET.length]).join('');
  return `LZR-${chars.slice(0, 5)}-${chars.slice(5, 10)}-${chars.slice(10)}`;
}
async function recoveryHash(userId, code) { return sha256Hex('rec:' + userId + ':' + normalizeKey(code)); }
async function issueRecoveryCode(env, userId, now) {
  const code = makeRecoveryCode();
  await env.DB.prepare('UPDATE users SET recovery_hash = ?, recovery_at = ? WHERE id = ?').bind(await recoveryHash(userId, code), now, userId).run();
  return code;
}

// ---------- données de progression ----------
function validData(data) {
  return data && typeof data === 'object' && !Array.isArray(data) && typeof data.vocabProgress === 'object' && data.vocabProgress !== null && !Array.isArray(data.vocabProgress);
}

async function syncData(env, userId, incoming, now) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const row = await env.DB.prepare('SELECT rev, json FROM user_data WHERE user_id = ?').bind(userId).first();
    const stored = row ? JSON.parse(row.json) : null;
    const merged = stored ? LetzSyncMerge.mergeData(incoming, stored) : incoming;
    const text = JSON.stringify(merged);
    if (text.length > MAX_BODY_BYTES) throw fail(413, 'Données trop volumineuses.');
    const res = row
      ? await env.DB.prepare('UPDATE user_data SET rev = rev + 1, json = ?, updated_at = ? WHERE user_id = ? AND rev = ?').bind(text, now, userId, row.rev).run()
      : await env.DB.prepare('INSERT OR IGNORE INTO user_data (user_id, rev, json, updated_at) VALUES (?, 1, ?, ?)').bind(userId, text, now).run();
    if (res.meta && res.meta.changes > 0) return { rev: (row ? row.rev : 0) + 1, data: merged };
  }
  throw fail(409, 'Un autre appareil synchronise en même temps : réessaie dans un instant.');
}

// ---------- événements d'usage ----------
function cleanProps(name, props) {
  if (props === undefined) return {};
  if (!props || typeof props !== 'object' || Array.isArray(props)) return null;
  const out = {};
  const keys = Object.keys(props);
  if (keys.length > 8) return null;
  for (const k of keys) {
    const v = props[k];
    if (!/^[a-z_]{1,16}$/.test(k)) return null;
    if (k === 'wrong') {
      if (!Array.isArray(v) || v.length > 20 || !v.every(x => typeof x === 'string' && /^[A-Za-z0-9:_-]{1,60}$/.test(x))) return null;
      out[k] = v;
    } else if (typeof v === 'number') {
      if (!isFinite(v)) return null;
      out[k] = Math.round(v);
    } else if (typeof v === 'string') {
      out[k] = v.replace(/[\u0000-\u001f<>]/g, '').slice(0, name === 'error' ? 120 : 40);
    } else if (typeof v === 'boolean') out[k] = v;
    else return null;
  }
  return out;
}

async function storeEvents(env, user, body, now) {
  if (user.analytics_consent !== 1) return { stored: 0, reason: 'no-consent' };
  if (!Array.isArray(body.events) || body.events.length === 0 || body.events.length > MAX_EVENTS_PER_BATCH) throw fail(400, 'Requête invalide.');
  const rows = [];
  for (const ev of body.events) {
    if (!ev || typeof ev.name !== 'string' || !EVENT_NAMES.includes(ev.name)) continue;
    const props = cleanProps(ev.name, ev.props);
    if (props === null) continue;
    let ts = Number.isFinite(ev.ts) ? ev.ts : now;
    ts = Math.min(Math.max(ts, now - DAY), now + 300000);
    rows.push(env.DB.prepare('INSERT INTO events (ts, user_id, name, props) VALUES (?, ?, ?, ?)').bind(ts, user.id, ev.name, JSON.stringify(props)));
  }
  if (rows.length) await env.DB.batch(rows);
  if (crypto.getRandomValues(new Uint8Array(1))[0] < 6) { // ~2 % des envois : purge des événements trop anciens
    await env.DB.prepare('DELETE FROM events WHERE ts < ?').bind(now - EVENT_RETENTION_DAYS * DAY).run();
  }
  return { stored: rows.length };
}

// ---------- administration ----------
async function logAdmin(env, admin, action, target, detail, now) {
  await env.DB.prepare('INSERT INTO admin_log (ts, admin_id, action, target, detail) VALUES (?, ?, ?, ?, ?)')
    .bind(now, admin.id, action, target || null, detail ? JSON.stringify(detail).slice(0, 500) : null).run();
}

async function countOf(env, sql, ...args) { const r = await env.DB.prepare(sql).bind(...args).first(); return r ? Object.values(r)[0] : 0; }

async function adminOverview(env, now) {
  return {
    users: await countOf(env, 'SELECT COUNT(*) FROM users'),
    suspended: await countOf(env, "SELECT COUNT(*) FROM users WHERE status = 'suspended'"),
    premium: await countOf(env, "SELECT COUNT(*) FROM users WHERE plan != 'free' AND (plan_expires_at IS NULL OR plan_expires_at > ?)", now),
    activeDay: await countOf(env, 'SELECT COUNT(*) FROM users WHERE last_seen_at > ?', now - DAY),
    activeWeek: await countOf(env, 'SELECT COUNT(*) FROM users WHERE last_seen_at > ?', now - 7 * DAY),
    activeMonth: await countOf(env, 'SELECT COUNT(*) FROM users WHERE last_seen_at > ?', now - 30 * DAY),
    consentYes: await countOf(env, 'SELECT COUNT(*) FROM users WHERE analytics_consent = 1'),
    consentNo: await countOf(env, 'SELECT COUNT(*) FROM users WHERE analytics_consent = 0'),
    consentUnknown: await countOf(env, 'SELECT COUNT(*) FROM users WHERE analytics_consent IS NULL'),
    invitesOpen: await countOf(env, 'SELECT COUNT(*) FROM invites WHERE revoked_at IS NULL AND uses < max_uses AND (expires_at IS NULL OR expires_at > ?)', now),
  };
}

async function adminStats(env, now, days) {
  const since = now - days * DAY;
  const all = async (sql, ...args) => (await env.DB.prepare(sql).bind(...args).all()).results || [];
  const retention = {};
  for (const d of [1, 7, 30]) {
    const eligible = await countOf(env, 'SELECT COUNT(*) FROM users WHERE analytics_consent = 1 AND created_at <= ?', now - d * DAY);
    const returned = await countOf(env, "SELECT COUNT(*) FROM users u WHERE u.analytics_consent = 1 AND u.created_at <= ? AND EXISTS (SELECT 1 FROM events e WHERE e.user_id = u.id AND e.name = 'app_open' AND e.ts >= u.created_at + ?)", now - d * DAY, d * DAY);
    retention['d' + d] = { eligible, returned };
  }
  return {
    days,
    note: 'Événements des seuls comptes ayant accepté les statistiques.',
    daily: await all("SELECT date(ts / 1000, 'unixepoch') AS day, COUNT(DISTINCT user_id) AS users, COUNT(*) AS opens FROM events WHERE name = 'app_open' AND ts >= ? GROUP BY day ORDER BY day", since),
    retention,
    screens: await all("SELECT json_extract(props, '$.name') AS name, COUNT(*) AS n, COUNT(DISTINCT user_id) AS users FROM events WHERE name = 'screen' AND ts >= ? GROUP BY json_extract(props, '$.name') ORDER BY n DESC, name LIMIT 20", since),
    sessions: await all("SELECT json_extract(props, '$.kind') AS kind, COUNT(*) AS n, ROUND(AVG(json_extract(props, '$.seconds'))) AS avg_seconds, SUM(json_extract(props, '$.answered')) AS answered, SUM(json_extract(props, '$.correct')) AS correct FROM events WHERE name = 'session_end' AND ts >= ? GROUP BY kind ORDER BY n DESC, kind", since),
    hardest: await all("SELECT j.value AS card, COUNT(*) AS misses, COUNT(DISTINCT e.user_id) AS users FROM events e, json_each(e.props, '$.wrong') j WHERE e.name = 'session_end' AND e.ts >= ? GROUP BY card ORDER BY misses DESC, card LIMIT 25", since),
    errors: await all("SELECT json_extract(props, '$.msg') AS msg, COUNT(*) AS n FROM events WHERE name = 'error' AND ts >= ? GROUP BY msg ORDER BY n DESC, msg LIMIT 10", since),
    onboarding: await countOf(env, "SELECT COUNT(*) FROM events WHERE name = 'onboarding_done' AND ts >= ?", since),
  };
}

function userRow(u, now) {
  return {
    id: u.id, username: u.username, email: u.email || null, role: u.role, status: u.status, createdAt: u.created_at, lastSeenAt: u.last_seen_at ?? null,
    plan: u.plan, planExpiresAt: u.plan_expires_at ?? null, trialEndsAt: u.trial_ends_at ?? null,
    entitlements: parseList(u.entitlements), analyticsConsent: u.analytics_consent == null ? null : u.analytics_consent === 1,
    inviteLabel: u.invite_label || null,
  };
}

async function handleAdmin(request, env, route, url, admin, now) {
  const me = admin.user;
  if (route === 'GET /api/admin/overview') return { body: await adminOverview(env, now) };
  if (route === 'GET /api/admin/stats') {
    const days = Math.min(Math.max(parseInt(url.searchParams.get('days') || '30', 10) || 30, 1), 365);
    return { body: await adminStats(env, now, days) };
  }
  if (route === 'GET /api/admin/users') {
    const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '50', 10) || 50, 1), 200);
    const offset = Math.max(parseInt(url.searchParams.get('offset') || '0', 10) || 0, 0);
    const q = (url.searchParams.get('q') || '').trim().toLowerCase().slice(0, 32).replace(/[%_]/g, '');
    const rows = (await env.DB.prepare("SELECT u.*, i.label AS invite_label FROM users u LEFT JOIN invites i ON i.id = u.invite_id WHERE (? = '' OR u.username LIKE ?) ORDER BY u.created_at DESC LIMIT ? OFFSET ?").bind(q, q + '%', limit, offset).all()).results || [];
    return { body: { users: rows.map(u => userRow(u, now)), limit, offset } };
  }
  if (route === 'GET /api/admin/invites') {
    const rows = (await env.DB.prepare('SELECT * FROM invites ORDER BY created_at DESC LIMIT 200').all()).results || [];
    return { body: { invites: rows.map(i => ({
      id: i.id, label: i.label, plan: i.plan, entitlements: parseList(i.entitlements), trialDays: i.trial_days ?? null, createdAt: i.created_at,
      expiresAt: i.expires_at ?? null, maxUses: i.max_uses, uses: i.uses, revokedAt: i.revoked_at ?? null,
      status: i.revoked_at ? 'revoked' : i.uses >= i.max_uses ? 'used' : (i.expires_at && i.expires_at <= now) ? 'expired' : 'open',
    })) } };
  }
  if (route === 'POST /api/admin/invites') {
    const b = await readJson(request);
    const label = str(typeof b.label === 'string' ? b.label.trim() : b.label, 60);
    const plan = b.plan === undefined ? 'free' : b.plan;
    const ents = b.entitlements === undefined ? [] : cleanEntitlements(b.entitlements);
    const trialDays = b.trialDays == null ? null : b.trialDays;
    const expiresIn = b.expiresInDays == null ? null : b.expiresInDays;
    const maxUses = b.maxUses === undefined ? 1 : b.maxUses;
    if (!label || !PLANS.includes(plan) || ents === null) throw fail(400, 'Requête invalide.');
    if (trialDays !== null && (!Number.isInteger(trialDays) || trialDays < 1 || trialDays > 365)) throw fail(400, 'Durée d’essai invalide.');
    if (expiresIn !== null && (!Number.isInteger(expiresIn) || expiresIn < 1 || expiresIn > 3650)) throw fail(400, 'Durée de validité invalide.');
    if (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > 1000) throw fail(400, 'Nombre d’utilisations invalide.');
    const code = makeKey();
    const id = newId();
    await env.DB.prepare('INSERT INTO invites (id, code_hash, label, plan, entitlements, trial_days, created_at, expires_at, max_uses, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(id, await sha256Hex(normalizeKey(code)), label, plan, JSON.stringify(ents), trialDays, now, expiresIn === null ? null : now + expiresIn * DAY, maxUses, me.id).run();
    await logAdmin(env, me, 'invite.create', id, { label, plan, ents, trialDays, maxUses }, now);
    return { status: 201, body: { id, code, label } }; // la clé n'est montrée qu'ici, une seule fois
  }
  let m = /^POST \/api\/admin\/invites\/([0-9a-f]{32})\/revoke$/.exec(route);
  if (m) {
    const res = await env.DB.prepare('UPDATE invites SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL').bind(now, m[1]).run();
    if (!res.meta || res.meta.changes === 0) throw fail(404, 'Clé introuvable ou déjà révoquée.');
    await logAdmin(env, me, 'invite.revoke', m[1], null, now);
    return { body: { ok: true } };
  }
  m = /^POST \/api\/admin\/users\/([0-9a-f]{32})$/.exec(route);
  if (m) {
    const target = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(m[1]).first();
    if (!target) throw fail(404, 'Compte introuvable.');
    const b = await readJson(request);
    const self = target.id === me.id;
    switch (b.action) {
      case 'suspend': case 'unsuspend': {
        if (self) throw fail(400, 'Tu ne peux pas suspendre ton propre compte.');
        // les sessions sont conservées : authenticate() refuse un compte suspendu (403) tant qu'il l'est
        await env.DB.prepare('UPDATE users SET status = ? WHERE id = ?').bind(b.action === 'suspend' ? 'suspended' : 'active', target.id).run();
        break;
      }
      case 'set-plan': {
        if (!PLANS.includes(b.plan)) throw fail(400, 'Formule invalide.');
        const exp = b.expiresInDays == null ? null : b.expiresInDays;
        if (exp !== null && (!Number.isInteger(exp) || exp < 1 || exp > 3650)) throw fail(400, 'Durée invalide.');
        await env.DB.prepare('UPDATE users SET plan = ?, plan_expires_at = ? WHERE id = ?').bind(b.plan, exp === null ? null : now + exp * DAY, target.id).run();
        break;
      }
      case 'extend-trial': {
        if (!Number.isInteger(b.days) || b.days < 1 || b.days > 365) throw fail(400, 'Durée invalide.');
        await env.DB.prepare('UPDATE users SET trial_ends_at = ? WHERE id = ?').bind(now + b.days * DAY, target.id).run();
        break;
      }
      case 'set-entitlements': {
        const ents = cleanEntitlements(b.entitlements);
        if (ents === null) throw fail(400, 'Droits invalides.');
        await env.DB.prepare('UPDATE users SET entitlements = ? WHERE id = ?').bind(JSON.stringify(ents), target.id).run();
        break;
      }
      case 'delete': {
        if (self) throw fail(400, 'Supprime ton propre compte depuis les Paramètres.');
        await eraseUser(env, target.id);
        break;
      }
      case 'new-recovery': {
        // Pour une personne qui a perdu son mot de passe ET son code : un nouveau code, à lui transmettre de vive voix ou par message.
        const recoveryCode = await issueRecoveryCode(env, target.id, now);
        await logAdmin(env, me, 'user.new-recovery', target.id, { username: target.username }, now);
        return { body: { ok: true, recoveryCode, username: target.username } };
      }
      default: throw fail(400, 'Action inconnue.');
    }
    await logAdmin(env, me, 'user.' + b.action, target.id, { username: target.username }, now);
    return { body: { ok: true } };
  }
  return null;
}

async function eraseUser(env, userId) {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM events WHERE user_id = ?').bind(userId),
    env.DB.prepare('DELETE FROM user_data WHERE user_id = ?').bind(userId),
    env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(userId),
    env.DB.prepare('DELETE FROM users WHERE id = ?').bind(userId),
  ]);
}

// ---------- routage ----------
async function handle(request, env, now) {
  const url = new URL(request.url);
  const route = `${request.method} ${url.pathname}`;
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request, env) });
  const origin = request.headers.get('Origin');
  if (origin && !allowedOrigins(env).includes(origin)) return json(request, env, 403, { error: 'Origine non autorisée.' });

  if (route === 'GET /api/health') return json(request, env, 200, { ok: true, version: 3 });

  if (route === 'POST /api/register') {
    const body = await readJson(request);
    if (!(await rateLimit(env, 'reg:' + await clientKey(request, env), 8, 3600000, now))) throw fail(429, 'Trop de tentatives. Réessaie plus tard.');
    const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : '';
    const problem = validCredentials(username, body.password);
    if (problem) throw fail(400, problem);
    if (body.acceptTerms !== true || body.age16 !== true) throw fail(400, 'Il faut accepter les conditions d’utilisation et confirmer avoir au moins 16 ans.');
    const termsVersion = str(body.termsVersion, 20);
    if (!termsVersion) throw fail(400, 'Requête invalide.');
    if (body.analytics !== undefined && typeof body.analytics !== 'boolean') throw fail(400, 'Requête invalide.');
    const invite = await env.DB.prepare('SELECT * FROM invites WHERE code_hash = ?').bind(await sha256Hex(normalizeKey(body.key))).first();
    const usable = invite && !invite.revoked_at && invite.uses < invite.max_uses && (!invite.expires_at || invite.expires_at > now);
    if (!usable) throw fail(403, 'Clé d’accès invalide, déjà utilisée ou expirée.');
    if (await env.DB.prepare('SELECT 1 AS x FROM users WHERE username = ?').bind(username).first()) throw fail(409, 'Cet identifiant existe déjà.');
    const consumed = await env.DB.prepare('UPDATE invites SET uses = uses + 1 WHERE id = ? AND revoked_at IS NULL AND uses < max_uses').bind(invite.id).run();
    if (!consumed.meta || consumed.meta.changes === 0) throw fail(403, 'Clé d’accès invalide, déjà utilisée ou expirée.');
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const hash = await pbkdf2(body.password, salt, PBKDF2_ITERATIONS);
    const id = newId();
    const recoveryCode = makeRecoveryCode();
    const consentVersion = body.analytics === undefined ? null : str(body.consentVersion, 20);
    const res = await env.DB.prepare('INSERT OR IGNORE INTO users (id, username, salt, hash, iterations, created_at, plan, entitlements, trial_ends_at, terms_version, terms_at, analytics_consent, consent_version, consent_at, invite_id, last_seen_at, recovery_hash, recovery_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(id, username, b64(salt), b64(hash), PBKDF2_ITERATIONS, now, invite.plan, invite.entitlements, invite.trial_days ? now + invite.trial_days * DAY : null,
        termsVersion, now, body.analytics === undefined ? null : (body.analytics ? 1 : 0), consentVersion, body.analytics === undefined ? null : now, invite.id, now,
        await recoveryHash(id, recoveryCode), now).run();
    if (!res.meta || res.meta.changes === 0) {
      await env.DB.prepare('UPDATE invites SET uses = uses - 1 WHERE id = ?').bind(invite.id).run(); // course perdue : on rend la clé
      throw fail(409, 'Cet identifiant existe déjà.');
    }
    const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
    return json(request, env, 201, { token: await newSession(env, id, now), username, me: meOf(user, now), recoveryCode }); // le code n'est montré qu'ici, une seule fois
  }

  if (route === 'POST /api/login') {
    const body = await readJson(request);
    if (!(await rateLimit(env, 'login:' + await clientKey(request, env), 30, 600000, now))) throw fail(429, 'Trop de tentatives. Réessaie plus tard.');
    const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password.slice(0, MAX_PASSWORD) : '';
    const r = await checkPassword(env, username, password, now);
    if (r.locked) throw fail(429, 'Compte verrouillé quelques minutes après trop d’essais.');
    if (!r.ok) throw fail(401, GENERIC_AUTH_ERROR);
    if (r.user.status !== 'active') throw fail(403, 'Compte suspendu.');
    await env.DB.prepare('UPDATE users SET last_seen_at = ? WHERE id = ?').bind(now, r.user.id).run();
    return json(request, env, 200, { token: await newSession(env, r.user.id, now), username, me: meOf(r.user, now) });
  }

  if (route === 'POST /api/recover') {
    const body = await readJson(request);
    if (!(await rateLimit(env, 'recip:' + await clientKey(request, env), 15, 3600000, now))) throw fail(429, 'Trop de tentatives. Réessaie plus tard.');
    const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : '';
    const problem = validCredentials(username, body.newPassword);
    if (problem) throw fail(400, problem);
    if (!(await rateLimit(env, 'recacct:' + username, 5, 900000, now))) throw fail(429, 'Trop d’essais pour ce compte : réessaie dans quelques minutes.');
    const target = await env.DB.prepare('SELECT * FROM users WHERE username = ?').bind(username).first();
    const given = await recoveryHash(target ? target.id : '-', typeof body.code === 'string' ? body.code.slice(0, 60) : '');
    const stored = target && target.recovery_hash ? target.recovery_hash : '0'.repeat(64);
    const ok = !!target && !!target.recovery_hash && timingSafeEqual(enc.encode(given), enc.encode(stored));
    if (!ok) throw fail(401, RECOVERY_ERROR);
    if (target.status !== 'active') throw fail(403, 'Compte suspendu.');
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const hash = await pbkdf2(body.newPassword, salt, PBKDF2_ITERATIONS);
    await env.DB.prepare('UPDATE users SET salt = ?, hash = ?, iterations = ?, fail_count = 0, locked_until = 0, last_seen_at = ? WHERE id = ?').bind(b64(salt), b64(hash), PBKDF2_ITERATIONS, now, target.id).run();
    await env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(target.id).run(); // tous les appareils doivent se reconnecter
    const recoveryCode = await issueRecoveryCode(env, target.id, now); // le code utilisé est consommé : on en remet un nouveau
    await env.DB.prepare('DELETE FROM rate_limits WHERE key = ?').bind('recacct:' + username).run();
    const fresh = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(target.id).first();
    return json(request, env, 200, { token: await newSession(env, target.id, now), username, me: meOf(fresh, now), recoveryCode });
  }

  const session = await authenticate(request, env, now);
  if (!session) throw fail(401, 'Session expirée : reconnecte-toi.');
  const user = session.user;

  if (route === 'GET /api/me') return json(request, env, 200, { me: meOf(user, now) });

  if (route === 'POST /api/sync') {
    const body = await readJson(request);
    if (!validData(body.data)) throw fail(400, 'Requête invalide.');
    return json(request, env, 200, await syncData(env, user.id, body.data, now));
  }

  if (route === 'GET /api/data') {
    const row = await env.DB.prepare('SELECT rev, json, updated_at FROM user_data WHERE user_id = ?').bind(user.id).first();
    if (!row) return json(request, env, 200, { rev: 0, data: null });
    return json(request, env, 200, { rev: row.rev, data: JSON.parse(row.json), updatedAt: row.updated_at });
  }

  if (route === 'PUT /api/data') { // obsolète : ancienne version de l'app, sans fusion côté serveur
    const body = await readJson(request);
    if (!Number.isInteger(body.expectedRev) || body.expectedRev < 0 || !validData(body.data)) throw fail(400, 'Requête invalide.');
    const text = JSON.stringify(body.data);
    if (text.length > MAX_BODY_BYTES) throw fail(413, 'Données trop volumineuses.');
    const current = await env.DB.prepare('SELECT rev FROM user_data WHERE user_id = ?').bind(user.id).first();
    const currentRev = current ? current.rev : 0;
    if (currentRev !== body.expectedRev) return json(request, env, 409, { error: 'Version dépassée.', rev: currentRev });
    const res = current
      ? await env.DB.prepare('UPDATE user_data SET rev = rev + 1, json = ?, updated_at = ? WHERE user_id = ? AND rev = ?').bind(text, now, user.id, currentRev).run()
      : await env.DB.prepare('INSERT OR IGNORE INTO user_data (user_id, rev, json, updated_at) VALUES (?, 1, ?, ?)').bind(user.id, text, now).run();
    if (!res.meta || res.meta.changes === 0) {
      const again = await env.DB.prepare('SELECT rev FROM user_data WHERE user_id = ?').bind(user.id).first();
      return json(request, env, 409, { error: 'Version dépassée.', rev: again ? again.rev : 0 });
    }
    return json(request, env, 200, { rev: currentRev + 1 });
  }

  if (route === 'POST /api/consent') {
    const body = await readJson(request);
    const version = str(body.version, 20);
    if (typeof body.analytics !== 'boolean' || !version) throw fail(400, 'Requête invalide.');
    await env.DB.prepare('UPDATE users SET analytics_consent = ?, consent_version = ?, consent_at = ? WHERE id = ?').bind(body.analytics ? 1 : 0, version, now, user.id).run();
    if (!body.analytics) await env.DB.prepare('DELETE FROM events WHERE user_id = ?').bind(user.id).run(); // retrait du consentement : on efface ce qui a été collecté
    const fresh = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(user.id).first();
    return json(request, env, 200, { me: meOf(fresh, now) });
  }

  if (route === 'POST /api/events') {
    const body = await readJson(request);
    return json(request, env, 200, await storeEvents(env, user, body, now));
  }

  if (route === 'POST /api/password') {
    const body = await readJson(request);
    const problem = validCredentials(user.username, body.newPassword);
    if (problem) throw fail(400, problem);
    const r = await checkPassword(env, user.username, typeof body.oldPassword === 'string' ? body.oldPassword.slice(0, MAX_PASSWORD) : '', now);
    if (r.locked) throw fail(429, 'Compte verrouillé quelques minutes après trop d’essais.');
    if (!r.ok) throw fail(401, 'Mot de passe actuel incorrect.');
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const hash = await pbkdf2(body.newPassword, salt, PBKDF2_ITERATIONS);
    await env.DB.prepare('UPDATE users SET salt = ?, hash = ?, iterations = ? WHERE id = ?').bind(b64(salt), b64(hash), PBKDF2_ITERATIONS, user.id).run();
    await env.DB.prepare('DELETE FROM sessions WHERE user_id = ? AND token_hash != ?').bind(user.id, session.tokenHash).run();
    return json(request, env, 200, { ok: true });
  }

  if (route === 'POST /api/recovery-code') {
    const body = await readJson(request);
    const r = await checkPassword(env, user.username, typeof body.password === 'string' ? body.password.slice(0, MAX_PASSWORD) : '', now);
    if (r.locked) throw fail(429, 'Compte verrouillé quelques minutes après trop d’essais.');
    if (!r.ok) throw fail(401, 'Mot de passe incorrect.');
    const recoveryCode = await issueRecoveryCode(env, user.id, now); // l'ancien code cesse de fonctionner
    const fresh = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(user.id).first();
    return json(request, env, 200, { recoveryCode, me: meOf(fresh, now) });
  }

  if (route === 'POST /api/logout') {
    await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(session.tokenHash).run();
    return json(request, env, 200, { ok: true });
  }

  if (route === 'DELETE /api/account') {
    const body = await readJson(request);
    const r = await checkPassword(env, user.username, typeof body.password === 'string' ? body.password.slice(0, MAX_PASSWORD) : '', now);
    if (r.locked) throw fail(429, 'Compte verrouillé quelques minutes après trop d’essais.');
    if (!r.ok) throw fail(401, 'Mot de passe incorrect.');
    await eraseUser(env, user.id);
    return json(request, env, 200, { ok: true });
  }

  if (url.pathname.startsWith('/api/admin/')) {
    if (user.role !== 'admin') throw fail(403, 'Accès réservé.');
    const out = await handleAdmin(request, env, route, url, session, now);
    if (out) return json(request, env, out.status || 200, out.body);
  }

  throw fail(404, 'Introuvable.');
}

export default {
  async fetch(request, env) {
    try {
      return await handle(request, env, Date.now());
    } catch (e) {
      if (e && e.status) return json(request, env, e.status, { error: e.message, ...(e.extra || {}) });
      return json(request, env, 500, { error: 'Erreur du serveur.' });
    }
  },
};
