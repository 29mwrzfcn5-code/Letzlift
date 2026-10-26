const test = require('node:test');
const assert = require('node:assert/strict');
const N = require('../js/lib/nrule.js');

// Les formes attendues sont celles écrites dans les documents du cours (leçons 1 à 5),
// lettres barrées retirées, lettres soulignées conservées.

test('lettres qui gardent le n : UNITED ZOHA, accents ignorés', () => {
  for (const w of ['Auto', 'Dësch', 'Handy', 'Numm', 'Owend', 'Heft', 'Zeitung', 'Ären', 'Éischte', 'Ënnerzeechent', 'Taass', 'Ieselsdéier', 'Uelzecht', 'Dier', 'Haus']) assert.ok(N.keepsN(w), w);
  for (const w of ['Stull', 'Bic', 'Remy', 'Julien', 'Virnumm', 'Rucksak', 'Schaf', 'Moien', 'Gebai', 'Kaffi', 'Fläsch', 'Luucht', 'Posch', 'Wien', 'Wëllen', 'Bus']) assert.ok(!N.keepsN(w), w);
});

test('cas limites : fin de phrase, mot vide, chiffre → forme longue', () => {
  assert.equal(N.applyN('en', ''), 'en');
  assert.equal(N.applyN('en', undefined), 'en');
  assert.equal(N.applyN('en', '25'), 'en');
  assert.equal(N.applyN('hunn', '!'), 'hunn');
});

test('article indéfini (objets masculins et neutres, leçons 2 et 3)', () => {
  const m = { Auto: 'en', Dësch: 'en', Handy: 'en', Bic: 'e', Rucksak: 'e', Schaf: 'e', 'Schlëssel': 'e', Stull: 'e' };
  for (const [noun, art] of Object.entries(m)) assert.equal(N.nounPhrase('indef', 'm', noun), `${art} ${noun}`);
  const n = { Haus: 'en', Heft: 'en', Gebai: 'e', Bild: 'e', Glas: 'e', Buch: 'e', Blat: 'e', Regal: 'e' };
  for (const [noun, art] of Object.entries(n)) assert.equal(N.nounPhrase('indef', 'n', noun), `${art} ${noun}`);
});

test('article indéfini féminin : toujours « eng » (leçon 2)', () => {
  for (const noun of ['Zeitung', 'Fënster', 'Posch', 'Auer', 'Luucht', 'Dier', 'Taass', 'Fläsch']) assert.equal(N.nounPhrase('indef', 'f', noun), `eng ${noun}`);
});

test('négation : kee / keen / keng (leçons 2 et 3)', () => {
  for (const noun of ['Auto', 'Dësch', 'Handy']) assert.equal(N.nounPhrase('neg', 'm', noun), `keen ${noun}`);
  for (const noun of ['Rucksak', 'Schaf', 'Schlëssel', 'Stull', 'Bic', 'Problem']) assert.equal(N.nounPhrase('neg', 'm', noun), `kee ${noun}`);
  for (const noun of ['Haus', 'Heft']) assert.equal(N.nounPhrase('neg', 'n', noun), `keen ${noun}`);
  for (const noun of ['Buch', 'Gebai', 'Glas', 'Regal', 'Bild', 'Blat']) assert.equal(N.nounPhrase('neg', 'n', noun), `kee ${noun}`);
  for (const noun of ['Luucht', 'Auer', 'Fro']) assert.equal(N.nounPhrase('neg', 'f', noun), `keng ${noun}`);
  assert.equal(N.nounPhrase('neg', 'n', 'Rendez-vous'), 'kee Rendez-vous');
});

test('article défini (leçons 4 et 5) : den / de pour le masculin, d\' pour le féminin et le neutre', () => {
  assert.equal(N.nounPhrase('def', 'm', 'Auto'), 'den Auto');
  assert.equal(N.nounPhrase('def', 'm', 'Dësch'), 'den Dësch');
  assert.equal(N.nounPhrase('def', 'm', 'Handy'), 'den Handy');
  assert.equal(N.nounPhrase('def', 'm', 'Telefon'), 'den Telefon');
  for (const noun of ['Bic', 'Rucksak', 'Schaf', 'Schlëssel', 'Stull', 'Bus']) assert.equal(N.nounPhrase('def', 'm', noun), `de ${noun}`);
  for (const noun of ['Auer', 'Dier', 'Fënster', 'Fläsch', 'Luucht', 'Posch', 'Taass', 'Zeitung']) assert.equal(N.nounPhrase('def', 'f', noun), `d'${noun}`);
  for (const noun of ['Haus', 'Heft', 'Bild', 'Blat', 'Buch', 'Gebai', 'Glas', 'Regal']) assert.equal(N.nounPhrase('def', 'n', noun), `d'${noun}`);
});

