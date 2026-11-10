require('./helpers/tz.js');
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../js/lib/course.js');
const X = require('../js/lib/course-ex.js');
const { loadRawLessons } = require('./helpers/course-data.js');

const course = C.buildCourse(loadRawLessons());
const fold = C.fold;
let seedState = 7;
const rng = () => { seedState = (seedState * 16807) % 2147483647; return (seedState - 1) / 2147483646; };

function check(ex, card) {
  assert.ok(ex, card && card.id);
  if (ex.options) {
    assert.ok(ex.options.includes(ex.answer) || ex.options.map(fold).includes(fold(ex.answer)), `${card && card.id} ${ex.type}: bonne réponse absente`);
    assert.equal(new Set(ex.options.map(fold)).size, ex.options.length, `${card && card.id} ${ex.type}: choix en double ${JSON.stringify(ex.options)}`);
    assert.ok(ex.options.length >= 3, `${card && card.id} ${ex.type}: moins de 3 choix`);
  }
}

test('chaque carte du cours produit un exercice valide, quel que soit son niveau', () => {
  const counts = {};
  for (const card of course.cards) {
    for (const entry of [undefined, { box: 1 }, { box: 3 }]) {
      for (let k = 0; k < 6; k++) {
        const ex = X.exerciseFor(card, course, entry ? { [card.id]: entry } : {}, rng, null);
        check(ex, card);
        counts[ex.type] = (counts[ex.type] || 0) + 1;
        assert.ok(ex.prompt && (ex.prompt.text !== undefined || ex.prompt.swatch));
      }
    }
  }
  for (const t of ['recog', 'typed', 'reverse', 'cloze', 'order']) assert.ok(counts[t] > 20, `format ${t} jamais ou presque jamais produit : ${JSON.stringify(counts)}`);
});

test('sens inverse : la bonne réponse est celle de la carte, les autres sont différentes', () => {
  const card = course.cards.find(c => c.kind === 'word' && c.answer === 'e Stull');
  for (let i = 0; i < 20; i++) {
    const opts = X.reverseChoices(card, course, rng, 4);
    assert.ok(opts.includes('e Stull'));
    assert.equal(new Set(opts).size, 4);
  }
});

test('phrase à trous : un seul trou, la réponse est un mot de la phrase', () => {
  let articles = 0;
  for (const card of course.cards.filter(c => c.kind === 'phrase')) {
    const ex = X.clozeFor(card, course, rng);
    if (!ex) continue;
    assert.equal((ex.prompt.text.match(/___/g) || []).length, 1, card.lu);
    assert.equal(ex.prompt.text.replace('___', ex.answer).replace(/\s+/g, ' '), C.straight(card.lu).replace(/\s+/g, ' '), card.lu);
    if (ex.why) articles++;
  }
  assert.ok(articles > 10, 'des phrases à trous sur les articles et le n existent');
});

test('phrase à trous sur le n : l\'explication cite la lettre et la règle', () => {
  const card = course.cards.find(c => c.kind === 'phrase' && /Jo, ech hunn en Auto/.test(c.lu));
  assert.ok(card, 'phrase de référence du cours');
  let found = null;
  for (let i = 0; i < 80 && !found; i++) { const ex = X.clozeFor(card, course, rng); if (ex && /^en$/i.test(ex.answer)) found = ex; }
  assert.ok(found);
  assert.match(found.why, /commence par A \(UNITED ZOHA\) : on garde le n/);
});

test('phrases à remettre dans l\'ordre : mêmes mots, ordre différent, correction', () => {
  let n = 0;
  for (const card of course.cards.filter(c => c.kind === 'phrase')) {
    const ex = X.orderFor(card, rng);
    if (!ex) continue;
    n++;
    assert.deepEqual([...ex.tokens].sort(), ex.answer.split(' ').sort());
    assert.notEqual(ex.tokens.join(' '), ex.answer);
    assert.equal(X.gradeOrder(ex, ex.answer.split(' ')), 'correct');
    assert.equal(X.gradeOrder(ex, ex.tokens), 'wrong');
  }
  assert.ok(n > 30);
});

