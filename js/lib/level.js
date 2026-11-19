/*
 * Niveaux A1 / A2 — logique pure (navigateur + Node). Aucune dépendance.
 * Le vocabulaire A1 est dans VOCAB ; les mots A2 sont dans VOCAB_A2 et n'entrent dans VOCAB que si la personne
 * ouvre l'A2 (réglage userProfile.levelA2). L'A2 reste un choix : jamais imposé, proposé quand l'A1 est bien en place.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else Object.assign(root, api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var A2_MIN_SEEN = 0.8;   // part des mots A1 déjà vus
  var A2_MIN_SOLID = 0.5;  // part des mots A1 en boîte 3 ou plus

  function isA1(word) { return !word || word.level !== 'A2'; }

  /*
   * words : le vocabulaire actif ; progress : { [id]: { box } }.
   * Renvoie { total, seen, solid, seenPct, solidPct, ready } (les pourcentages sont des entiers 0-100).
   */
  function a2Readiness(words, progress) {
    progress = progress || {};
    var total = 0, seen = 0, solid = 0;
    (words || []).forEach(function (w) {
      if (!isA1(w)) return;
      total++;
      var p = progress[w.id];
      if (p) { seen++; if ((p.box || 0) >= 3) solid++; }
    });
    var seenRatio = total ? seen / total : 0, solidRatio = total ? solid / total : 0;
    return {
      total: total, seen: seen, solid: solid,
      seenPct: Math.round(100 * seenRatio), solidPct: Math.round(100 * solidRatio),
      ready: total > 0 && seenRatio >= A2_MIN_SEEN && solidRatio >= A2_MIN_SOLID
    };
  }

  function levelLabel(a2On) { return a2On ? 'A1 + A2' : 'A1'; }

  return { A2_MIN_SEEN: A2_MIN_SEEN, A2_MIN_SOLID: A2_MIN_SOLID, isA1: isA1, a2Readiness: a2Readiness, levelLabel: levelLabel };
});
