require('./helpers/tz.js');
const test = require('node:test');
const assert = require('node:assert/strict');
const J = require('../js/lib/journey.js');
const D = require('../js/lib/dates.js');

test('départ : aucun mot vu, Schengen est la prochaine étape', () => {
  const s = J.journeyState(0, 386);
  assert.equal(s.reached, 0);
  assert.equal(s.from, null);
  assert.equal(s.to, 'Schengen');
  assert.equal(s.stops[0].state, 'current');
});

test('un mot vu : Schengen atteinte, cap sur Vianden', () => {
  const s = J.journeyState(1, 386);
  assert.equal(s.from, 'Schengen');
  assert.equal(s.to, 'Vianden');
  assert.deepEqual(s.stops.map(x => x.state), ['done', 'current', 'todo', 'todo', 'todo']);
});

test('131 mots sur 386 : Vianden est en cours (34 %)', () => {
  const s = J.journeyState(131, 386);
  assert.equal(s.reached, 2);
  assert.equal(s.to, 'Echternach');
  assert.equal(s.pct, 34);
  assert.ok(s.wordsToNext > 0);
});

test('tout le vocabulaire vu : tour terminé', () => {
  const s = J.journeyState(386, 386);
  assert.equal(s.finished, true);
  assert.equal(s.to, null);
  assert.ok(s.stops.every(x => x.state === 'done'));
});

test('les étapes sont franchies dans l\'ordre, jamais en arrière', () => {
  let last = 0;
  for (let n = 0; n <= 400; n++) { const r = J.journeyState(n, 386).reached; assert.ok(r >= last); last = r; }
});

test('petit vocabulaire : jamais deux étapes au même seuil', () => {
  const t = [0, 1, 2, 3, 4].map(i => J.stopThreshold(i, 10));
  for (let i = 1; i < t.length; i++) assert.ok(t[i] > t[i - 1] || i === 1);
});

test('semaine : jours faits, aujourd\'hui, manqués et à venir', () => {
  const strip = J.weekStrip('2026-03-09', '2026-03-12', ['2026-03-09', '2026-03-11'], D.addDaysStr);
  assert.deepEqual(strip.map(d => d.state), ['on', 'missed', 'on', 'today', 'future', 'future', 'future']);
  assert.equal(strip.map(d => d.letter).join(''), 'LMMJVSD');
});

test('semaine : aujourd\'hui déjà fait compte comme fait', () => {
  const strip = J.weekStrip('2026-03-09', '2026-03-12', ['2026-03-12'], D.addDaysStr);
  assert.equal(strip[3].state, 'on');
});
