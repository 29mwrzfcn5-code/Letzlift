/*
 * Serveur de synchronisation LetzLift — Cloudflare Worker + base D1. Un seul fichier, aucune dépendance.
 *
 * Le serveur ne comprend pas le contenu des données : il stocke, par compte, la dernière
 * sauvegarde JSON envoyée par l'app (la fusion entre appareils se fait dans l'app). Il gère les
 * comptes, les sessions et la protection contre les essais répétés.
 *
 * Routes (JSON) :
 *   GET    /api/health
 *   POST   /api/register   { username, password, invite }
 *   POST   /api/login      { username, password }          → { token }
 *   GET    /api/data       (Authorization: Bearer …)       → { rev, data }
 *   PUT    /api/data       { expectedRev, data }           → { rev } | 409 { rev }
 *   POST   /api/password   { oldPassword, newPassword }
 *   POST   /api/logout
 *   DELETE /api/account    { password }
 *
 * Configuration (Settings → Variables and Secrets) :
 *   DB               liaison D1 (obligatoire)
 *   INVITE_CODE      secret : code à fournir pour créer un compte (sans lui, l'inscription est fermée)
 *   ALLOWED_ORIGINS  origines autorisées, séparées par des virgules (défaut : le site GitHub Pages)
 */

const DEFAULT_ORIGINS = ['https://29mwrzfcn5-code.github.io'];
const PBKDF2_ITERATIONS = 100000;         // maximum accepté par Workers pour PBKDF2
const SESSION_DAYS = 90;
const MAX_SESSIONS_PER_USER = 10;
const MAX_BODY_BYTES = 1_500_000;          // sous la limite de ligne de D1 (2 Mo)
const MAX_FAILURES = 5;
const LOCK_MS = 15 * 60 * 1000;
const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{2,31}$/;
const MIN_PASSWORD = 10;
const MAX_PASSWORD = 128;
const GENERIC_AUTH_ERROR = 'Identifiant ou mot de passe incorrect.';

const enc = new TextEncoder();

function b64(bytes) { let s = ''; bytes.forEach(b => { s += String.fromCharCode(b); }); return btoa(s); }
function unb64(str) { return Uint8Array.from(atob(str), c => c.charCodeAt(0)); }
function hex(bytes) { return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join(''); }

async function pbkdf2(password, salt, iterations) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256));
}

async function sha256Hex(text) {
  return hex(new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(text))));
}

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

async function readJson(request) {
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) { const e = new Error('Données trop volumineuses.'); e.status = 413; throw e; }
  try {
    const v = JSON.parse(text);
    if (v === null || typeof v !== 'object' || Array.isArray(v)) throw new Error('x');
    return v;
  } catch (_) { const e = new Error('Requête invalide.'); e.status = 400; throw e; }
}

// Compteur à fenêtre fixe : renvoie false quand la limite est dépassée.
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

function clientKey(request) {
  return request.headers.get('CF-Connecting-IP') || 'unknown';
}

