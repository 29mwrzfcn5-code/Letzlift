const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const V = require('../js/lib/vocab-entry.js');

const ok = { lu: 'Kuerf', fr: 'panier', cat: 'Divers', g: 'c', sentence: 'Ech hunn e ___.', sentenceFr: 'J\'ai un panier.', note: '' };

test('mot valide : entrée prête pour la surcouche, champs vides omis, valeurs nettoyées', () => {
  const r = V.validateVocabEntry({ ...ok, lu: '  Kuerf ', g: '' });
  assert.equal(r.ok, true);
  assert.deepEqual(r.entry, { lu: 'Kuerf', fr: 'panier', cat: 'Divers', sentence: 'Ech hunn e ___.', sentenceFr: 'J\'ai un panier.' });
  assert.deepEqual(V.validateVocabEntry({ ...ok, note: 'à retenir' }).entry.note, 'à retenir');
  assert.equal(V.validateVocabEntry(ok).entry.g, 'c');
});

test('champs obligatoires', () => {
  const r = V.validateVocabEntry({ lu: '', fr: ' ', cat: '', sentence: '', sentenceFr: '' });
  assert.equal(r.ok, false);
  for (const k of ['lu', 'fr', 'cat', 'sentence', 'sentenceFr']) assert.ok(r.errors[k], k);
  assert.ok(!r.errors.g && !r.errors.note);
});

test('phrase : exactement un trou « ___ »', () => {
  assert.ok(V.validateVocabEntry({ ...ok, sentence: 'Ech hunn e Kuerf.' }).errors.sentence);
  assert.ok(V.validateVocabEntry({ ...ok, sentence: '___ a ___' }).errors.sentence);
  assert.ok(V.validateVocabEntry({ ...ok, sentence: 'Ech hunn e ____.' }).errors.sentence); // quatre traits bas
  assert.ok(V.validateVocabEntry({ ...ok, sentence: 'Ech hunn e __.' }).errors.sentence);   // deux traits bas
  assert.equal(V.validateVocabEntry({ ...ok, sentence: '___ ass hei.' }).ok, true);
});

test('guillemets droits et antislash refusés dans lu, fr, cat (attributs HTML et onclick), permis dans les phrases', () => {
  for (const k of ['lu', 'fr', 'cat']) {
    assert.ok(V.validateVocabEntry({ ...ok, [k]: 'a"b' }).errors[k], k + ' "');
    assert.ok(V.validateVocabEntry({ ...ok, [k]: 'a\\b' }).errors[k], k + ' \\');
  }
  assert.equal(V.validateVocabEntry({ ...ok, fr: 'l\'été' }).ok, true);
  assert.equal(V.validateVocabEntry({ ...ok, sentenceFr: 'Il dit "oui".' }).ok, true);
});

test('< et > refusés partout (même garde-fou que l’import CSV et la sauvegarde)', () => {
  for (const k of ['lu', 'fr', 'cat', 'sentenceFr', 'note']) assert.ok(V.validateVocabEntry({ ...ok, [k]: 'a<b' }).errors[k], k);
  assert.ok(V.validateVocabEntry({ ...ok, sentence: 'Ech <b>___</b>' }).errors.sentence);
});

test('genre : seulement f ou c ; longueur maximale', () => {
  assert.ok(V.validateVocabEntry({ ...ok, g: 'm' }).errors.g);
  assert.equal(V.validateVocabEntry({ ...ok, g: 'f' }).ok, true);
  assert.ok(V.validateVocabEntry({ ...ok, note: 'x'.repeat(301) }).errors.note);
  assert.equal(V.validateVocabEntry({ ...ok, note: 'x'.repeat(300) }).ok, true);
});

test('les types non texte sont traités comme vides', () => {
  const r = V.validateVocabEntry({ lu: 5, fr: null, cat: undefined, sentence: {}, sentenceFr: [] });
  assert.equal(r.ok, false);
});

test('nextPersonalId : prochain persoN libre', () => {
  assert.equal(V.nextPersonalId([]), 'perso1');
  assert.equal(V.nextPersonalId(['v1', 'v386']), 'perso1');
  assert.equal(V.nextPersonalId(['v1', 'perso3', 'perso10', 'mot', 'perso2x']), 'perso11');
});

test('findDuplicateWords : insensible à la casse, hors mot édité', () => {
  const vocab = [{ id: 'v1', lu: 'Kuerf', fr: 'panier' }, { id: 'v2', lu: 'Dag', fr: 'jour' }];
  assert.deepEqual(V.findDuplicateWords(' kuerf ', vocab).map(x => x.id), ['v1']);
  assert.deepEqual(V.findDuplicateWords('Kuerf', vocab, 'v1'), []);
  assert.deepEqual(V.findDuplicateWords('', vocab), []);
});

test('les règles ne sont pas plus strictes que les 386 mots d’origine : ils passent tous la validation', () => {
  const ctx = vm.createContext({});
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'data', 'vocab.js'), 'utf8') + ';globalThis.W = VOCAB', ctx);
  const bad = JSON.parse(JSON.stringify(ctx.W)).map(v => ({ id: v.id, r: V.validateVocabEntry(v) })).filter(x => !x.r.ok);
  assert.deepEqual(bad.map(x => x.id + ' ' + JSON.stringify(x.r.errors)), []);
});
