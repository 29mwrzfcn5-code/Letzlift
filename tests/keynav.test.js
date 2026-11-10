const test = require('node:test');
const assert = require('node:assert/strict');
const K = require('../js/lib/keynav.js');
const fs = require('node:fs');

test('flèches : première pression sur la première réponse, puis déplacement borné', () => {
  assert.equal(K.moveIndex('ArrowDown', -1, 4), 0);
  assert.equal(K.moveIndex('ArrowRight', 0, 4), 1);
  assert.equal(K.moveIndex('ArrowDown', 3, 4), 3);
  assert.equal(K.moveIndex('ArrowUp', 2, 4), 1);
  assert.equal(K.moveIndex('ArrowLeft', 0, 4), 0);
  assert.equal(K.moveIndex('a', 1, 4), -1);
  assert.equal(K.moveIndex('ArrowDown', 0, 0), -1);
});

test('chiffres : 1 à 9, dans la limite des réponses', () => {
  assert.equal(K.digitIndex('1', 4), 0);
  assert.equal(K.digitIndex('4', 4), 3);
  assert.equal(K.digitIndex('5', 4), -1);
  assert.equal(K.digitIndex('0', 4), -1);
  assert.equal(K.digitIndex('a', 4), -1);
});

test('le gestionnaire couvre les choix du cours et ne détourne pas la saisie', () => {
  const main = fs.readFileSync(require('node:path').join(__dirname, '..', 'js', 'main.js'), 'utf8');
  assert.match(main, /\.course-choices/);
  assert.match(main, /\.course-choice:not\(\[disabled\]\)/);
  assert.match(main, /INPUT\|TEXTAREA\|SELECT/);
});
