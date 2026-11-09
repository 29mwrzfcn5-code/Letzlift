require('./helpers/tz.js');
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../js/lib/stamps.js');

const ctx = over => ({ seen: 0, total: 386, mastered: 0, streak: 0, sessions: 0, reached: 0, ...over });

test('nouvel apprenant : aucun tampon', () => {
  assert.deepEqual(S.earnedStamps(ctx()), []);
});

test('tampons gagnés selon les mots vus, la série et les sessions', () => {
  const ids = S.earnedStamps(ctx({ seen: 60, reached: 1, streak: 7, sessions: 3, mastered: 12 })).map(s => s.id);
  for (const id of ['p-schengen', 'm-20', 'm-50', 's-3', 's-7', 'a-10', 'x-1']) assert.ok(ids.includes(id), id);
  for (const id of ['p-vianden', 'm-100', 's-14', 'a-50', 'x-10']) assert.ok(!ids.includes(id), id);
});

test('identifiants uniques', () => {
  const ids = S.STAMPS.map(s => s.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('nouveaux tampons : seulement ceux pas encore fêtés', () => {
  const earned = ['p-schengen', 'm-20', 'x-1'];
  assert.deepEqual(S.newStamps(earned, ['p-schengen']).map(s => s.id), ['m-20', 'x-1']);
  assert.deepEqual(S.newStamps(earned, earned), []);
  assert.deepEqual(S.newStamps(earned, null).length, 3);
});

test('messages de Roudi : reprise après une longue absence, jour fait, série', () => {
  assert.match(S.homeLine({ streak: 0, daysAway: 20, doneToday: false, hour: 10 }, 0), /reprend tout doucement/);
  assert.match(S.homeLine({ streak: 0, daysAway: 4, doneToday: false, hour: 10 }, 0), /manqué|reprend/);
  assert.match(S.homeLine({ streak: 2, daysAway: 0, doneToday: true, hour: 10 }, 0), /session du jour est faite|C'est fait/);
  assert.match(S.homeLine({ streak: 9, daysAway: 1, doneToday: false, hour: 14 }, 0), /9 jours de suite/);
  assert.equal(S.homeLine({ streak: 1, daysAway: 1, doneToday: false, hour: 14 }, 0), 'Ton billet du jour est prêt.');
});

test('messages de fin de session : jamais punitif', () => {
  for (const pct of [null, 0, 30, 55, 75, 95]) {
    const m = S.sessionLine(pct, 1);
    assert.ok(m.length > 5);
    assert.ok(!/nul|mauvais|échec/i.test(m));
  }
});
