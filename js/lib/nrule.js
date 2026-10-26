/*
 * Règle du n (« UNITED ZOHA ») — logique pure, utilisable dans le navigateur et dans Node.
 *
 * Un n final (en, keen, den, an, Gudden, mäin, hunn…) se garde seulement devant un mot qui commence
 * par a, e, i, o, u, d, h, n, t, z (accents ignorés : é, ë, ä… comptent comme e, a). Devant toute
 * autre lettre il tombe : e Stull, kee Bic, de Remy, a wie, Gudde Moien, hu kee Bic.
 * En fin de phrase, ou devant un mot sans lettre (chiffre), on garde la forme longue.
 *
 * Toutes les formes de référence viennent des documents du cours (tests/nrule.test.js).
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LetzNRule = api; // un espace de noms : join, definite… sont trop génériques pour le global
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var ZOHA_LETTERS = 'aeiouhdntz';

  // Forme longue (minuscule) → forme courte (devant un mot qui ne commence pas par une lettre de ZOHA).
  var SHORT = {
    en: 'e', keen: 'kee', den: 'de', an: 'a', hien: 'hie', wien: 'wie',
    'mäin': 'mäi', 'däin': 'däi', 'säin': 'säi', 'ären': 'äre', gudden: 'gudde',
    hunn: 'hu', sinn: 'si', 'wëllen': 'wëlle', brauchen: 'brauche',
  };

  function firstLetter(word) {
    var s = String(word == null ? '' : word).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/^[^a-z]+/, '');
    return s.charAt(0);
  }

  // Le mot suivant impose-t-il de garder le n ?
  function keepsN(nextWord) {
    var c = firstLetter(nextWord);
    return c === '' ? true : ZOHA_LETTERS.indexOf(c) !== -1;
  }

  function matchCase(model, word) {
    return model.charAt(0) !== model.charAt(0).toLowerCase() ? word.charAt(0).toUpperCase() + word.slice(1) : word;
  }

  // Applique la règle à une forme longue connue (en, keen, den, an, Gudden, mäin, hunn…).
  function applyN(longForm, nextWord) {
    var short = SHORT[String(longForm).toLowerCase()];
    if (!short || keepsN(nextWord)) return longForm;
    return matchCase(longForm, short);
  }

  // « d' » ne se sépare pas du mot suivant ; les autres articles prennent une espace.
  function join(article, rest) {
    return article.slice(-1) === "'" ? article + rest : article + ' ' + rest;
  }

  // Articles. gender : 'm' | 'f' | 'n' ; pluriel : 'pl'.
  function indefinite(gender, nextWord) {
    if (gender === 'f') return 'eng';
    if (gender === 'pl') return '';
    return applyN('en', nextWord);
  }
  function negative(gender, nextWord) {
    if (gender === 'f') return 'keng';
    if (gender === 'pl') return 'keng';
    return applyN('keen', nextWord);
  }
  function definite(gender, nextWord) {
    if (gender === 'm') return applyN('den', nextWord);
    return "d'";
  }

  // Groupe nominal sans adjectif : « en Dësch », « eng Auer », « d'Haus », « de Stull ».
  function nounPhrase(kind, gender, noun) {
    var art = kind === 'indef' ? indefinite(gender, noun) : kind === 'neg' ? negative(gender, noun) : definite(gender, noun);
    return art ? join(art, noun) : noun;
  }

  // Radicaux irréguliers de l'adjectif devant la terminaison -e du masculin (rout → roude).
  var MASC_STEM = { rout: 'roud' };

  // Accord de l'adjectif après l'article indéfini : masculin + e(n), féminin ∅, neutre + t, pluriel ∅.
  // Le n de la terminaison suit la règle selon le NOM ; celui de l'article suit l'ADJECTIF.
  function adjectiveForm(adjective, gender, noun) {
    var adj = String(adjective);
    if (gender === 'm') return (MASC_STEM[adj] || adj) + 'e' + (keepsN(noun) ? 'n' : '');
    if (gender === 'n') return /t$/.test(adj) ? adj : adj + 't';
    return adj;
  }

  // « un bic bleu » → « e bloe Bic ».
  function indefiniteWithAdjective(gender, adjective, noun) {
    var adj = adjectiveForm(adjective, gender, noun);
    var art = indefinite(gender, adj);
    return (art ? art + ' ' : '') + adj + ' ' + noun;
  }

  // Nombres composés 21–99 : unité + an/a + dizaine (eent devient een). « an » suit la règle selon la dizaine.
  function numberCompound(unit, tens) {
    var u = unit === 'eent' ? 'een' : unit;
    return u + applyN('an', tens) + tens;
  }

  return {
    ZOHA_LETTERS: ZOHA_LETTERS, SHORT: SHORT,
    firstLetter: firstLetter, keepsN: keepsN, applyN: applyN, join: join,
    indefinite: indefinite, negative: negative, definite: definite, nounPhrase: nounPhrase,
    adjectiveForm: adjectiveForm, indefiniteWithAdjective: indefiniteWithAdjective, numberCompound: numberCompound,
  };
});