test('prénoms (leçons 1 et 2, case OPGEPASST) : den Antoine, de Julien, de Remy, d\'Aurélie', () => {
  for (const name of ['Antoine', 'David', 'Adrien']) assert.equal(N.nounPhrase('def', 'm', name), `den ${name}`);
  for (const name of ['Julien', 'Remy', 'Sébastien', 'Jérémie', 'Bertrand']) assert.equal(N.nounPhrase('def', 'm', name), `de ${name}`);
  for (const name of ['Aurélie', 'Cecile', 'Marie']) assert.equal(N.nounPhrase('def', 'f', name), `d'${name}`);
});

test('salutations (leçon 1) : Gudde Moien, Gudde Mëtteg, Gudden Owend', () => {
  assert.equal(`${N.applyN('Gudden', 'Moien')} Moien`, 'Gudde Moien');
  assert.equal(`${N.applyN('Gudden', 'Mëtteg')} Mëtteg`, 'Gudde Mëtteg');
  assert.equal(`${N.applyN('Gudden', 'Owend')} Owend`, 'Gudden Owend');
});

test('mäin / däin / Ären (leçon 1)', () => {
  assert.equal(N.applyN('Mäin', 'Virnumm'), 'Mäi');
  assert.equal(N.applyN('Mäin', 'Familljennumm'), 'Mäi');
  assert.equal(N.applyN('Mäin', 'Numm'), 'Mäin');
  assert.equal(N.applyN('Ären', 'Virnumm'), 'Äre');
  assert.equal(N.applyN('Ären', 'Familljennumm'), 'Äre');
  assert.equal(N.applyN('Ären', 'Numm'), 'Ären');
  assert.equal(N.applyN('däin', 'Virnumm'), 'däi');
  assert.equal(N.applyN('däin', 'Numm'), 'däin');
});

test('An wien → A wie ; hien → hie ; sinn → si ; hunn → hu', () => {
  assert.equal(N.applyN('An', 'wien'), 'A');
  assert.equal(N.applyN('wien', 'bass'), 'wie');
  assert.equal(N.applyN('An', 'Dir'), 'An');
  assert.equal(N.applyN('An', 'du'), 'An');
  assert.equal(N.applyN('hien', 'wëll'), 'hie');
  assert.equal(N.applyN('sinn', 'krank'), 'si');
  assert.equal(N.applyN('sinn', 'midd'), 'si');
  assert.equal(N.applyN('sinn', 'futti'), 'si');
  assert.equal(N.applyN('hunn', 'kee'), 'hu');
  assert.equal(N.applyN('hunn', 'e'), 'hunn');   // « Jo, ech hunn e Problem »
  assert.equal(N.applyN('hunn', 'en'), 'hunn');  // « Jo, ech hunn en Auto »
  assert.equal(N.applyN('hunn', "d'Flemm"), 'hunn'); // « Ech hunn d'Flemm »
  assert.equal(N.applyN('hunn', 'Honger'), 'hunn'); // « Ech hunn Honger an Duuscht »
  assert.equal(N.applyN('Mir', 'x'), 'Mir');     // formes inconnues : inchangées
});

test('wëllen / brauchen : formes en -n devant consonne', () => {
  assert.equal(N.applyN('wëllen', 'kee'), 'wëlle');
  assert.equal(N.applyN('wëllen', 'en'), 'wëllen');
  assert.equal(N.applyN('brauchen', 'kee'), 'brauche');
});

test('la casse de la forme longue est conservée', () => {
  assert.equal(N.applyN('En', 'Stull'), 'E');
  assert.equal(N.applyN('Den', 'Bic'), 'De');
});

// ---- accord de l'adjectif (leçons 4 et 5) ----

