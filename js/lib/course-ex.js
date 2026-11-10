/*
 * Module « Cours » : formats d'exercices variés — logique pure (navigateur + Node).
 * Dépend de js/lib/course.js (LetzCourse) et js/lib/nrule.js (LetzNRule).
 *
 * Formats :
 *   recog   : on voit le luxembourgeois, on choisit le français            (existant)
 *   typed   : on voit la consigne, on tape la réponse                      (existant)
 *   reverse : on voit le français, on choisit le luxembourgeois            (nouveau)
 *   cloze   : phrase à trous — un article, un n ou un mot-clé à retrouver  (nouveau)
 *   order   : remettre les mots d'une phrase courte dans l'ordre           (nouveau)
 *   reply   : choisir la bonne réplique dans un mini-dialogue du cours     (nouveau, hors révision espacée)
 */
(function (root, factory) {
  var C, N;
  if (typeof module === 'object' && module.exports) { C = require('./course.js'); N = require('./nrule.js'); }
  else { C = root.LetzCourse; N = root.LetzNRule; }
  var api = factory(C, N);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LetzCourseEx = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (C, N) {
  'use strict';

  function shuffle(arr, rng) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rng() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function pickOne(arr, rng) { return arr[Math.floor(rng() * arr.length)]; }
  var fold = C.fold;

  // Texte brut d'une ligne de leçon : « {m|Äre} Virnumm » → « Äre Virnumm ».
  function plain(s) { return C.straight(String(s == null ? '' : s)).replace(/\{[a-z]+\|([^}]*)\}/g, '$1').replace(/\s+/g, ' ').trim(); }

  /* ---------- Sens inverse : français → luxembourgeois ---------- */
  function reverseSupported(card) { return card.kind === 'word' || card.kind === 'phrase' || card.kind === 'color' || card.kind === 'pair'; }

  function reverseChoices(card, course, rng, count) {
    count = count || 4;
    var correct = card.answer;
    var same = course.cards.filter(function (c) { return c.kind === card.kind && c.id !== card.id && fold(c.answer) !== fold(correct); });
    // Les plus proches d'abord : même genre (mots), même registre (phrases), longueur voisine ; un peu de hasard pour varier.
    var scored = same.map(function (c) {
      var s = Math.abs(fold(c.answer).length - fold(correct).length);
      if (card.kind === 'word' && c.g === card.g) s -= 4;
      if (card.kind === 'phrase' && c.ctx === card.ctx) s -= 3;
      if (c.lessonId === card.lessonId) s -= 1;
      return { c: c, s: s + rng() * 3 };
    }).sort(function (a, b) { return a.s - b.s; });
    var seen = {}; seen[fold(correct)] = true;
    var opts = [correct];
    for (var i = 0; i < scored.length && opts.length < count; i++) {
      var o = scored[i].c.answer;
      if (!seen[fold(o)]) { seen[fold(o)] = true; opts.push(o); }
    }
    return shuffle(opts, rng);
  }

  /* ---------- Phrase à trous ---------- */
  // Familles de formes : l'article ou le verbe qui change selon le genre ou la règle du n.
  var FAMILIES = [
    ['en', 'e', 'eng'], ['keen', 'kee', 'keng'], ['den', 'de', "d'"],
    ['mäin', 'mäi'], ['däin', 'däi'], ['ären', 'äre'], ['hunn', 'hu'], ['sinn', 'si'], ['wien', 'wie'], ['an', 'a'], ['gudden', 'gudde']
  ];
  // Mots de remplissage quand une famille a moins de trois formes : de la même nature que la bonne réponse.
  var PADDING = {
    mäin: ['däin', 'däi'], däin: ['mäin', 'mäi'], ären: ['mäin', 'däin'],
    hunn: ['sinn', 'si'], sinn: ['hunn', 'hu'], wien: ['wat', 'wou'], an: ['en', 'e'], gudden: ['mäin', 'däin']
  };

  function tokenize(text) {
    var t = C.straight(text).replace(/\s+/g, ' ').trim();
    return t ? t.split(' ') : [];
  }
  // Mot nu d'un jeton : sans ponctuation autour.
  function bare(tok) { return tok.replace(/^[^A-Za-zÀ-ÿ']+|[^A-Za-zÀ-ÿ']+$/g, ''); }
  function familyOf(word) {
    var w = word.toLowerCase();
    for (var i = 0; i < FAMILIES.length; i++) if (FAMILIES[i].indexOf(w) !== -1) return FAMILIES[i];
    return null;
  }
  function matchCase(model, word) { return model.charAt(0) !== model.charAt(0).toLowerCase() ? word.charAt(0).toUpperCase() + word.slice(1) : word; }

  // Explication de la règle du n pour le mot à trouver (null si la famille n'en dépend pas).
  function clozeWhy(family, answerWord, nextWord) {
    var a = answerWord.toLowerCase();
    if (family === FAMILIES[0] || family === FAMILIES[1] || family === FAMILIES[2]) {
      if (a === 'eng' || a === 'keng') return 'Féminin : ' + a + ', sans n à retirer.';
      if (a === "d'") return 'Féminin ou neutre : d\'.';
    }
    if (!nextWord) return null;
    var keeps = N.keepsN(nextWord);
    var L = (N.firstLetter(nextWord) || nextWord.charAt(0)).toUpperCase();
    return '« ' + bare(nextWord) + ' » commence par ' + L + (keeps ? ' (UNITED ZOHA) : on garde le n.' : ' (pas UNITED ZOHA) : le n tombe.');
  }

  function clozeFor(card, course, rng) {
    if (card.kind !== 'phrase') return null;
    var tokens = tokenize(card.lu);
    if (tokens.length < 3) return null;
    // 1. un article ou un verbe sensible à la règle du n
    var spots = [];
    tokens.forEach(function (tok, i) { if (i > 0 || tokens.length > 3) { var f = familyOf(bare(tok)); if (f) spots.push({ i: i, f: f }); } });
    var spot, options, answerWord, why = null;
    if (spots.length) {
      spot = pickOne(spots, rng);
      answerWord = bare(tokens[spot.i]);
      var members = spot.f.slice();
      var padKey = spot.f[0];
      var pad = shuffle((PADDING[padKey] || ['net', 'och']).filter(function (p) { return members.map(fold).indexOf(fold(p)) === -1; }), rng);
      while (members.length < 3 && pad.length) members.push(pad.shift());
      // Majuscule : les choix s'écrivent comme la bonne réponse (« Ären » est toujours en majuscule, sinon la casse trahirait la réponse).
      var capAll = /^[A-ZÄËÉÖÜ]/.test(answerWord);
      var caseFor = function (m) { return capAll ? m.charAt(0).toUpperCase() + m.slice(1) : m; };
      options = members.map(function (m) { return fold(m) === fold(answerWord) ? answerWord : caseFor(m); });
      var nxt = tokens[spot.i + 1];
      why = clozeWhy(spot.f, answerWord, nxt);
    } else {
      // 2. sinon, le mot le plus long (hors premier mot), à choisir parmi des mots voisins du cours
      var cand = tokens.map(function (tok, i) { return { i: i, w: bare(tok) }; }).filter(function (x) { return x.i > 0 && x.w.length >= 4; });
      if (!cand.length) return null;
      cand.sort(function (a, b) { return b.w.length - a.w.length; });
      spot = cand[0];
      answerWord = spot.w;
      var seen = {}; seen[fold(answerWord)] = true;
      var pool = [];
      course.cards.forEach(function (c) {
        if (c.id === card.id || (c.kind !== 'phrase' && c.kind !== 'word')) return;
        tokenize(c.lu).forEach(function (t) {
          var w = bare(t);
          if (w.length < 3 || Math.abs(w.length - answerWord.length) > 2 || /[-']/.test(w)) return;
          var lowerW = w.charAt(0) === w.charAt(0).toLowerCase(), lowerA = answerWord.charAt(0) === answerWord.charAt(0).toLowerCase();
          if (lowerW === lowerA) pool.push({ w: w, near: c.lessonId === card.lessonId ? 0 : 1 });
        });
      });
      pool = shuffle(pool, rng).sort(function (a, b) { return a.near - b.near; }).map(function (x) { return x.w; });
      options = [answerWord];
      pool.forEach(function (w) { if (options.length < 4 && !seen[fold(w)]) { seen[fold(w)] = true; options.push(w); } });
      if (options.length < 3) return null;
    }
    var blanked = tokens.slice();
    var tok = tokens[spot.i], w = bare(tok);
    blanked[spot.i] = tok.replace(w, '___');
    return { type: 'cloze', cardId: card.id, prompt: { label: 'Complète la phrase', text: blanked.join(' '), hint: card.fr + (card.ctx ? ' (' + card.ctx + ')' : '') }, options: shuffle(options, rng),
             answer: answerWord, full: card.lu, why: why, hidesGender: !!spots.length };
  }

  /* ---------- Phrase à remettre dans l'ordre ---------- */
  function orderFor(card, rng) {
    if (card.kind !== 'phrase') return null;
    var tokens = tokenize(card.lu);
    if (tokens.length < 3 || tokens.length > 8) return null;
    var shuffled = tokens, tries = 0;
    do { shuffled = shuffle(tokens, rng); tries++; } while (shuffled.join(' ') === tokens.join(' ') && tries < 6);
    if (shuffled.join(' ') === tokens.join(' ')) return null;
    return { type: 'order', cardId: card.id, prompt: { label: 'Remets les mots dans l\'ordre', text: card.fr, hint: card.ctx ? card.ctx : '' },
             tokens: shuffled, answer: tokens.join(' '), full: card.lu };
  }
  function gradeOrder(ex, picked) {
    var got = fold(picked.join(' ')), want = fold(ex.answer);
    return got === want ? 'correct' : 'wrong';
  }

  /* ---------- Mini-dialogues : choisir la bonne réplique ---------- */
  function dialogueQuestions(course, lessonIds, rng) {
    var allowed = lessonIds ? lessonIds.reduce(function (m, id) { m[id] = true; return m; }, {}) : null;
    var learnerLines = [], items = [];
    course.lessons.forEach(function (L) {
      if (allowed && !allowed[L.id]) return;
      (L.sections || []).forEach(function (sec) {
        if (sec.type !== 'dialogue' || !sec.lines) return;
        sec.lines.forEach(function (ln, i) {
          if (i === 0 || ln[0] === sec.lines[i - 1][0]) return;
          var reply = plain(ln[1]);
          learnerLines.push(reply);
          items.push({ lessonId: L.id, title: sec.title, speaker: ln[0], said: plain(sec.lines[i - 1][1]), who: sec.lines[i - 1][0], reply: reply });
        });
      });
    });
    return items.map(function (it) {
      var seen = {}; seen[fold(it.reply)] = true;
      var opts = [it.reply];
      shuffle(learnerLines, rng).forEach(function (l) { if (opts.length < 4 && !seen[fold(l)]) { seen[fold(l)] = true; opts.push(l); } });
      if (opts.length < 3) return null;
      return { type: 'reply', cardId: null, lessonId: it.lessonId, prompt: { label: 'Que répondre ?', text: it.said, hint: it.title.replace(/^Dialog\s*«[^»]*»\s*—?\s*/, '') || it.title },
               options: shuffle(opts, rng), answer: it.reply, full: it.reply, promptLu: true, optionsLu: true };
    }).filter(Boolean);
  }

  // Genre d'un mot du cours à partir de sa réponse (« e Stull » → 'm') ; null si inconnu.
  function genderOfAnswer(course, answer) {
    for (var i = 0; i < course.cards.length; i++) {
      var c = course.cards[i];
      if (c.kind === 'word' && c.answer === answer && (c.g === 'm' || c.g === 'f' || c.g === 'n')) return c.g;
    }
    return null;
  }
  function wordGender(card) { return card.kind === 'word' && (card.g === 'm' || card.g === 'f' || card.g === 'n') ? card.g : null; }

  /* ---------- Genre des noms à l'intérieur des phrases ---------- */
  // Table nom → genre, tirée des mots du cours et du vocabulaire (genres sûrs seulement). Un mot dont les deux sources
  // ne s'accordent pas, ou qui n'est pas un nom à majuscule seul, n'est pas colorié.
  function buildNounGenders(course, vocab) {
    var map = {}, amb = {};
    function add(lu, g) {
      if (!lu || !/^[A-ZÄËÉÖÜ]/.test(lu) || /\s/.test(lu) || (g !== 'm' && g !== 'f' && g !== 'n')) return;
      if (map[lu] && map[lu] !== g) amb[lu] = true;
      map[lu] = g;
    }
    course.cards.forEach(function (c) { if (c.kind === 'word') add(c.lu, c.g); });
    (vocab || []).forEach(function (v) { add(v.lu, v.g); });
    Object.keys(amb).forEach(function (k) { delete map[k]; });
    return map;
  }

  // Découpe une phrase en morceaux { t: texte, g: 'm'|'f'|'n'|null } ; un nom connu (avec ou sans « d' ») porte son genre,
  // la ponctuation autour reste neutre. Le texte d'origine est conservé tel quel.
  function phraseSegments(text, map) {
    var out = [];
    String(text == null ? '' : text).split(/(\s+)/).forEach(function (tok) {
      if (!tok) return;
      if (/^\s+$/.test(tok)) { out.push({ t: tok, g: null }); return; }
      var m = /^([^A-Za-zÀ-ÿ'’]*)(.*?)([^A-Za-zÀ-ÿ'’]*)$/.exec(tok);
      var lead = m[1], core = m[2], trail = m[3];
      var noun = C.straight(core).replace(/^[dD]'/, '');
      var g = noun && map && map[noun] ? map[noun] : null;
      if (!g) { out.push({ t: tok, g: null }); return; }
      if (lead) out.push({ t: lead, g: null });
      out.push({ t: core, g: g });
      if (trail) out.push({ t: trail, g: null });
    });
    return out;
  }

  /* ---------- Choix du format pour une carte ---------- */
  // lastType : format de la carte précédente (on évite deux fois de suite le même).
  function exerciseFor(card, course, progress, rng, lastType) {
    rng = rng || Math.random;
    var entry = progress && progress[card.id];
    var box = entry ? (entry.box || 1) : 0;
    var learned = box >= 2;
    var kinds;
    switch (card.kind) {
      case 'word':   kinds = learned ? ['reverse', 'typed', 'recog'] : ['recog', 'reverse']; break;
      case 'phrase': kinds = learned ? ['cloze', 'order', 'reverse', 'typed'] : ['recog', 'reverse', 'cloze']; break;
      case 'pair':   kinds = ['typed', 'reverse']; break;
      case 'color':  kinds = learned ? ['typed', 'reverse', 'recog'] : ['recog', 'reverse']; break;
      default:       kinds = learned ? ['typed', 'recog'] : ['recog']; // lettres, nombres
    }
    var order = shuffle(kinds, rng);
    if (lastType && order.length > 1 && order[0] === lastType) order.push(order.shift());
    for (var i = 0; i < order.length; i++) {
      var k = order[i], ex = null;
      if (k === 'recog') {
        var rp = C.promptFor(card, 'recog');
        ex = { type: 'recog', cardId: card.id, prompt: rp, options: C.choicesFor(card, course, rng, 4), answer: C.recogAnswer(card), full: C.recogAnswer(card), promptG: wordGender(card), promptLu: card.kind === 'phrase' };
      } else if (k === 'typed') {
        ex = { type: 'typed', cardId: card.id, prompt: C.promptFor(card, 'prod'), answer: card.answer, full: card.answer, answerG: wordGender(card) };
      } else if (k === 'reverse' && reverseSupported(card)) {
        var base = C.promptFor(card, 'prod');
        ex = { type: 'reverse', cardId: card.id, prompt: card.kind === 'pair' ? C.promptFor(card, 'recog') : { label: base.label.replace('Écris en luxembourgeois (avec l’article)', 'Comment dit-on… ?').replace('Écris en luxembourgeois', 'Comment dit-on… ?'), text: base.text, swatch: base.swatch, hint: card.ctx || '' },
               options: reverseChoices(card, course, rng, 4), answer: card.answer, full: card.answer, answerG: wordGender(card) };
        ex.optionGenders = card.kind === 'word' ? ex.options.map(function (o) { return genderOfAnswer(course, o); }) : null;
        ex.optionsLu = card.kind === 'phrase';
      } else if (k === 'cloze') ex = clozeFor(card, course, rng);
      else if (k === 'order') ex = orderFor(card, rng);
      if (ex) return ex;
    }
    // Repli : le format d'origine
    return { type: 'recog', cardId: card.id, prompt: C.promptFor(card, 'recog'), options: C.choicesFor(card, course, rng, 4), answer: C.recogAnswer(card), full: C.recogAnswer(card), promptG: wordGender(card), promptLu: card.kind === 'phrase' };
  }

  return { plain: plain, tokenize: tokenize, reverseChoices: reverseChoices, clozeFor: clozeFor, orderFor: orderFor, gradeOrder: gradeOrder,
           dialogueQuestions: dialogueQuestions, exerciseFor: exerciseFor, buildNounGenders: buildNounGenders, phraseSegments: phraseSegments, genderOfAnswer: genderOfAnswer, FAMILIES: FAMILIES };
});
