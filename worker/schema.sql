-- Schéma D1 du serveur LetzLift, version 2 (installation neuve).
-- Base existante en version 1 : exécuter plutôt worker/migrations/002_comptes_v2.sql.
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,                       -- identifiant interne opaque (jamais le pseudonyme)
  username TEXT NOT NULL UNIQUE,
  email TEXT UNIQUE,                         -- facultatif, minuscules
  email_verified_at INTEGER,
  salt TEXT NOT NULL,
  hash TEXT NOT NULL,
  iterations INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  fail_count INTEGER NOT NULL DEFAULT 0,
  locked_until INTEGER NOT NULL DEFAULT 0,
  role TEXT NOT NULL DEFAULT 'user',         -- 'user' | 'admin'
  status TEXT NOT NULL DEFAULT 'active',     -- 'active' | 'suspended'
  plan TEXT NOT NULL DEFAULT 'free',         -- 'free' | 'premium'
  plan_expires_at INTEGER,
  trial_ends_at INTEGER,
  entitlements TEXT NOT NULL DEFAULT '[]',   -- liste JSON de modules débloqués (ex. ["course"])
  last_seen_at INTEGER,
  terms_version TEXT,
  terms_at INTEGER,
  analytics_consent INTEGER,                 -- NULL : pas encore demandé ; 1 : accepté ; 0 : refusé
  consent_version TEXT,
  consent_at INTEGER,
  invite_id TEXT
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions (user_id);
CREATE TABLE IF NOT EXISTS user_data (
  user_id TEXT PRIMARY KEY,
  rev INTEGER NOT NULL,
  json TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS invites (
  id TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL UNIQUE,            -- empreinte de la clé : la clé elle-même n'est jamais stockée
  label TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'free',
  entitlements TEXT NOT NULL DEFAULT '[]',
  trial_days INTEGER,
  created_at INTEGER NOT NULL,
  expires_at INTEGER,
  max_uses INTEGER NOT NULL DEFAULT 1,
  uses INTEGER NOT NULL DEFAULT 0,
  revoked_at INTEGER,
  created_by TEXT
);
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  props TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS events_ts ON events (ts);
CREATE INDEX IF NOT EXISTS events_name_ts ON events (name, ts);
CREATE INDEX IF NOT EXISTS events_user ON events (user_id);
CREATE TABLE IF NOT EXISTS admin_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  admin_id TEXT NOT NULL,
  action TEXT NOT NULL,
  target TEXT,
  detail TEXT
);
CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,                      -- empreinte salée de l'adresse IP, jamais l'adresse
  count INTEGER NOT NULL,
  reset_at INTEGER NOT NULL
);
