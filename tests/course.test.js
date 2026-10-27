const test = require('node:test');
const assert = require('node:assert/strict');
const N = require('../js/lib/nrule.js');
const C = require('../js/lib/course.js');
const { loadRawLessons, loadVocab } = require('./helpers/course-data.js');

const raw = loadRawLessons();
const course = C.buildCourse(raw);
const vocab = loadVocab();
const apos = s => String(s).replace(/[’‘]/g, "'");

// ---------- cohérence des données avec le moteur de la règle du n ----------

test('les leçons sont numérotées dans l’ordre, datées, avec un titre et un résumé', () => {
  assert.ok(raw.length >= 5);
  raw.forEach((l, i) => {
    assert.equal(l.n, i + 1);
    assert.match(l.date, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(l.id, 'l' + String(l.n).padStart(2, '0'));
    assert.ok(l.title && l.summary);
    if (i) assert.ok(l.date > raw[i - 1].date, 'les dates croissent');
  });
});

test('ids de cartes uniques (buildCourse lève une erreur sinon) et nombre de cartes par type', () => {
  const kinds = {};
  course.cards.forEach(c => { kinds[c.kind] = (kinds[c.kind] || 0) + 1; });
  assert.ok(kinds.word >= 60 && kinds.phrase >= 150 && kinds.letter === 32 && kinds.number >= 45 && kinds.color >= 12 && kinds.pair === 18, JSON.stringify(kinds));
});

test('chaque élément a sa traduction française, et les mots reliés au vocabulaire général existent', () => {
  const ids = new Set(vocab.map(v => v.id));
  for (const L of course.lessons) {
    for (const w of L.words) { assert.ok(w.fr && w.fr.trim(), `${L.id} ${w.lu}`); if (w.ref) assert.ok(ids.has(w.ref), `${w.lu} → ${w.ref}`); }
    for (const p of L.phrases) assert.ok(p.fr && p.fr.trim(), `${L.id} ${p.lu}`);
    for (const c of L.colors) assert.match(c.hex, /^[0-9A-Fa-f]{6}$/);
  }
});

test('genre des mots : seulement m, f, n, pl ou aucun', () => {
  for (const c of course.cards.filter(x => x.kind === 'word')) assert.ok([null, 'm', 'f', 'n', 'pl'].includes(c.g), c.lu);
});

test('articles des phrases : chaque « article + nom du cours » suit le genre et la règle du n', () => {
  const nouns = {};
  for (const c of course.cards.filter(x => x.kind === 'word' && ['m', 'f', 'n'].includes(x.g))) nouns[c.lu] = c.g;
  const articleForms = (g, noun) => new Set([N.nounPhrase('indef', g, noun), N.nounPhrase('neg', g, noun), N.nounPhrase('def', g, noun)].map(s => s.split(/ |'/)[0]));
  const bad = [];
  for (const c of course.cards.filter(x => x.kind === 'phrase')) {
    const tokens = apos(c.lu).replace(/[.,!?]/g, ' ').split(/\s+/).filter(Boolean);
    tokens.forEach((tok, i) => {
      let noun = tok, prev = tokens[i - 1];
      if (tok.startsWith("d'")) { noun = tok.slice(2); prev = "d'"; }
      if (!nouns[noun]) return;
      if (!prev || !/^(en|e|eng|keen|kee|keng|den|de|d')$/.test(prev)) return;
      if (!articleForms(nouns[noun], noun).has(prev.replace(/'$/, ''))) bad.push(`${c.lu} → ${prev} ${noun}`);
    });
  }
  assert.deepEqual(bad, []);
});

test('jours : « Bis e / en <jour> » suit la règle du n', () => {
  const days = ['Méindeg', 'Dënschdeg', 'Mëttwoch', 'Donneschdeg', 'Freideg', 'Samschdeg', 'Sonndeg'];
  const phrases = course.cards.filter(x => x.kind === 'phrase').map(x => x.lu);
  for (const d of days) assert.ok(phrases.includes(`Bis ${N.indefinite('m', d)} ${d}!`), d);
});

test('salutations : Gudde Moien, Gudde Mëtteg, Gudden Owend, et « Mäi Virnumm » (n tombé)', () => {
  const phrases = course.cards.filter(x => x.kind === 'phrase').map(x => x.lu);
  for (const p of ['Gudde Moien!', 'Gudde Mëtteg!', 'Gudden Owend!', 'Mäi Virnumm ass Remy.', 'Mäin Numm ass Pol Weber.', 'Wéi ass Äre Virnumm?', 'Wéi ass Ären Numm?', 'A wie bass du?', 'Ech si krank.', 'Ech hunn d’Flemm.', 'Nee, ech hu kee Problem.', 'Jo, ech hunn e Problem.', 'Jo, ech hunn e Rendez-vous.', 'Nee, ech hu kee Rendez-vous.']) {
    assert.ok(phrases.includes(p), p);
  }
  const forbidden = ['Gudden Moien', 'Gudden Mëtteg', 'Mäin Virnumm', 'Äre Numm', 'ech sinn krank', 'Ech sinn krank', 'keen Rendez-vous', 'en Rendez-vous', 'en Stull', 'en Gebai', 'den Remy', 'den Julien'];
  for (const f of forbidden) assert.ok(!phrases.some(p => p.includes(f)), `forme à éviter : ${f}`);
});

test('nombres : les composés correspondent à la règle (an / a) et à la liste du cours', () => {
  const byN = Object.fromEntries(course.cards.filter(x => x.kind === 'number').map(x => [x.n, x.lu]));
  const units = { 1: 'eent', 2: 'zwee', 3: 'dräi', 4: 'véier', 5: 'fënnef', 6: 'sechs', 7: 'siwen', 8: 'aacht', 9: 'néng' };
  const tens = { 20: 'zwanzeg', 30: 'drësseg', 40: 'véierzeg', 50: 'fofzeg', 60: 'siechzeg', 70: 'siwwenzeg', 80: 'achtzeg', 90: 'nonzeg' };
  for (const n of [21, 22, 23, 24, 25, 26, 27, 28, 29, 38, 47, 56, 65, 74, 83, 92]) {
    assert.equal(byN[n], N.numberCompound(units[n % 10], tens[n - (n % 10)]), String(n));
  }
  for (const [n, w] of Object.entries(tens)) if (byN[n]) assert.equal(byN[n], w);
  assert.equal(byN[100], 'honnert');
  assert.equal(byN[101], 'honnerteent');
  for (let n = 0; n <= 10; n++) assert.ok(byN[n], `nombre ${n}`);
  for (let n = 11; n <= 29; n++) assert.ok(byN[n], `nombre ${n}`);
});

test('accord de l’adjectif : les phrases d’exemple du cours suivent le moteur', () => {
  const phrases = course.cards.filter(x => x.kind === 'phrase').map(x => x.lu);
  const expect = [
    ['Ech wëll', N.indefiniteWithAdjective('m', 'blo', 'Bic') + '.'], ['Ech brauch', N.indefiniteWithAdjective('m', 'rout', 'Auto') + '.'],
    ['Ech wëll', N.indefiniteWithAdjective('f', 'rout', 'Taass') + '.'], ['Ech brauch', N.indefiniteWithAdjective('n', 'gréng', 'Heft') + '.'],
    ['Dat ass', N.indefiniteWithAdjective('m', 'niddereg', 'Stull') + '.'], ['Dat ass', N.indefiniteWithAdjective('f', 'ellen', 'Auer') + '.'],
    ['Dat ass', N.indefiniteWithAdjective('n', 'knaschteg', 'Haus') + '.'],
  ];
  for (const [a, b] of expect) assert.ok(phrases.includes(`${a} ${b}`), `${a} ${b}`);
});

test('sections des fiches : types connus, balises {x|…} bien formées', () => {
  const types = new Set(['letters', 'table', 'dialogue', 'rule', 'conj', 'numbers', 'colors', 'pairs']);
  const flags = /^[mfnrgus]+$/;
  const scan = s => { for (const m of String(s).matchAll(/\{([^|{}]*)\|/g)) assert.match(m[1], flags, s); assert.equal((String(s).match(/\{/g) || []).length, (String(s).match(/\}/g) || []).length, s); };
  for (const L of raw) for (const sec of L.sections) {
    assert.ok(types.has(sec.type), `${L.id} ${sec.type}`);
    [sec.title, sec.body, sec.note].filter(Boolean).forEach(scan);
    (sec.head || []).forEach(scan); (sec.examples || []).forEach(scan);
    (sec.rows || []).forEach(r => r.forEach(scan));
    (sec.lines || []).forEach(r => r.forEach(scan));
  }
});

// ---------- notation d'une réponse saisie ----------

const word = lu => course.cards.find(c => c.kind === 'word' && c.lu === lu);
const phrase = lu => course.cards.find(c => c.kind === 'phrase' && c.lu === lu);

test('gradeTyped : exact, ponctuation finale ignorée, apostrophe droite ou courbe', () => {
  assert.equal(C.gradeTyped(phrase('Ech hunn d’Flemm.'), "Ech hunn d'Flemm").status, 'correct');
  assert.equal(C.gradeTyped(phrase('Gudde Moien!'), 'Gudde Moien!').status, 'correct');
  assert.equal(C.gradeTyped(phrase('Gudde Moien!'), '  Gudde   Moien ').status, 'correct');
  assert.equal(C.gradeTyped(word('Dësch'), 'en Dësch').status, 'correct');
});

test('gradeTyped : accent ou casse en moins = presque ; mot sans article = presque avec indice', () => {
  assert.equal(C.gradeTyped(word('Dësch'), 'en Desch').status, 'almost');
  assert.equal(C.gradeTyped(phrase('Gudde Moien!'), 'gudde moien').status, 'almost');
  const r = C.gradeTyped(word('Dësch'), 'Dësch');
  assert.equal(r.status, 'almost'); assert.equal(r.hint, 'article');
  assert.equal(C.gradeTyped(word('Dësch'), 'Desch').hint, 'article');
});

test('gradeTyped : mauvaise réponse, mauvais article, réponse vide', () => {
  assert.equal(C.gradeTyped(word('Dësch'), 'e Dësch').status, 'wrong');
  assert.equal(C.gradeTyped(word('Stull'), 'en Stull').status, 'wrong');
  assert.equal(C.gradeTyped(word('Stull'), '').status, 'wrong');
  assert.equal(C.gradeTyped(phrase('Gudde Moien!'), 'Gudden Moien!').status, 'wrong');
  assert.equal(C.gradeTyped(phrase('Gudde Moien!'), 'Gudde Moien!').expected, 'Gudde Moien!');
});

test('lettre et nombre', () => {
  const r = course.cards.find(c => c.kind === 'letter' && c.letter === 'R');
  assert.equal(C.gradeTyped(r, 'err').status, 'correct');
  assert.equal(C.gradeTyped(r, 'är').status, 'wrong');
  const n25 = course.cards.find(c => c.kind === 'number' && c.n === 25);
  assert.equal(C.gradeTyped(n25, 'fënnefanzwanzeg').status, 'correct');
  assert.equal(C.gradeTyped(n25, 'fenefanzwanzeg').status, 'wrong');
  assert.equal(C.gradeTyped(n25, 'fenne fanzwanzeg').status, 'wrong');
});

// ---------- consignes et propositions ----------

test('promptFor : prod demande de taper, recog propose le luxembourgeois', () => {
  const w = word('Dësch');
  assert.equal(C.promptFor(w, 'prod').text, 'une table'); assert.equal(C.promptFor(w, 'prod').expected, 'en Dësch');
  assert.equal(C.promptFor(w, 'recog').text, 'en Dësch'); assert.equal(C.promptFor(w, 'recog').expected, 'une table');
  const color = course.cards.find(c => c.kind === 'color' && c.lu === 'mof');
  assert.equal(C.promptFor(color, 'prod').swatch, '7030A0');
  const pair = course.cards.find(c => c.kind === 'pair' && c.lu === 'nei');
  assert.equal(C.promptFor(pair, 'prod').expected, 'al');
});

test('choicesFor : 4 propositions distinctes dont la bonne, déterministe avec un rng fixe', () => {
  let seed = 7; const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (const card of course.cards.filter((_, i) => i % 7 === 0)) {
    const opts = C.choicesFor(card, course, rng, 4);
    assert.ok(opts.length >= 3 && opts.length <= 4, card.id);
    assert.ok(opts.includes(C.recogAnswer(card)), card.id);
    assert.equal(new Set(opts.map(C.fold)).size, opts.length, card.id);
  }
});

// ---------- révision espacée ----------

const NOW = Date.parse('2026-11-01T10:00:00Z');

test('answerCard : une carte neuve passe par les étapes d’apprentissage puis entre en boîte 2', () => {
  const progress = {}, id = word('Dësch').id;
  let r = C.answerCard(progress, id, true, NOW);
  assert.equal(r.entry.learningStep, 1); assert.deepEqual(r.requeueGap, [5, 9]);
  r = C.answerCard(progress, id, true, NOW); assert.equal(r.entry.learningStep, 2);
  r = C.answerCard(progress, id, true, NOW);
  assert.equal(r.entry.box, 2); assert.equal(r.entry.learningStep, undefined); assert.equal(r.entry.dueAt, NOW + 24 * 3600 * 1000); assert.equal(r.requeueGap, null);
  r = C.answerCard(progress, id, true, NOW + 25 * 3600 * 1000); assert.equal(r.entry.box, 3);
  r = C.answerCard(progress, id, false, NOW + 26 * 3600 * 1000); assert.equal(r.entry.box, 1); assert.equal(r.entry.wrongCount, 1);
  assert.equal(progress[id].updatedAt, NOW + 26 * 3600 * 1000);
});

test('buildQueue : dues d’abord (boîtes basses en premier), puis cartes neuves limitées', () => {
  const a = word('Dësch').id, b = word('Stull').id, c = word('Auto').id;
  const progress = { [a]: { box: 3, dueAt: NOW - 1000 }, [b]: { box: 1, dueAt: NOW - 5000 }, [c]: { box: 4, dueAt: NOW + 99999 } };
  const q = C.buildQueue(course, progress, { now: NOW, size: 6, newLimit: 2 });
  assert.equal(q[0].id, b); assert.equal(q[1].id, a);
  assert.ok(!q.some(x => x.id === c));
  assert.equal(q.length, 4);
  assert.ok(q.slice(2).every(x => !progress[x.id]));
});

test('buildQueue : restriction par leçon, taille et limite de cartes neuves', () => {
  const q = C.buildQueue(course, {}, { now: NOW, lessons: ['l05'], size: 50, newLimit: 7 });
  assert.equal(q.length, 7);
  assert.ok(q.every(x => x.lessonId === 'l05'));
  assert.equal(C.buildQueue(course, {}, { now: NOW, size: 3 }).length, 3);
});

test('lessonStats : vues, acquises, dues', () => {
  const a = word('Dësch').id, b = word('Stull').id;
  const progress = { [a]: { box: 5, dueAt: NOW + 1 }, [b]: { box: 1, dueAt: NOW - 1 } };
  const s = C.lessonStats(course, progress, NOW);
  assert.equal(s.l02.seen, 2); assert.equal(s.l02.mastered, 1); assert.equal(s.l02.due, 1);
  assert.equal(s.l01.seen, 0);
  assert.equal(Object.values(s).reduce((t, x) => t + x.total, 0), course.cards.length);
});

// ---------- exercices sur la règle du n ----------

test('nruleQuestions : la bonne réponse est parmi les propositions et suit le moteur', () => {
  for (const q of C.allNRuleQuestions(course)) {
    assert.ok(q.options.includes(q.answer), q.prompt);
    assert.equal(new Set(q.options).size, q.options.length, q.prompt);
    assert.ok(q.explanation && q.next, q.prompt);
    if (q.kind === 'indef') assert.equal(q.full, apos(`${q.answer} ${q.next}`).replace(/^(.*)$/, '$1'));
  }
});

test('nruleQuestions : filtrage par leçon et tirage', () => {
  const l1 = C.allNRuleQuestions(course, ['l01']);
  assert.ok(l1.length > 10);
  assert.ok(l1.every(q => q.kind !== 'indef' || /numm$/i.test(q.prompt)), 'en leçon 1 seuls les noms (Numm, Virnumm) prennent un article');
  const all = C.nruleQuestions(course, 10, Math.random);
  assert.equal(all.length, 10);
  assert.equal(C.nruleQuestions(course, 5, () => 0.5, ['l02']).length, 5);
});

test('nruleQuestions : exemples connus', () => {
  const qs = C.allNRuleQuestions(course);
  const find = (kind, prompt) => qs.find(q => q.kind === kind && q.prompt === prompt);
  assert.equal(find('indef', '___ Dësch').answer, 'en');
  assert.equal(find('indef', '___ Stull').answer, 'e');
  assert.equal(find('neg', 'Nee, dat ass ___ Auto.').answer, 'keen');
  assert.equal(find('neg', 'Nee, dat ass ___ Bic.').answer, 'kee');
  assert.equal(find('name', 'Ech sinn ___ Julien.').answer, 'de');
  assert.equal(find('name', 'Ech sinn ___ Antoine.').answer, 'den');
  assert.equal(find('name', 'Ech sinn ___Aurélie.').answer, 'd’');
  assert.equal(find('phrase', '___ Moien !').answer, 'Gudde');
  assert.equal(find('phrase', '___ Owend !').answer, 'Gudden');
  assert.equal(find('phrase', '___ wie bass du ?').answer, 'A');
});
