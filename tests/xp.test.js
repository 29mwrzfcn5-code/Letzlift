const test = require('node:test');
const assert = require('node:assert/strict');
const X = require('../js/lib/xp.js');

test('computeXpAmount : valeur de base, réduction « presque », bonus de renforcement', () => {
  assert.equal(X.computeXpAmount(3), 3);
  assert.equal(X.computeXpAmount(3, 0.5), 2);        // round(1.5)
  assert.equal(X.computeXpAmount(2, 0.5), 1);
  assert.equal(X.computeXpAmount(1, 0.5), 1);        // minimum 1
  assert.equal(X.computeXpAmount(3, undefined, true), 5); // round(4.5)
  assert.equal(X.computeXpAmount(4, undefined, true), 6);
  assert.equal(X.computeXpAmount(3, 0.5, true), 3);  // 2 puis ×1.5
});

test('XP_VALUES inchangées', () => {
  assert.deepEqual(X.XP_VALUES, { type: 3, qcm: 2, reverse: 4, genre: 2, grammar: 3, smalltalk: 2 });
});

test('levelInfoForXp : seuils de niveau', () => {
  assert.deepEqual(X.levelInfoForXp(0), { level: 1, nextThreshold: 150, currentThreshold: 0 });
  assert.equal(X.levelInfoForXp(149).level, 1);
  assert.equal(X.levelInfoForXp(150).level, 2);
  assert.equal(X.levelInfoForXp(499).level, 2);
  assert.equal(X.levelInfoForXp(500).level, 3);
  assert.equal(X.levelInfoForXp(1050).level, 4);
  assert.equal(X.levelInfoForXp(6199).level, 10);
  assert.deepEqual(X.levelInfoForXp(6200), { level: 11, nextThreshold: null, currentThreshold: 6200 });
  assert.equal(X.levelInfoForXp(1e9).level, 11);
});

test('les seuils sont strictement croissants', () => {
  for (let i = 1; i < X.ENDURANCE_LEVELS.length; i++) assert.ok(X.ENDURANCE_LEVELS[i] > X.ENDURANCE_LEVELS[i - 1]);
});
