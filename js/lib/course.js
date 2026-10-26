/*
 * Module « Cours » — logique pure (navigateur + Node) : cartes de révision tirées des leçons, notation
 * des réponses saisies, files de révision espacée, exercices sur la règle du n.
 * Dépend de js/lib/nrule.js et js/lib/srs.js.
 *
 * Types de cartes : word (mot, avec son article), phrase, letter (nom d'une lettre), number (chiffre ↔ mot),
 * color (teinte ↔ nom), pair (contraire). Chaque carte se révise de deux façons :
 *   'prod'  : on voit la consigne (français, chiffre, teinte…) et on TAPE la réponse en luxembourgeois ;
 *   'recog' : on voit le luxembourgeois et on CHOISIT parmi 4 propositions.
 */
(function (root, factory) {
  var nrule, srs;
  if (typeof module === 'object' && module.exports) { nrule = require('./nrule.js'); srs = require('./srs.js'); }
  else { nrule = root.LetzNRule; srs = root; }
  var api = factory(nrule, srs);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LetzCourse = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (N, S) {
  'use strict';

  // ---------- utilitaires de texte ----------
  function straight(s) { return String(s == null ? '' : s).replace(/[’‘ʼ]/g, "'"); }
  function squeeze(s) { return straight(s).replace(/\s+/g, ' ').trim(); }
  function stripEndPunct(s) { return s.replace(/[\s.!?…]+$/, ''); }
  // Forme « pliée » : sans accents, sans majuscules, sans ponctuation.
  function fold(s) {
    return squeeze(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9' -]+/g, ' ').replace(/[' -]+/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function slug(s) { return fold(s).replace(/ /g, '-'); }

  // ---------- construction du cours ----------
  function wordAnswer(w) {
    if (w.g === 'm' || w.g === 'f' || w.g === 'n') return N.nounPhrase('indef', w.g, w.lu);
    return w.lu;
  }

  function normalizeLesson(raw) {
    var L = { id: raw.id, n: raw.n, date: raw.date, title: raw.title, summary: raw.summary, sources: raw.sources || [], sections: raw.sections || [] };
    L.words = (raw.words || []).map(function (t) { var o = t[3] || {}; return { lu: t[0], g: t[1], fr: t[2], cat: o.cat, pron: o.pron, note: o.note, ref: o.ref }; });
    L.phrases = (raw.phrases || []).map(function (t) { return { lu: t[0], fr: t[1], ctx: t[2], note: t[3] }; });
    L.letters = (raw.letters || []).map(function (t) { return { letter: t[0], name: t[1] }; });
    L.numbers = (raw.numbers || []).map(function (t) { return { n: t[0], lu: t[1] }; });
    L.colors = (raw.colors || []).map(function (t) { return { lu: t[0], fr: t[1], hex: t[2] }; });
    L.pairs = (raw.pairs || []).map(function (t) { return { a: t[0], b: t[1], frA: t[2], frB: t[3] }; });
    return L;
  }

  function cardsOf(L) {
    var cards = [], id = L.id;
    L.words.forEach(function (w) {
      cards.push({ id: id + ':w:' + slug(w.lu), kind: 'word', lessonId: id, lesson: L.n, lu: w.lu, g: w.g, fr: w.fr, pron: w.pron, note: w.note, cat: w.cat,
        answer: wordAnswer(w), bare: w.lu });
    });
    L.phrases.forEach(function (p) {
      cards.push({ id: id + ':p:' + slug(p.lu), kind: 'phrase', lessonId: id, lesson: L.n, lu: p.lu, fr: p.fr, ctx: p.ctx, note: p.note, answer: p.lu });
    });
    L.letters.forEach(function (l) {
      cards.push({ id: id + ':a:' + l.letter.codePointAt(0).toString(16), kind: 'letter', lessonId: id, lesson: L.n, letter: l.letter, name: l.name, answer: l.name });
    });
    L.numbers.forEach(function (x) {
      cards.push({ id: id + ':n:' + x.n, kind: 'number', lessonId: id, lesson: L.n, n: x.n, lu: x.lu, answer: x.lu });
    });
    L.colors.forEach(function (c) {
      cards.push({ id: id + ':k:' + slug(c.lu), kind: 'color', lessonId: id, lesson: L.n, lu: c.lu, fr: c.fr, hex: c.hex, answer: c.lu });
    });
    L.pairs.forEach(function (p) {
      cards.push({ id: id + ':x:' + slug(p.a) + '-' + slug(p.b), kind: 'pair', lessonId: id, lesson: L.n, lu: p.a, fr: p.frA, answer: p.b, frAnswer: p.frB });
      cards.push({ id: id + ':x:' + slug(p.b) + '-' + slug(p.a), kind: 'pair', lessonId: id, lesson: L.n, lu: p.b, fr: p.frB, answer: p.a, frAnswer: p.frA });
    });
    return cards;
  }

  function buildCourse(rawLessons) {
    var lessons = rawLessons.map(normalizeLesson).sort(function (a, b) { return a.n - b.n; });
    var cards = [], byId = {}, lessonById = {};
    lessons.forEach(function (L) {
      lessonById[L.id] = L;
      cardsOf(L).forEach(function (c) {
        if (byId[c.id]) throw new Error('Carte en double : ' + c.id);
        byId[c.id] = c; cards.push(c);
      });
    });
    return { lessons: lessons, cards: cards, byId: byId, lessonById: lessonById };
  }

  // ---------- consignes ----------
  // Renvoie { label, text, swatch?, hint?, expected, options? } pour une carte et un mode.
  function promptFor(card, mode) {
    var p;
    switch (card.kind) {
      case 'word':
        p = mode === 'prod' ? { label: 'Écris en luxembourgeois (avec l’article)', text: card.fr } : { label: 'Que veut dire… ?', text: card.answer };
        break;
      case 'phrase':
        p = mode === 'prod' ? { label: 'Écris en luxembourgeois', text: card.fr } : { label: 'Que veut dire… ?', text: card.lu };
        break;
      case 'letter':
        p = mode === 'prod' ? { label: 'Comment s’appelle cette lettre ?', text: card.letter } : { label: 'Quelle lettre se dit… ?', text: card.name };
        break;
      case 'number':
        p = mode === 'prod' ? { label: 'Écris ce nombre en lettres', text: String(card.n) } : { label: 'Quel nombre est-ce ?', text: card.lu };
        break;
      case 'color':
        p = mode === 'prod' ? { label: 'Quelle est cette couleur ? (en luxembourgeois)', text: '', swatch: card.hex } : { label: 'Quelle est cette couleur ?', text: '', swatch: card.hex };
        break;
      case 'pair':
        p = { label: 'Quel est le contraire ?', text: card.lu, hint: card.fr };
        break;
      default: p = { label: '', text: '' };
    }
    if (mode === 'recog') p.expected = recogAnswer(card); else p.expected = card.answer;
    p.mode = mode;
    return p;
  }

  // Réponse attendue en mode « choix ».
  function recogAnswer(card) {
    switch (card.kind) {
      case 'word': case 'phrase': return card.fr;
      case 'letter': return card.letter;
      case 'number': return String(card.n);
      case 'color': return card.lu;
      case 'pair': return card.answer;
      default: return card.answer;
    }
  }

  function modesFor(card) { return ['prod', 'recog']; }

  // ---------- notation d'une réponse saisie ----------
  // 'correct' : exact (casse comprise, ponctuation finale ignorée) ; 'almost' : même texte à l'accent,
  // la casse ou la ponctuation près, ou le mot sans son article ; 'wrong' sinon.
  function gradeTyped(card, input) {
    var expected = card.answer;
    var a = stripEndPunct(squeeze(input)), e = stripEndPunct(squeeze(expected));
    if (a === '') return { status: 'wrong', expected: expected, hint: 'empty' };
    if (a === e) return { status: 'correct', expected: expected };
    if (fold(a) === fold(e)) return { status: 'almost', expected: expected, hint: 'spelling' };
    if (card.kind === 'word' && card.bare && fold(a) === fold(card.bare)) return { status: 'almost', expected: expected, hint: 'article' };
    return { status: 'wrong', expected: expected };
  }

  // ---------- propositions (mode « choix ») ----------
  function shuffle(arr, rng) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rng() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }

  function choicesFor(card, course, rng, count) {
    rng = rng || Math.random; count = count || 4;
    var correct = recogAnswer(card);
    var same = course.cards.filter(function (c) { return c.kind === card.kind && c.id !== card.id; });
    var near = same.filter(function (c) { return c.lessonId === card.lessonId; });
    var pool = shuffle(near, rng).concat(shuffle(same.filter(function (c) { return c.lessonId !== card.lessonId; }), rng));
    var seen = {}; seen[fold(correct)] = true;
    var opts = [correct];
    for (var i = 0; i < pool.length && opts.length < count; i++) {
      var o = recogAnswer(pool[i]);
      if (!seen[fold(o)]) { seen[fold(o)] = true; opts.push(o); }
    }
    return shuffle(opts, rng);
  }

  // ---------- révision espacée ----------
  function newEntry() { return { box: 1, dueAt: 0, learningStep: 0 }; }

  // Applique une réponse (juste ou fausse) à la progression ; renvoie { entry, requeueGap }.
  function answerCard(progress, cardId, correct, now) {
    var e = progress[cardId] || (progress[cardId] = newEntry());
    var res = S.applyAnswerToEntry(e, correct, { now: now, kind: 'normal' });
    e.updatedAt = now;
    return { entry: e, requeueGap: res.requeueGap };
  }

  function isDue(entry, now) { return !!entry && S.isDueEntry(entry, now); }

  // File d'une session : cartes dues d'abord (les boîtes basses en premier), puis des cartes jamais vues.
  // opts : { lessons: [ids] (défaut : toutes), now, size (défaut 20), newLimit (défaut 10) }
  function buildQueue(course, progress, opts) {
    opts = opts || {};
    var now = opts.now == null ? Date.now() : opts.now, size = opts.size || 20, newLimit = opts.newLimit == null ? 10 : opts.newLimit;
    var allowed = opts.lessons ? opts.lessons.reduce(function (m, id) { m[id] = true; return m; }, {}) : null;
    var pool = course.cards.filter(function (c) { return !allowed || allowed[c.lessonId]; });
    var due = pool.filter(function (c) { return progress[c.id] && isDue(progress[c.id], now); })
      .sort(function (a, b) { return (progress[a.id].box - progress[b.id].box) || (progress[a.id].dueAt - progress[b.id].dueAt); });
    var fresh = pool.filter(function (c) { return !progress[c.id]; });
    var queue = due.slice(0, size);
    var room = Math.max(0, Math.min(newLimit, size - queue.length));
    return queue.concat(fresh.slice(0, room));
  }

  function lessonStats(course, progress, now) {
    var out = {};
    course.lessons.forEach(function (L) { out[L.id] = { total: 0, seen: 0, mastered: 0, due: 0 }; });
    course.cards.forEach(function (c) {
      var s = out[c.lessonId], e = progress[c.id];
      s.total++;
      if (e) {
        s.seen++;
        if (e.box >= 4 && e.learningStep === undefined) s.mastered++;
        if (isDue(e, now)) s.due++;
      }
    });
    return out;
  }

  // ---------- exercices sur la règle du n ----------
  var NAMES = { m: ['Antoine', 'David', 'Julien', 'Remy', 'Adrien', 'Sébastien', 'Bertrand', 'Jérémie'], f: ['Aurélie', 'Cecile', 'Marie'] };

  // Formes longues/courtes à placer devant un mot : [forme longue, mot suivant, gabarit avec ___, leçon].
  var PHRASE_DRILLS = [
    ['Gudden', 'Moien', '___ Moien !', 1], ['Gudden', 'Mëtteg', '___ Mëtteg !', 1], ['Gudden', 'Owend', '___ Owend !', 1],
    ['Mäin', 'Virnumm', '___ Virnumm ass Remy.', 1], ['Mäin', 'Familljennumm', '___ Familljennumm ass Weber.', 1], ['Mäin', 'Numm', '___ Numm ass Pol Weber.', 1],
    ['Ären', 'Virnumm', 'Wéi ass ___ Virnumm ?', 1], ['Ären', 'Numm', 'Wéi ass ___ Numm ?', 1], ['däin', 'Virnumm', 'Wéi ass ___ Virnumm ?', 1], ['däin', 'Familljennumm', 'Wéi ass ___ Familljennumm ?', 1],
    ['An', 'Dir', '___ Dir ?', 1], ['An', 'du', '___ du ?', 1], ['An', 'wie', '___ wie bass du ?', 1],
    ['sinn', 'krank', 'Ech ___ krank.', 1], ['sinn', 'midd', 'Ech ___ midd.', 1], ['sinn', 'futti', 'Ech ___ futti.', 1],
    ['hunn', 'd’Flemm', 'Ech ___ d’Flemm.', 1], ['hunn', 'Honger', 'Ech ___ Honger an Duuscht.', 2],
    ['hunn', 'kee', 'Nee, ech ___ kee Problem.', 3], ['hunn', 'e', 'Jo, ech ___ e Problem.', 3], ['hunn', 'keen', 'Nee, ech ___ keen Auto.', 3], ['hunn', 'en', 'Jo, ech ___ en Auto.', 3],
    ['hien', 'wëll', '___ wëll eng Taass Kaffi.', 2], ['hien', 'brauch', '___ brauch e Buch.', 3],
  ];

  function reasonFor(next, keeps) {
    var c = N.firstLetter(next).toUpperCase();
    return keeps ? c + ' fait partie de UNITED ZOHA : on garde le n.' : c + ' ne fait pas partie de UNITED ZOHA : le n tombe.';
  }

  function makeQuestion(prompt, optionsOrdered, answer, nextWord, extra) {
    var keeps = N.keepsN(nextWord);
    var q = { prompt: prompt, options: optionsOrdered, answer: answer, next: nextWord, explanation: reasonFor(nextWord, keeps) };
    if (extra) Object.keys(extra).forEach(function (k) { q[k] = extra[k]; });
    return q;
  }

  // Toutes les questions possibles pour les leçons données (null = toutes), avant tirage.
  function allNRuleQuestions(course, lessonIds) {
    var allowed = lessonIds ? lessonIds.reduce(function (m, id) { m[id] = true; return m; }, {}) : null;
    var qs = [];
    course.lessons.forEach(function (L) {
      if (allowed && !allowed[L.id]) return;
      L.words.forEach(function (w) {
        if (w.g === 'm' || w.g === 'n') {
          qs.push(makeQuestion('___ ' + w.lu, ['en', 'e'], N.indefinite(w.g, w.lu), w.lu, { kind: 'indef', full: N.nounPhrase('indef', w.g, w.lu), fr: w.fr, g: w.g }));
          qs.push(makeQuestion('Nee, dat ass ___ ' + w.lu + '.', ['keen', 'kee'], N.negative(w.g, w.lu), w.lu, { kind: 'neg', full: N.nounPhrase('neg', w.g, w.lu), fr: w.fr, g: w.g }));
        }
        if ((w.g === 'm' || w.g === 'f' || w.g === 'n') && w.cat === 'Objets') {
          qs.push(makeQuestion('___' + (w.g === 'm' ? ' ' : '') + w.lu + ' ass rout.', ['den', 'de', 'd’'], w.g === 'm' ? N.definite('m', w.lu) : 'd’', w.lu, { kind: 'def', full: N.nounPhrase('def', w.g, w.lu), fr: w.fr, g: w.g,
            explanation: w.g === 'm' ? reasonFor(w.lu, N.keepsN(w.lu)) : 'Au féminin et au neutre : toujours d’.' }));
        }
      });
    });
    var firstLesson = course.lessons[0] ? course.lessons[0].n : 1;
    var maxN = Math.max.apply(null, course.lessons.filter(function (L) { return !allowed || allowed[L.id]; }).map(function (L) { return L.n; }).concat([0]));
    if (maxN >= firstLesson) {
      NAMES.m.forEach(function (name) { qs.push(makeQuestion('Ech sinn ___ ' + name + '.', ['den', 'de', 'd’'], N.definite('m', name), name, { kind: 'name', full: N.nounPhrase('def', 'm', name) })); });
      NAMES.f.forEach(function (name) { qs.push(makeQuestion('Ech sinn ___' + name + '.', ['den', 'de', 'd’'], 'd’', name, { kind: 'name', full: N.nounPhrase('def', 'f', name), explanation: 'Un prénom féminin : d’.' })); });
    }
    PHRASE_DRILLS.forEach(function (d) {
      var lesson = course.lessons.filter(function (L) { return L.n === d[3]; })[0];
      if (!lesson || (allowed && !allowed[lesson.id])) return;
      var short = N.SHORT[d[0].toLowerCase()];
      var shortForm = d[0].charAt(0) === d[0].charAt(0).toUpperCase() ? short.charAt(0).toUpperCase() + short.slice(1) : short;
      qs.push(makeQuestion(d[2], [d[0], shortForm], N.applyN(d[0], d[1]), d[1], { kind: 'phrase' }));
    });
    return qs;
  }

  function nruleQuestions(course, count, rng, lessonIds) {
    rng = rng || Math.random;
    var pool = shuffle(allNRuleQuestions(course, lessonIds), rng);
    return pool.slice(0, count || 10).map(function (q) { return Object.assign({}, q, { options: shuffle(q.options, rng) }); });
  }

  return {
    fold: fold, slug: slug, straight: straight, wordAnswer: wordAnswer,
    normalizeLesson: normalizeLesson, buildCourse: buildCourse,
    promptFor: promptFor, recogAnswer: recogAnswer, modesFor: modesFor, gradeTyped: gradeTyped, choicesFor: choicesFor,
    newEntry: newEntry, answerCard: answerCard, isDue: isDue, buildQueue: buildQueue, lessonStats: lessonStats,
    allNRuleQuestions: allNRuleQuestions, nruleQuestions: nruleQuestions, PHRASE_DRILLS: PHRASE_DRILLS,
  };
});
