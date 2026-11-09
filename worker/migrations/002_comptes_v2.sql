CREATE TABLE users_v2 (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  email TEXT UNIQUE,
  email_verified_at INTEGER,
  salt TEXT NOT NULL,
  hash TEXT NOT NULL,
  iterations INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  fail_count INTEGER NOT NULL DEFAULT 0,
  locked_until INTEGER NOT NULL DEFAULT 0,
  role TEXT NOT NULL DEFAULT 'user',
  status TEXT NOT NULL DEFAULT 'active',
  plan TEXT NOT NULL DEFAULT 'free',
  plan_expires_at INTEGER,
  trial_ends_at INTEGER,
  entitlements TEXT NOT NULL DEFAULT '[]',
  last_seen_at INTEGER,
  terms_version TEXT,
  terms_at INTEGER,
  analytics_consent INTEGER,
  consent_version TEXT,
  consent_at INTEGER,
  invite_id TEXT
);
INSERT INTO users_v2 (id, username, salt, hash, iterations, created_at, fail_count, locked_until, role, entitlements)
  SELECT lower(hex(randomblob(16))), username, salt, hash, iterations, created_at, fail_count, locked_until,
         CASE WHEN created_at = (SELECT MIN(created_at) FROM users) THEN 'admin' ELSE 'user' END,
         '["course"]'
  FROM users;
CREATE TABLE sessions_v2 (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
INSERT INTO sessions_v2 (token_hash, user_id, created_at, expires_at)
  SELECT s.token_hash, u.id, s.created_at, s.expires_at FROM sessions s JOIN users_v2 u ON u.username = s.username;
CREATE TABLE user_data_v2 (
  user_id TEXT PRIMARY KEY,
  rev INTEGER NOT NULL,
  json TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
INSERT INTO user_data_v2 (user_id, rev, json, updated_at)
  SELECT u.id, d.rev, d.json, d.updated_at FROM user_data d JOIN users_v2 u ON u.username = d.username;
DROP TABLE sessions;
DROP TABLE user_data;
DROP TABLE users;
ALTER TABLE users_v2 RENAME TO users;
ALTER TABLE sessions_v2 RENAME TO sessions;
ALTER TABLE user_data_v2 RENAME TO user_data;
CREATE INDEX sessions_user ON sessions (user_id);
DELETE FROM rate_limits;
CREATE TABLE IF NOT EXISTS invites (
  id TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL UNIQUE,
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
