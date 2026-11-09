// Mini-D1 pour les tests : l'interface de Cloudflare D1 (prepare/bind/first/run/all/batch) sur node:sqlite.
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

class Statement {
  constructor(db, sql, args) { this.db = db; this.sql = sql; this.args = args || []; }
  bind(...args) { return new Statement(this.db, this.sql, args); }
  async first() { return this.db.prepare(this.sql).get(...this.args) || null; }
  async run() { const r = this.db.prepare(this.sql).run(...this.args); return { success: true, meta: { changes: Number(r.changes) } }; }
  async all() { return { results: this.db.prepare(this.sql).all(...this.args) }; }
}

function makeD1() {
  const db = new DatabaseSync(':memory:');
  db.exec(fs.readFileSync(path.join(__dirname, '..', '..', 'worker', 'schema.sql'), 'utf8'));
  return {
    raw: db,
    prepare: sql => new Statement(db, sql),
    batch: async stmts => { const out = []; for (const s of stmts) out.push(await s.run()); return out; },
  };
}
module.exports = { makeD1 };
