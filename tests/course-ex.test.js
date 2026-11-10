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