test('un objet masculin avec adjectif : e rouden Auto, e bloe Bic…', () => {
  const rows = [
    ['rout', 'Auto', 'e rouden Auto'], ['brong', 'Dësch', 'e brongen Dësch'], ['schwaarz', 'Handy', 'e schwaarzen Handy'],
    ['blo', 'Bic', 'e bloe Bic'], ['rosa', 'Rucksak', 'e rosae Rucksak'], ['wäiss', 'Schaf', 'e wäisse Schaf'],
    ['gréng', 'Schlëssel', 'e grénge Schlëssel'], ['giel', 'Stull', 'e giele Stull'],
  ];
  for (const [adj, noun, expected] of rows) assert.equal(N.indefiniteWithAdjective('m', adj, noun), expected);
});

test('masculin : article suit l’adjectif, terminaison suit le nom (en niddereg…)', () => {
  assert.equal(N.indefiniteWithAdjective('m', 'niddereg', 'Stull'), 'en nidderege Stull'); // n : article gardé ; Stull : pas de n final
  assert.equal(N.indefiniteWithAdjective('m', 'héich', 'Auto'), 'en héichen Auto');       // h : article gardé ; Auto : n final gardé
  assert.equal(N.indefiniteWithAdjective('m', 'kleng', 'Auto'), 'e klengen Auto');
});

test('un objet féminin avec adjectif : pas d’accord', () => {
  const rows = [['rosa', 'Auer'], ['blo', 'Dier'], ['hellbrong', 'Fënster'], ['hellgréng', 'Fläsch'], ['giel', 'Luucht'], ['schwaarz', 'Posch'], ['rout', 'Taass'], ['wäiss', 'Zeitung']];
  for (const [adj, noun] of rows) assert.equal(N.indefiniteWithAdjective('f', adj, noun), `eng ${adj} ${noun}`);
});

test('un objet neutre avec adjectif : + t, et en / e selon la première lettre de l’adjectif', () => {
  const rows = [
    ['orange', 'Haus', 'en oranget Haus'], ['gréng', 'Heft', 'e gréngt Heft'], ['faarweg', 'Bild', 'e faarwegt Bild'],
    ['wäiss', 'Blat', 'e wäisst Blat'], ['faarweg', 'Buch', 'e faarwegt Buch'], ['gro', 'Gebai', 'e grot Gebai'],
    ['schwaarz', 'Glas', 'e schwaarzt Glas'], ['rout', 'Regal', 'e rout Regal'],
  ];
  for (const [adj, noun, expected] of rows) assert.equal(N.indefiniteWithAdjective('n', adj, noun), expected);
});

test('pluriel : pas d’article ni d’accord (wäiss Blieder)', () => {
  assert.equal(N.indefiniteWithAdjective('pl', 'wäiss', 'Blieder'), 'wäiss Blieder');
});

// ---- nombres composés (leçons 4 et 5) ----

test('21 à 29 : unité + an + zwanzeg (eent devient een)', () => {
  const units = ['eent', 'zwee', 'dräi', 'véier', 'fënnef', 'sechs', 'siwen', 'aacht', 'néng'];
  const expected = ['eenanzwanzeg', 'zweeanzwanzeg', 'dräianzwanzeg', 'véieranzwanzeg', 'fënnefanzwanzeg', 'sechsanzwanzeg', 'siwenanzwanzeg', 'aachtanzwanzeg', 'nénganzwanzeg'];
  units.forEach((u, i) => assert.equal(N.numberCompound(u, 'zwanzeg'), expected[i]));
});

test('nombres à écrire de la leçon 5 : an devant d / n / a / z, a devant v / f / s', () => {
  assert.equal(N.numberCompound('aacht', 'drësseg'), 'aachtandrësseg');     // 38
  assert.equal(N.numberCompound('siwen', 'véierzeg'), 'siwenavéierzeg');     // 47
  assert.equal(N.numberCompound('sechs', 'fofzeg'), 'sechsafofzeg');         // 56
  assert.equal(N.numberCompound('fënnef', 'siechzeg'), 'fënnefasiechzeg');   // 65
  assert.equal(N.numberCompound('véier', 'siwwenzeg'), 'véierasiwwenzeg');   // 74
  assert.equal(N.numberCompound('dräi', 'achtzeg'), 'dräianachtzeg');        // 83
  assert.equal(N.numberCompound('zwee', 'nonzeg'), 'zweeannonzeg');          // 92
  assert.equal(N.numberCompound('néng', 'zwanzeg'), 'nénganzwanzeg');        // 29
});
