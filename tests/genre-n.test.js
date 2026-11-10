require('./helpers/tz.js');
const test = require('node:test');
const assert = require('node:assert/strict');
const G = require('../js/lib/genre-n.js');

const stull = { id: 'v100', lu: 'Stull', fr: 'chaise', g: 'm' };
const fra = { id: 'v101', lu: 'Fra', fr: 'femme', g: 'f' };
const haus = { id: 'v35', lu: 'Haus', fr: 'maison', g: 'n' };
const dësch = { id: 'v102', lu: 'Dësch', fr: 'table', g: 'm' };
const seq = (...v) => { let i = 0; return () => v[i++ % v.length]; };

test('en / e / eng : le genre décide eng, la lettre décide e ou en', () => {
  assert.equal(G.question(stull, 'indef').answer, 'e');
  assert.equal(G.question(dësch, 'indef').answer, 'en');
  assert.equal(G.question(haus, 'indef').answer, 'en');
  assert.equal(G.question(fra, 'indef').answer, 'eng');
});

test('négation : kee / keen / keng', () => {
  assert.equal(G.question(stull, 'neg').answer, 'kee');
  assert.equal(G.question(dësch, 'neg').answer, 'keen');
  assert.equal(G.question(fra, 'neg').answer, 'keng');
});

test('article défini : den / de pour le masculin, d\' pour le féminin et le neutre', () => {
  assert.equal(G.question(stull, 'def').answer, 'de');
  assert.equal(G.question(dësch, 'def').answer, 'den');
  assert.equal(G.question(fra, 'def').answer, "d'");
  assert.equal(G.question(haus, 'def').answer, "d'");
  assert.equal(G.question(haus, 'def').phrase, "d'Haus");
});

test('hunn / hu devant l\'article : Ech hu kee Bic, Ech hunn en Dësch', () => {
  const neg = G.question(stull, 'verb', seq(0.9, 0.1, 0.5, 0.2)); // 0.9 → négation
  assert.equal(neg.answer, 'hu kee');
  assert.equal(neg.phrase, 'Ech hu kee Stull.');
  const indef = G.question(dësch, 'verb', seq(0.1, 0.1));         // 0.1 → indéfini
  assert.equal(indef.answer, 'hunn en');
  assert.equal(indef.phrase, 'Ech hunn en Dësch.');
});

test('chaque question propose la bonne réponse parmi des choix distincts', () => {
  for (const item of [stull, fra, haus, dësch]) {
    for (const kind of G.kindsFor(item)) {
      for (let i = 0; i < 30; i++) {
        const q = G.question(item, kind);
        assert.ok(q.options.includes(q.answer), `${item.lu} ${kind}`);
        assert.equal(new Set(q.options).size, q.options.length);
        assert.ok(q.options.length >= 3);
      }
    }
  }
});

test('mots douteux ou sans genre : aucune question', () => {
  assert.deepEqual(G.kindsFor({ id: 'v147', lu: 'Buch', fr: 'livre', g: 'c' }), []);
  assert.deepEqual(G.kindsFor({ id: 'v255', lu: 'Post', fr: 'poste', g: 'f' }), []);
  assert.deepEqual(G.kindsFor({ id: 'v1', lu: 'Moien', fr: 'bonjour' }), []);
});

test('ancien code « c » : seulement en/e et kee/keen', () => {
  assert.deepEqual(G.kindsFor({ id: 'perso1', lu: 'Kuerf', fr: 'panier', g: 'c' }), ['indef', 'neg']);
  assert.equal(G.question({ id: 'perso1', lu: 'Kuerf', fr: 'panier', g: 'c' }, 'indef').answer, 'e');
});

test('erreurs classées : genre ou n', () => {
  const qi = G.question(stull, 'indef');                 // réponse : e
  assert.equal(G.classify(qi, 'e'), null);
  assert.equal(G.classify(qi, 'en'), 'n');               // bon genre, mauvais n
  assert.equal(G.classify(qi, 'eng'), 'genre');          // mauvais genre
  const qd = G.question(haus, 'def');                    // réponse : d'
  assert.equal(G.classify(qd, 'den'), 'genre');
  assert.equal(G.classify(qd, 'de'), 'genre');
  const qm = G.question(dësch, 'def');                   // réponse : den
  assert.equal(G.classify(qm, 'de'), 'n');
  assert.equal(G.classify(qm, "d'"), 'genre');
  const qv = G.question(stull, 'verb', seq(0.9, 0.1, 0.5, 0.2)); // hu kee
  assert.equal(G.classify(qv, 'hunn kee'), 'n');
  assert.equal(G.classify(qv, 'hu keng'), 'genre');
});

