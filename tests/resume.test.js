const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../js/lib/resume.js');

const NOW = Date.parse('2026-11-09T10:00:00Z');
const DAY = 24 * 3600 * 1000;
function make(n, overdueDays, box) {
  const p = {};
  for (let i = 0; i < n; i++) p['c' + String(i).padStart(3, '0')] = { box: box || 1 + (i % 5), dueAt: NOW - (overdueDays + i / 1000) * DAY };
  return p;
}

test('backlogIds : seulement les cartes en retard de plus de 3 jours, hors apprentissage', () => {
  const p = { a: { box: 2, dueAt: NOW - 5 * DAY }, b: { box: 2, dueAt: NOW - 1 * DAY }, c: { box: 1, dueAt: NOW - 9 * DAY, learningStep: 1 }, d: { box: 3, dueAt: NOW + DAY }, e: { box: 1, dueAt: 0 } };
  assert.deepEqual(R.backlogIds(p, NOW), ['a']);
});

test('shouldOfferResume : à partir de 20 cartes en retard', () => {
  assert.equal(R.shouldOfferResume(make(19, 10), NOW), false);
  assert.equal(R.shouldOfferResume(make(20, 10), NOW), true);
  assert.equal(R.shouldOfferResume({}, NOW), false);
});

test('spreadBacklog : étale sur 14 jours, boîtes basses d’abord, boîtes inchangées', () => {
  const p = make(140, 20);
  const boxes = Object.fromEntries(Object.entries(p).map(([k, v]) => [k, v.box]));
  const r = R.spreadBacklog(p, NOW);
  assert.equal(r.moved, 140); assert.equal(r.perDay, 10); assert.equal(r.days, 14);
  for (const [k, v] of Object.entries(p)) assert.equal(v.box, boxes[k]);
  const today = Object.values(p).filter(v => v.dueAt <= NOW);
  assert.equal(today.length, 10);
  assert.ok(today.every(v => v.box === 1));
  const last = Object.values(p).filter(v => v.dueAt === NOW + 13 * DAY);
  assert.equal(last.length, 10);
  assert.ok(Object.values(p).every(v => v.dueAt >= NOW && v.dueAt <= NOW + 13 * DAY));
});

test('spreadBacklog : grand retard → toujours 14 jours, davantage par jour ; petit retard → 10 par jour minimum', () => {
  const big = make(700, 30);
  const r = R.spreadBacklog(big, NOW);
  assert.equal(r.perDay, 50); assert.equal(r.days, 14);
  const small = make(25, 30);
  const s = R.spreadBacklog(small, NOW);
  assert.equal(s.perDay, 10); assert.equal(s.days, 3);
});

test('spreadBacklog : ne touche pas aux cartes à jour ni en apprentissage ; undoSpread rétablit tout', () => {
  const p = make(30, 12);
  p.fresh = { box: 3, dueAt: NOW + 2 * DAY };
  p.learning = { box: 1, dueAt: NOW - 20 * DAY, learningStep: 2 };
  const before = JSON.parse(JSON.stringify(p));
  const r = R.spreadBacklog(p, NOW);
  assert.equal(r.moved, 30);
  assert.deepEqual(p.fresh, before.fresh); assert.deepEqual(p.learning, before.learning);
  R.undoSpread(p, r.undo);
  assert.deepEqual(p, before);
});

test('spreadBacklog : table vide ou sans retard', () => {
  assert.deepEqual(R.spreadBacklog({}, NOW), { moved: 0, days: 0, perDay: 10, undo: {} });
  const ok = { a: { box: 1, dueAt: NOW - DAY } };
  assert.equal(R.spreadBacklog(ok, NOW).moved, 0);
  assert.equal(ok.a.dueAt, NOW - DAY);
});