test('mini-dialogues : répliques de la leçon 1, choix distincts, hors révision espacée', () => {
  const qs = X.dialogueQuestions(course, ['l01'], rng);
  assert.ok(qs.length >= 4);
  for (const q of qs) {
    assert.equal(q.cardId, null);
    check(q);
    assert.ok(q.options.includes(q.answer));
    assert.ok(!/\{[a-z]+\|/.test(q.answer + q.prompt.text), 'balises {m|…} retirées');
  }
  assert.deepEqual(X.dialogueQuestions(course, ['l03'], rng), []); // pas de dialogue dans la leçon 3
});

test('deux formats identiques de suite sont évités', () => {
  const card = course.cards.find(c => c.kind === 'phrase');
  let same = 0;
  for (let i = 0; i < 60; i++) if (X.exerciseFor(card, course, { [card.id]: { box: 3 } }, rng, 'cloze').type === 'cloze') same++;
  assert.equal(same, 0);
});

test('genres des mots : le sens inverse et la saisie portent le genre de la carte', () => {
  const card = course.cards.find(c => c.kind === 'word' && c.answer === 'e Stull');
  let rev = null;
  for (let i = 0; i < 80 && !rev; i++) { const ex = X.exerciseFor(card, course, { [card.id]: { box: 3 } }, rng, null); if (ex.type === 'reverse') rev = ex; }
  assert.ok(rev, 'format sens inverse produit');
  assert.equal(rev.answerG, 'm');
  assert.equal(rev.optionGenders.length, rev.options.length);
  assert.equal(rev.optionGenders[rev.options.indexOf('e Stull')], 'm');
  assert.ok(rev.optionGenders.every(g => g === null || ['m', 'f', 'n'].includes(g)));
  let rec = null;
  for (let i = 0; i < 80 && !rec; i++) { const ex = X.exerciseFor(card, course, {}, rng, null); if (ex.type === 'recog') rec = ex; }
  assert.equal(rec.promptG, 'm');
  assert.equal(X.genderOfAnswer(course, 'eng Fra') || X.genderOfAnswer(course, 'e Stull'), X.genderOfAnswer(course, 'eng Fra') || 'm');
});

test('phrases : pas de genre affiché (aucune donnée de genre sur les mots d\'une phrase)', () => {
  const card = course.cards.find(c => c.kind === 'phrase');
  for (let i = 0; i < 20; i++) {
    const ex = X.exerciseFor(card, course, { [card.id]: { box: 3 } }, rng, null);
    assert.ok(!ex.promptG && !ex.optionGenders);
  }
});

// ---- genre des noms dans les phrases ----
const { loadVocab } = require('./helpers/course-data.js');
const G = require('../js/lib/genre-n.js');
const nouns = X.buildNounGenders(course, loadVocab().filter(v => G.certainGender(v)));
const joined = segs => segs.map(s => s.t).join('');

test('table des noms : genres sûrs, aucun mot ambigu, majuscule seulement', () => {
  assert.ok(Object.keys(nouns).length > 150);
  assert.equal(nouns.Numm, 'm');
  assert.equal(nouns.Virnumm, 'm');
  assert.ok(Object.keys(nouns).every(k => /^[A-ZÄËÉÖÜ]/.test(k) && ['m', 'f', 'n'].includes(nouns[k])));
});

test('phrases : le texte est conservé, les noms connus portent leur genre, la ponctuation reste neutre', () => {
  const segs = X.phraseSegments('Wéi ass Ären Numm?', nouns);
  assert.equal(joined(segs), 'Wéi ass Ären Numm?');
  assert.deepEqual(segs.filter(s => s.g).map(s => [s.t, s.g]), [['Numm', 'm']]);
  assert.ok(!segs.find(s => s.t === '?').g);
  const d = X.phraseSegments("D’Fra ass hei, an d'Haus och.", Object.assign({ Fra: 'f', Haus: 'n' }, {}));
  assert.equal(joined(d), "D’Fra ass hei, an d'Haus och.");
  assert.deepEqual(d.filter(s => s.g).map(s => s.g), ['f', 'n']);
});

test('phrases du cours : tout le texte est rendu tel quel et la couverture est large', () => {
  let withNoun = 0, total = 0;
  for (const c of course.cards.filter(x => x.kind === 'phrase')) {
    total++;
    const segs = X.phraseSegments(c.lu, nouns);
    assert.equal(joined(segs), c.lu);
    if (segs.some(s => s.g)) withNoun++;
  }
  assert.ok(withNoun / total > 0.5, `${withNoun}/${total}`);
});

test('phrase à trous sur un article : le genre est masqué dans la question', () => {
  let masked = 0;
  for (const card of course.cards.filter(c => c.kind === 'phrase')) {
    const ex = X.clozeFor(card, course, rng);
    if (ex && ex.why && /en|e|eng|den|de|d'|keen|kee|keng/i.test(ex.answer)) assert.equal(ex.hidesGender, true);
    if (ex && ex.hidesGender) masked++;
  }
  assert.ok(masked > 5);
});