async function newSession(env, username, now) {
  const raw = crypto.getRandomValues(new Uint8Array(32));
  const token = hex(raw);
  const tokenHash = await sha256Hex(token);
  await env.DB.prepare('DELETE FROM sessions WHERE expires_at <= ?').bind(now).run();
  await env.DB.prepare('INSERT INTO sessions (token_hash, username, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .bind(tokenHash, username, now, now + SESSION_DAYS * 86400000).run();
  await env.DB.prepare('DELETE FROM sessions WHERE username = ? AND token_hash NOT IN (SELECT token_hash FROM sessions WHERE username = ? ORDER BY created_at DESC LIMIT ?)')
    .bind(username, username, MAX_SESSIONS_PER_USER).run();
  return token;
}

async function authenticate(request, env, now) {
  const m = /^Bearer ([0-9a-f]{64})$/.exec(request.headers.get('Authorization') || '');
  if (!m) return null;
  const row = await env.DB.prepare('SELECT username, expires_at FROM sessions WHERE token_hash = ?').bind(await sha256Hex(m[1])).first();
  if (!row || row.expires_at <= now) return null;
  return { username: row.username, tokenHash: await sha256Hex(m[1]) };
}

// Vérifie un mot de passe en temps à peu près constant, que le compte existe ou non ; gère le verrouillage.
async function checkPassword(env, username, password, now) {
  const user = await env.DB.prepare('SELECT salt, hash, iterations, fail_count, locked_until FROM users WHERE username = ?').bind(username).first();
  const salt = user ? unb64(user.salt) : new Uint8Array(16);
  const derived = await pbkdf2(password, salt, user ? user.iterations : PBKDF2_ITERATIONS);
  if (!user) return { ok: false, locked: false };
  if (user.locked_until > now) return { ok: false, locked: true };
  const ok = timingSafeEqual(derived, unb64(user.hash));
  if (ok) {
    if (user.fail_count) await env.DB.prepare('UPDATE users SET fail_count = 0, locked_until = 0 WHERE username = ?').bind(username).run();
    return { ok: true, locked: false };
  }
  const fails = user.fail_count + 1;
  if (fails >= MAX_FAILURES) await env.DB.prepare('UPDATE users SET fail_count = 0, locked_until = ? WHERE username = ?').bind(now + LOCK_MS, username).run();
  else await env.DB.prepare('UPDATE users SET fail_count = ? WHERE username = ?').bind(fails, username).run();
  return { ok: false, locked: fails >= MAX_FAILURES };
}

function validCredentials(username, password) {
  if (typeof username !== 'string' || !USERNAME_RE.test(username)) return 'Identifiant : 3 à 32 caractères (lettres minuscules, chiffres, point, tiret, tiret bas).';
  if (typeof password !== 'string' || password.length < MIN_PASSWORD) return `Mot de passe : au moins ${MIN_PASSWORD} caractères.`;
  if (password.length > MAX_PASSWORD) return `Mot de passe : ${MAX_PASSWORD} caractères au maximum.`;
  return null;
}

function validData(data) {
  return data && typeof data === 'object' && !Array.isArray(data) && typeof data.vocabProgress === 'object' && data.vocabProgress !== null;
}

async function handle(request, env, now) {
  const url = new URL(request.url);
  const route = `${request.method} ${url.pathname}`;
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request, env) });
  const origin = request.headers.get('Origin');
  if (origin && !allowedOrigins(env).includes(origin)) return json(request, env, 403, { error: 'Origine non autorisée.' });

  if (route === 'GET /api/health') return json(request, env, 200, { ok: true });

  if (route === 'POST /api/register') {
    if (!env.INVITE_CODE) return json(request, env, 403, { error: 'Les inscriptions sont fermées.' });
    const body = await readJson(request);
    if (!(await rateLimit(env, 'reg:' + clientKey(request), 5, 3600000, now))) return json(request, env, 429, { error: 'Trop de tentatives. Réessaie plus tard.' });
    const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : '';
    const problem = validCredentials(username, body.password);
    if (problem) return json(request, env, 400, { error: problem });
    const a = enc.encode(String(body.invite || '')), b = enc.encode(String(env.INVITE_CODE));
    const sa = await crypto.subtle.digest('SHA-256', a), sb = await crypto.subtle.digest('SHA-256', b);
    if (!timingSafeEqual(new Uint8Array(sa), new Uint8Array(sb))) return json(request, env, 403, { error: 'Code d’invitation incorrect.' });
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const hash = await pbkdf2(body.password, salt, PBKDF2_ITERATIONS);
    const res = await env.DB.prepare('INSERT OR IGNORE INTO users (username, salt, hash, iterations, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind(username, b64(salt), b64(hash), PBKDF2_ITERATIONS, now).run();
    if (!res.meta || res.meta.changes === 0) return json(request, env, 409, { error: 'Cet identifiant existe déjà.' });
    return json(request, env, 201, { token: await newSession(env, username, now), username });
  }

  if (route === 'POST /api/login') {
    const body = await readJson(request);
    if (!(await rateLimit(env, 'login:' + clientKey(request), 30, 600000, now))) return json(request, env, 429, { error: 'Trop de tentatives. Réessaie plus tard.' });
    const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password.slice(0, MAX_PASSWORD) : '';
    const r = await checkPassword(env, username, password, now);
    if (r.locked) return json(request, env, 429, { error: 'Compte verrouillé quelques minutes après trop d’essais.' });
    if (!r.ok) return json(request, env, 401, { error: GENERIC_AUTH_ERROR });
    return json(request, env, 200, { token: await newSession(env, username, now), username });
  }

  const session = await authenticate(request, env, now);
  if (!session) return json(request, env, 401, { error: 'Session expirée : reconnecte-toi.' });
  const username = session.username;

  if (route === 'GET /api/data') {
    const row = await env.DB.prepare('SELECT rev, json, updated_at FROM user_data WHERE username = ?').bind(username).first();
    if (!row) return json(request, env, 200, { rev: 0, data: null });
    return json(request, env, 200, { rev: row.rev, data: JSON.parse(row.json), updatedAt: row.updated_at });
  }

  if (route === 'PUT /api/data') {
    const body = await readJson(request);
    if (!Number.isInteger(body.expectedRev) || body.expectedRev < 0 || !validData(body.data)) return json(request, env, 400, { error: 'Requête invalide.' });
    const text = JSON.stringify(body.data);
    if (text.length > MAX_BODY_BYTES) return json(request, env, 413, { error: 'Données trop volumineuses.' });
    const current = await env.DB.prepare('SELECT rev FROM user_data WHERE username = ?').bind(username).first();
    const currentRev = current ? current.rev : 0;
    if (currentRev !== body.expectedRev) return json(request, env, 409, { error: 'Version dépassée.', rev: currentRev });
    // Mise à jour conditionnelle : si un autre appareil a écrit entre-temps, aucune ligne n'est touchée.
    const res = current
      ? await env.DB.prepare('UPDATE user_data SET rev = rev + 1, json = ?, updated_at = ? WHERE username = ? AND rev = ?').bind(text, now, username, currentRev).run()
      : await env.DB.prepare('INSERT OR IGNORE INTO user_data (username, rev, json, updated_at) VALUES (?, 1, ?, ?)').bind(username, text, now).run();
    if (!res.meta || res.meta.changes === 0) {
      const again = await env.DB.prepare('SELECT rev FROM user_data WHERE username = ?').bind(username).first();
      return json(request, env, 409, { error: 'Version dépassée.', rev: again ? again.rev : 0 });
    }
    return json(request, env, 200, { rev: currentRev + 1 });
  }

  if (route === 'POST /api/password') {
    const body = await readJson(request);
    const problem = validCredentials(username, body.newPassword);
    if (problem) return json(request, env, 400, { error: problem });
    const r = await checkPassword(env, username, typeof body.oldPassword === 'string' ? body.oldPassword.slice(0, MAX_PASSWORD) : '', now);
    if (r.locked) return json(request, env, 429, { error: 'Compte verrouillé quelques minutes après trop d’essais.' });
    if (!r.ok) return json(request, env, 401, { error: 'Mot de passe actuel incorrect.' });
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const hash = await pbkdf2(body.newPassword, salt, PBKDF2_ITERATIONS);
    await env.DB.prepare('UPDATE users SET salt = ?, hash = ?, iterations = ? WHERE username = ?').bind(b64(salt), b64(hash), PBKDF2_ITERATIONS, username).run();
    // Les autres appareils devront se reconnecter ; celui-ci garde sa session.
    await env.DB.prepare('DELETE FROM sessions WHERE username = ? AND token_hash != ?').bind(username, session.tokenHash).run();
    return json(request, env, 200, { ok: true });
  }

  if (route === 'POST /api/logout') {
    await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(session.tokenHash).run();
    return json(request, env, 200, { ok: true });
  }

  if (route === 'DELETE /api/account') {
    const body = await readJson(request);
    const r = await checkPassword(env, username, typeof body.password === 'string' ? body.password.slice(0, MAX_PASSWORD) : '', now);
    if (r.locked) return json(request, env, 429, { error: 'Compte verrouillé quelques minutes après trop d’essais.' });
    if (!r.ok) return json(request, env, 401, { error: 'Mot de passe incorrect.' });
    await env.DB.batch([
      env.DB.prepare('DELETE FROM user_data WHERE username = ?').bind(username),
      env.DB.prepare('DELETE FROM sessions WHERE username = ?').bind(username),
      env.DB.prepare('DELETE FROM users WHERE username = ?').bind(username),
    ]);
    return json(request, env, 200, { ok: true });
  }

  return json(request, env, 404, { error: 'Introuvable.' });
}

export default {
  async fetch(request, env) {
    try {
      return await handle(request, env, Date.now());
    } catch (e) {
      if (e && e.status) return json(request, env, e.status, { error: e.message });
      return json(request, env, 500, { error: 'Erreur du serveur.' });
    }
  },
};
