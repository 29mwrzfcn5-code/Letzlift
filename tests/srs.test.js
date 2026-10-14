require('./helpers/tz.js');
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../js/lib/srs.js');

const MIN = 60 * 1000, H = 3600 * 1000, DAY = 24 * H;
const NOW = Date.parse('2026-03-10T10:00:00Z');
const answer = (entry, correct, extra) => S.applyAnswerToEntry(entry, correct, { now: NOW, ...extra });

test('intervalles par boîte', () => {
  assert.deepEqual(S.BOX_INTERVALS_MS, { 1: 5 * MIN, 2: DAY, 3: 3 * DAY, 4: 7 * DAY, 5: 14 * DAY });
});

test('session normale : une bonne réponse monte d’une boîte, jusqu’à 5', () => {
  const e = { box: 1, dueAt: 0 };
  for (let box = 2; box <= 5; box++) {
    const r = answer(e, true);
    assert.equal(e.box, box);
    assert.equal(e.dueAt, NOW + S.BOX_INTERVALS_MS[box]);
    assert.equal(r.requeueGap, null);
  }
  answer(e, true);
  assert.equal(e.box, 5); // plafonné
  assert.equal(e.dueAt, NOW + 14 * DAY);
});

test('session normale : une erreur renvoie en boîte 1 et compte dans wrongCount', () => {
  const e = { box: 4, dueAt: 0 };
  answer(e, false);
  assert.equal(e.box, 1);
  assert.equal(e.dueAt, NOW + 5 * MIN);
  assert.equal(e.wrongCount, 1);
  answer(e, false);
  assert.equal(e.wrongCount, 2);
});

test('learning steps : 0 → 1 → 2 → diplômé en boîte 2 (échéance à 24 h)', () => {
  const e = { box: 1, dueAt: 0, learningStep: 0 };
  let r = answer(e, true);
  assert.equal(e.learningStep, 1); assert.deepEqual(r.requeueGap, [5, 9]);
  r = answer(e, true);
  assert.equal(e.learningStep, 2); assert.deepEqual(r.requeueGap, [8, 14]);
  r = answer(e, true);
  assert.equal(r.requeueGap, null);
  assert.equal(e.learningStep, undefined);
  assert.equal(e.box, 2);
  assert.equal(e.dueAt, NOW + DAY);
});

test('learning steps : une erreur fait reculer', () => {
  let e = { box: 1, dueAt: 0, learningStep: 0 };
  let r = answer(e, false);
  assert.equal(e.learningStep, 0); assert.deepEqual(r.requeueGap, [3, 6]);
  e = { box: 1, dueAt: 0, learningStep: 1 };
  r = answer(e, false);
  assert.equal(e.learningStep, 0); assert.deepEqual(r.requeueGap, [3, 6]);
  e = { box: 1, dueAt: 0, learningStep: 2 };
  r = answer(e, false);
  assert.equal(e.learningStep, 1); assert.deepEqual(r.requeueGap, [3, 6]);
  assert.equal(e.dueAt, 0); // la boîte et l'échéance ne bougent pas pendant l'apprentissage
});

test('révision des acquis : mot dû, bonne réponse → boîte suivante et nouvelle échéance', () => {
  const e = { box: 4, dueAt: NOW - H };
  answer(e, true, { kind: 'mastery' });
  assert.equal(e.box, 5);
  assert.equal(e.dueAt, NOW + 14 * DAY);
});

test('révision des acquis : mot pas encore dû, l’échéance n’est pas repoussée', () => {
  const due = NOW + 2 * DAY;
  const e = { box: 4, dueAt: due };
  answer(e, true, { kind: 'mastery' });
  assert.equal(e.box, 5);
  assert.equal(e.dueAt, due);
});

test('révision des acquis : une erreur redescend en boîte 3, pas en 1', () => {
  const e = { box: 5, dueAt: NOW - H };
  answer(e, false, { kind: 'mastery' });
  assert.equal(e.box, 3);
  assert.equal(e.dueAt, NOW + 3 * DAY);
  assert.equal(e.wrongCount, 1);
});

test('mots difficiles : 2 réussites requises, réinsertion entre les deux', () => {
  const e = { box: 1, dueAt: 0 };
  let r = answer(e, true, { kind: 'difficult', difficultReps: 0 });
  assert.equal(e.box, 2);
  assert.equal(r.difficultReps, 1);
  assert.deepEqual(r.requeueGap, [3, 6]);
  r = answer(e, true, { kind: 'difficult', difficultReps: r.difficultReps });
  assert.equal(e.box, 3);
  assert.equal(r.difficultReps, 2);
  assert.equal(r.requeueGap, null);
});

test('mots difficiles : une erreur renvoie en boîte 1 et revient vite', () => {
  const e = { box: 3, dueAt: 0 };
  const r = answer(e, false, { kind: 'difficult', difficultReps: 1 });
  assert.equal(e.box, 1);
  assert.equal(e.dueAt, NOW + 5 * MIN);
  assert.deepEqual(r.requeueGap, [2, 4]);
  assert.equal(r.difficultReps, 1); // le compteur de réussites ne bouge pas sur une erreur
});

test('remise en confiance : aucune sanction, l’échéance n’avance que si elle était dépassée', () => {
  let e = { box: 5, dueAt: NOW - H };
  answer(e, true, { kind: 'confidence' });
  assert.equal(e.box, 5);
  assert.equal(e.dueAt, NOW + 14 * DAY);
  const later = NOW + 3 * DAY;
  e = { box: 5, dueAt: later };
  answer(e, true, { kind: 'confidence' });
  assert.equal(e.dueAt, later);
  e = { box: 5, dueAt: NOW - H };
  answer(e, false, { kind: 'confidence' });
  assert.equal(e.box, 5);
  assert.equal(e.dueAt, NOW - H);
  assert.equal(e.wrongCount, 1);
});

test('isDueEntry : dû à l’instant exact de l’échéance', () => {
  assert.ok(S.isDueEntry({ dueAt: NOW }, NOW));
  assert.ok(!S.isDueEntry({ dueAt: NOW + 1 }, NOW));
  assert.ok(S.isDueEntry({ dueAt: 0 }, NOW));
});

test('changement d’heure : « 1 jour » reste 24 h exactes (l’heure locale d’échéance se décale d’1 h)', () => {
  const before = Date.parse('2026-03-28T12:00:00Z'); // 13:00 CET, la veille du passage à l'heure d'été
  const e = { box: 1, dueAt: 0 };
  S.applyAnswerToEntry(e, true, { now: before });
  assert.equal(e.dueAt - before, DAY);
  assert.equal(new Date(before).getHours(), 13);
  assert.equal(new Date(e.dueAt).getHours(), 14); // 14:00 CEST le lendemain
});
