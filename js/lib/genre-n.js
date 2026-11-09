/*
 * Genre des noms et règle du n — générateur de questions et d'explications (navigateur + Node).
 * S'appuie sur js/lib/nrule.js (formes de référence tirées des documents du cours).
 *
 * Quatre types de questions :
 *   indef : en / e / eng       neg : keen / kee / keng       def : den / de / d'
 *   verb  : « Ech ___ ___ Stull. » — la forme de hunn (hunn / hu) ET l'article, donc le n deux fois.
 *
 * Chaque erreur est classée : « genre » (l'article d'un autre genre) ou « n » (bon genre, mauvais n).
 */
(function (root, factory) {
  var N = (typeof module === 'object' && module.exports) ? require('./nrule.js') : root.LetzNRule;
  var api = factory(N);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LetzGenre = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (N) {
  'use strict';

  var GENDER_LABEL = { m: 'masculin', f: 'féminin', n: 'neutre' };

  // Mots dont le genre n'est pas tranché (homonymes dans le dictionnaire) : jamais utilisés dans les questions.
  var DOUBTFUL_IDS = ['v126', 'v136', 'v147', 'v250', 'v255', 'v290'];

  // Familles d'articles : « mn » (masculin ou neutre), « f » (féminin), « m », « fn ».
  var FORMS = {
    indef: { all: ['e', 'en', 'eng'], cls: { e: 'mn', en: 'mn', eng: 'f' } },
    neg:   { all: ['kee', 'keen', 'keng'], cls: { kee: 'mn', keen: 'mn', keng: 'f' } },
    def:   { all: ['de', 'den', "d'"], cls: { de: 'm', den: 'm', "d'": 'fn' } }
  };

  function certainGender(item) {
    if (!item || DOUBTFUL_IDS.indexOf(item.id) !== -1) return null;
    return item.g === 'm' || item.g === 'f' || item.g === 'n' ? item.g : null;
  }

  // Types de questions possibles pour ce mot (vide : aucun exercice de genre ou de n).
  function kindsFor(item) {
    if (!item || DOUBTFUL_IDS.indexOf(item.id) !== -1) return [];
    if (certainGender(item)) return ['indef', 'neg', 'def', 'verb'];
    if (item.g === 'c') return ['indef', 'neg']; // « c » : masculin ou neutre, sans précision : seuls en/e et kee/keen sont sûrs
    return [];
  }

  function shuffle(list, rng) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rng() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }

  // Genre utilisé pour fabriquer la bonne réponse. « c » sans précision se comporte comme un masculin pour en/e et kee/keen.
  function workingGender(item) { return certainGender(item) || (item.g === 'c' ? 'm' : null); }

  function articleFor(kind, gender, noun) {
    if (kind === 'indef') return N.indefinite(gender, noun);
    if (kind === 'neg') return N.negative(gender, noun);
    return N.definite(gender, noun);
  }

  function upper(s) { return String(s).charAt(0).toUpperCase(); }

  function nLine(word, isNoun) {
    var keeps = N.keepsN(word);
    var L = upper(N.firstLetter(word) || word);
    var zoha = 'une lettre de UNITED ZOHA';
    return '« ' + word + ' » commence par ' + L + ' (' + (keeps ? zoha + ' : on garde le n)' : 'pas ' + zoha + ' : le n tombe)') + '.';
  }

  /* ---- Construction d'une question ---- */
  function question(item, kind, rng) {
    rng = rng || Math.random;
    var g = workingGender(item);
    var noun = item.lu;
    if (!g || !FORMS[kind === 'verb' ? 'neg' : kind]) return null;
    if (kind === 'verb') {
      // « Ech hunn en Dësch » ou « Ech hu kee Bic » : l'article choisi (indéfini ou négatif) puis la forme de hunn.
      var artKind = rng() < 0.5 ? 'indef' : 'neg';
      var art = articleFor(artKind, g, noun);
      var verb = N.applyN('hunn', art);
      var answer = verb + ' ' + art;
      var other = FORMS[artKind].all.filter(function (a) { return a !== art; });
      var wrongVerb = verb === 'hu' ? 'hunn' : 'hu';
      var cands = [wrongVerb + ' ' + art, verb + ' ' + other[0], verb + ' ' + other[1], wrongVerb + ' ' + other[0]];
      var opts = [answer];
      cands.forEach(function (c) { if (opts.indexOf(c) === -1 && opts.length < 4) opts.push(c); });
      return { kind: 'verb', artKind: artKind, itemId: item.id, noun: noun, fr: item.fr, gender: g, exact: certainGender(item) !== null,
               prompt: 'Ech ___ ___ ' + noun + '.', hint: artKind === 'neg' ? '« je n\'ai pas de ' + item.fr + ' »' : '« j\'ai un/une ' + item.fr + ' »',
               options: shuffle(opts, rng), answer: answer, phrase: 'Ech ' + answer + ' ' + noun + '.', art: art };
    }
    var correct = articleFor(kind, g, noun);
    var phrase = kind === 'def' ? N.join(correct, noun) : correct + ' ' + noun;
    var hints = { indef: '« un/une ' + item.fr + ' »', neg: '« pas de ' + item.fr + ' »', def: '« le/la ' + item.fr + ' »' };
    return { kind: kind, itemId: item.id, noun: noun, fr: item.fr, gender: g, exact: certainGender(item) !== null,
             prompt: '___ ' + noun, hint: hints[kind], options: shuffle(FORMS[kind].all, rng), answer: correct, phrase: phrase, art: correct };
  }

  function randomKind(item, rng) {
    var kinds = kindsFor(item);
    if (!kinds.length) return null;
    return kinds[Math.floor((rng || Math.random)() * kinds.length)];
  }

  /* ---- Explication de la bonne réponse ---- */
  function why(q) {
    var gl = GENDER_LABEL[q.gender];
    var noun = q.noun;
    var gPart = q.exact ? '« ' + noun + ' » est ' + gl + '. ' : '';
    if (q.kind === 'verb') {
      var artText = q.artKind === 'neg'
        ? (q.gender === 'f' ? 'féminin : keng' : 'masculin ou neutre : kee ou keen')
        : (q.gender === 'f' ? 'féminin : eng' : 'masculin ou neutre : en ou e');
      var first = '« ' + noun + ' » est ' + (q.exact ? gl : (q.gender === 'f' ? 'féminin' : 'masculin ou neutre')) + ' (' + artText + '). ';
      var keeps = N.keepsN(q.art);
      var second = '« ' + q.art + ' » commence par ' + upper(N.firstLetter(q.art)) + ' (' + (keeps ? 'une lettre de UNITED ZOHA' : 'pas une lettre de UNITED ZOHA') + ') : '
        + (keeps ? '« hunn » garde son n.' : '« hunn » devient « hu ».');
      return first + second;
    }
    if (q.kind === 'def') {
      if (q.gender === 'f' || q.gender === 'n') return gPart + 'Le ' + GENDER_LABEL[q.gender] + ' prend d\' : ' + q.phrase + '.';
      return gPart + 'Le masculin prend den ou de. ' + nLine(noun) + ' → ' + q.phrase + '.';
    }
    var fam = q.kind === 'indef' ? { f: 'eng', mn: 'en ou e' } : { f: 'keng', mn: 'keen ou kee' };
    if (q.gender === 'f') return gPart + 'Le féminin prend ' + fam.f + ', sans n à retirer : ' + q.phrase + '.';
    var who = q.exact ? gl : 'masculin ou neutre';
    return (q.exact ? gPart : '« ' + noun + ' » n\'est pas féminin. ') + 'Le ' + who + ' prend ' + fam.mn + '. ' + nLine(noun) + ' → ' + q.phrase + '.';
  }

  /* ---- Type d'erreur : 'genre' ou 'n' (null si bonne réponse) ---- */
  function classify(q, chosen) {
    if (chosen === q.answer) return null;
    function parts(s) { return q.kind === 'verb' ? { verb: s.split(' ')[0], art: s.split(' ')[1] } : { verb: null, art: s }; }
    var famKind = q.kind === 'verb' ? q.artKind : q.kind;
    var cls = FORMS[famKind].cls;
    var a = parts(q.answer), c = parts(chosen);
    if (cls[c.art] !== cls[a.art]) return 'genre';
    return 'n';
  }

  return {
    GENDER_LABEL: GENDER_LABEL, DOUBTFUL_IDS: DOUBTFUL_IDS, FORMS: FORMS,
    certainGender: certainGender, kindsFor: kindsFor, randomKind: randomKind, question: question, why: why, classify: classify
  };
});
