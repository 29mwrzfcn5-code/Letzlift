/*
 * Parcours « de village en village » et bandeau de la semaine — logique pure (navigateur + Node).
 * Aucune dépendance. Les étapes sont des repères d'avancement, pas du contenu pédagogique :
 * on les franchit en voyant des mots (1 mot pour Schengen, puis 25 %, 50 %, 75 % et 100 % du vocabulaire).
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else Object.assign(root, api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var JOURNEY_STOPS = ['Schengen', 'Vianden', 'Echternach', 'Clervaux', 'Luxembourg-Ville'];
  var JOURNEY_FRACTIONS = [0, 0.25, 0.5, 0.75, 1];
  var GAMES_UNLOCK_WORDS = 20; // mots vus avant d'ouvrir les mini-jeux

  function stopThreshold(i, total) {
    if (i === 0) return 1;
    return Math.max(2, Math.round(JOURNEY_FRACTIONS[i] * total));
  }

  /*
   * seen : mots déjà vus, total : taille du vocabulaire.
   * Renvoie { reached, stops:[{name,state:'done'|'current'|'todo'}], from, to, finished, pct, wordsToNext }.
   * reached = nombre d'étapes franchies (0 à 5). from = dernière étape franchie (null au départ),
   * to = prochaine étape (null une fois le tour terminé).
   */
  function journeyState(seen, total) {
    seen = Math.max(0, seen | 0); total = Math.max(1, total | 0);
    var reached = 0;
    for (var i = 0; i < JOURNEY_STOPS.length; i++) if (seen >= stopThreshold(i, total)) reached = i + 1;
    var stops = JOURNEY_STOPS.map(function (name, k) {
      return { name: name, state: k < reached ? 'done' : (k === reached ? 'current' : 'todo') };
    });
    var finished = reached >= JOURNEY_STOPS.length;
    return {
      reached: reached, stops: stops, finished: finished,
      from: reached > 0 ? JOURNEY_STOPS[reached - 1] : null,
      to: finished ? null : JOURNEY_STOPS[reached],
      pct: Math.min(100, Math.round(seen / total * 100)),
      wordsToNext: finished ? 0 : Math.max(0, stopThreshold(reached, total) - seen)
    };
  }

  /*
   * Bandeau lundi → dimanche. activeDates : tableau de 'YYYY-MM-DD' où l'on a travaillé.
   * état : 'on' (jour fait), 'today' (aujourd'hui, pas encore fait), 'missed' (jour passé sans séance),
   * 'future' (à venir). Aujourd'hui compte comme 'on' s'il a déjà une séance.
   */
  var DAY_LETTERS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
  var DAY_NAMES = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
  function weekStrip(mondayStr, today, activeDates, addDays) {
    var set = {}; (activeDates || []).forEach(function (d) { set[d] = true; });
    var out = [];
    for (var i = 0; i < 7; i++) {
      var date = addDays(mondayStr, i);
      var state = set[date] ? 'on' : date === today ? 'today' : date < today ? 'missed' : 'future';
      out.push({ date: date, letter: DAY_LETTERS[i], name: DAY_NAMES[i], state: state });
    }
    return out;
  }

  return { JOURNEY_STOPS: JOURNEY_STOPS, GAMES_UNLOCK_WORDS: GAMES_UNLOCK_WORDS, journeyState: journeyState, weekStrip: weekStrip, stopThreshold: stopThreshold };
});