test('explications : genre, lettre et règle du n', () => {
  assert.match(G.why(G.question(stull, 'indef')), /masculin.*commence par S \(pas une lettre de UNITED ZOHA : le n tombe\).*e Stull/);
  assert.match(G.why(G.question(dësch, 'indef')), /commence par D \(une lettre de UNITED ZOHA : on garde le n\).*en Dësch/);
  assert.match(G.why(G.question(fra, 'indef')), /féminin prend eng.*eng Fra/);
  assert.match(G.why(G.question(haus, 'def')), /neutre prend d'.*d'Haus/);
  assert.match(G.why(G.question(stull, 'verb', seq(0.9, 0.1, 0.5, 0.2))), /« hunn » devient « hu »/);
});

// ---- données et application ----
const { loadApp, ev, sleep } = require('../tools/sandbox.js');
const json = (ctx, expr) => JSON.parse(ev(ctx, `JSON.stringify(${expr})`));

test('données : genres connus uniquement, mots douteux repérés', async () => {
  const app = loadApp({ now: Date.parse('2026-03-10T09:00:00Z') });
  assert.deepEqual(app.errors, []);
  await sleep(30);
  const vocab = json(app.ctx, 'VOCAB');
  assert.ok(vocab.every(v => v.g === undefined || ['m', 'f', 'n', 'c'].includes(v.g)));
  const by = g => vocab.filter(v => v.g === g).length;
  assert.ok(by('m') > 60 && by('n') > 20 && by('f') > 40, `m${by('m')} n${by('n')} f${by('f')}`);
  assert.equal(vocab.filter(v => v.g === 'c').length, 4); // A, Wand, Buch, Buedzëmmer : en attente de relecture
  for (const id of G.DOUBTFUL_IDS) assert.ok(vocab.some(v => v.id === id), id);
  const word = lu => vocab.find(v => v.lu === lu);
  assert.equal(word('Haus').g, 'n');
  assert.equal(word('Mamm').g, 'f');
  assert.equal(word('Papp').g, 'm');
});

test('suivi : le n et le genre sont comptés séparément', async () => {
  const app = loadApp({ now: Date.parse('2026-03-10T09:00:00Z') });
  await sleep(30);
  const c = app.ctx;
  ev(c, `globalThis.q1 = LetzGenre.question({id:'x1', lu:'Stull', fr:'chaise', g:'m'}, 'indef', () => 0.5)`);
  // bonne réponse : genre ok et n ok
  ev(c, `recordRuleResult(q1, q1.answer)`);
  // mauvais genre (eng) : une erreur de genre
  ev(c, `recordRuleResult(q1, 'eng')`);
  // bon genre, mauvais n (en) : une erreur de n
  ev(c, `recordRuleResult(q1, 'en')`);
  const s = json(c, 'ruleStatsSummary()');
  assert.deepEqual([s.genre.ok, s.genre.ko, s.n.ok, s.n.ko], [2, 1, 1, 1]);
  assert.equal(s.genre.pct, 67);
  assert.equal(s.n.pct, 50);
});

test('suivi : féminin indéfini ne teste pas le n', async () => {
  const app = loadApp({ now: Date.parse('2026-03-10T09:00:00Z') });
  await sleep(30);
  ev(app.ctx, `globalThis.q2 = LetzGenre.question({id:'x2', lu:'Fra', fr:'femme', g:'f'}, 'indef', () => 0.5); recordRuleResult(q2, q2.answer)`);
  const s = json(app.ctx, 'ruleStatsSummary()');
  assert.deepEqual([s.genre.ok, s.n.total], [1, 0]);
});

test('jeu « Le bon article » : le chrono ne compte pas la lecture de la correction', async () => {
  const app = loadApp({ now: Date.parse('2026-03-10T09:00:00Z') });
  await sleep(30);
  const c = app.ctx;
  ev(c, `artStartTime = 1000; artPausedMs = 500; artAnswerAt = 0; globalThis.__now = Date.now; Date.now = () => 11000;`);
  assert.equal(ev(c, 'artElapsedMs()'), 9500);          // 10 000 − 500 de lecture déjà passée
  ev(c, 'artAnswerAt = 9000');                           // une correction est affichée depuis 2 000 ms
  assert.equal(ev(c, 'artElapsedMs()'), 7500);           // le chrono est figé à l'instant de la réponse
  ev(c, 'Date.now = globalThis.__now');
});
