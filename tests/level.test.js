const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const L = require('../js/lib/level.js');
const N = require('../js/lib/nrule.js');

const root = path.join(__dirname, '..');
const load = f => { const c = {}; vm.createContext(c); vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8') + ';this.V = ' + (f.includes('a2') ? 'VOCAB_A2' : 'VOCAB'), c); return c.V; };
const A1 = load('data/vocab.js');
const A2 = load('data/vocab-a2.js');

test('mots A2 : ids uniques et distincts de l’A1, level A2, champs complets, un seul trou', () => {
  const ids = new Set(A1.map(v => v.id));
  for (const w of A2) {
    assert.ok(!ids.has(w.id), w.id); ids.add(w.id);
    assert.equal(w.level, 'A2');
    assert.ok(w.lu && w.fr && w.cat && w.sentence && w.sentenceFr, w.id);
    assert.equal((w.sentence.match(/___/g) || []).length, 1, w.lu);
    assert.ok(!w.g || ['m', 'f', 'n'].includes(w.g), w.lu);
  }
  assert.ok(A2.length >= 60);
});

test('aucun mot A2 n’est déjà dans le vocabulaire A1', () => {
  const lu = new Set(A1.map(v => v.lu.toLowerCase()));
  const dup = A2.filter(w => lu.has(w.lu.toLowerCase())).map(w => w.lu);
  assert.equal(dup.length, 0, dup.join(', '));
});

test('règle du n : le mot qui précède le trou dans les phrases A2', () => {
  const pairs = { en: 'e', den: 'de', mäin: 'mäi', hunn: 'hu', sinn: 'si', an: 'a', vun: 'vu' };
  const bad = [];
  for (const w of A2) {
    const t = w.sentence.split(/\s+/); const i = t.findIndex(x => x.includes('___'));
    if (i < 1) continue;
    const prev = t[i - 1].replace(/[.,!?]/g, '').toLowerCase();
    for (const [long, short] of Object.entries(pairs)) {
      if (prev !== long && prev !== short) continue;
      const wants = N.keepsN(w.lu) ? long : short;
      if (prev !== wants) bad.push(`${w.lu}: « ${t[i - 1]} » devant ${w.lu}`);
    }
  }
  assert.deepEqual(bad, []);
});

test('prêt pour l’A2 : 80 % des mots A1 vus et 50 % en boîte 3 ou plus', () => {
  const words = Array.from({ length: 10 }, (_, i) => ({ id: 'a' + i }));
  const mk = (seen, solid) => { const p = {}; for (let i = 0; i < seen; i++) p['a' + i] = { box: i < solid ? 3 : 1 }; return p; };
  assert.equal(L.a2Readiness(words, mk(8, 5)).ready, true);
  assert.equal(L.a2Readiness(words, mk(7, 5)).ready, false);
  assert.equal(L.a2Readiness(words, mk(8, 4)).ready, false);
  assert.equal(L.a2Readiness([], {}).ready, false);
  const r = L.a2Readiness(words, mk(8, 5));
  assert.deepEqual([r.total, r.seen, r.solid, r.seenPct, r.solidPct], [10, 8, 5, 80, 50]);
});

test('les mots A2 déjà ouverts ne comptent pas dans la préparation à l’A2', () => {
  const words = [{ id: 'a' }, { id: 'b', level: 'A2' }];
  const r = L.a2Readiness(words, { a: { box: 5 } });
  assert.equal(r.total, 1); assert.equal(r.ready, true);
  assert.equal(L.levelLabel(true), 'A1 + A2'); assert.equal(L.levelLabel(false), 'A1');
});

// ---------- ouverture de l'A2 dans l'application ----------
require('./helpers/tz.js');
const { loadApp, ev, sleep } = require('../tools/sandbox.js');
const { makeFakeDom } = require('./helpers/fakedom.js');
const NOW = Date.parse('2026-03-10T09:00:00Z');
const json = (ctx, expr) => JSON.parse(ev(ctx, `JSON.stringify(${expr})`));

async function boot(storage) {
  const app = loadApp({ now: NOW, storage });
  assert.deepEqual(app.errors, []);
  await sleep(30);
  const dom = makeFakeDom();
  app.ctx.document = dom;
  for (const id of ['hero-section', 'level-label', 'parametres-container', 'vocab-session-container']) dom.add(id);
  return app;
}

test('A2 fermé par défaut : VOCAB ne contient que l’A1', async () => {
  const { ctx } = await boot();
  assert.equal(json(ctx, 'VOCAB.some(v => v.level === "A2")'), false);
  assert.equal(json(ctx, 'userProfile.levelA2 === true'), false);
});

test('ouvrir puis refermer l’A2 : les mots entrent et sortent, la progression reste', async () => {
  const { ctx } = await boot();
  const base = json(ctx, 'VOCAB.length');
  const n = json(ctx, 'VOCAB_A2.length');
  ev(ctx, 'setLevelA2(true)');
  assert.equal(json(ctx, 'VOCAB.length'), base + n);
  ev(ctx, 'setLevelA2(true)'); // idempotent
  assert.equal(json(ctx, 'VOCAB.length'), base + n);
  assert.equal(json(ctx, 'userProfile.levelA2'), true);
  ev(ctx, "vocabProgress['v1001'] = { box: 2, dueAt: 1 }");
  ev(ctx, 'setLevelA2(false)');
  assert.equal(json(ctx, 'VOCAB.length'), base);
  assert.equal(json(ctx, "vocabProgress['v1001'].box"), 2);
  assert.equal(json(ctx, 'VOCAB.some(v => v.level === "A2")'), false);
});

test('un compte qui a ouvert l’A2 le retrouve au rechargement ; les mots A2 restent des mots d’origine', async () => {
  const a = await boot();
  ev(a.ctx, 'setLevelA2(true)');
  await sleep(30);
  const b = await boot(Object.fromEntries(a.ctx.__store));
  assert.equal(json(b.ctx, 'VOCAB.some(v => v.id === "v1001")'), true);
  assert.equal(json(b.ctx, 'vaIsCustomWord("v1001")'), false);
});

test('une sauvegarde avec de la progression A2 s’importe même si l’A2 est fermé', async () => {
  const { ctx } = await boot();
  ev(ctx, "vocabProgress['v1001'] = { box: 2, dueAt: 1 }");
  const payload = json(ctx, 'buildBackupPayload()');
  assert.doesNotThrow(() => ev(ctx, `validateBackupPayload(${JSON.stringify(payload)})`));
});
