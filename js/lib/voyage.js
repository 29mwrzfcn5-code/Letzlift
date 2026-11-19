/*
 * Mon voyage : logique pure (navigateur + Node). Aucune dépendance.
 * Progression stockée dans le profil : { units: { <id>: { stars, done, at } } }.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else Object.assign(root, api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function fold(s) {
    return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  }

  // 'correct' : identique (casse ignorée) ; 'almost' : seulement les accents ou la casse diffèrent ; 'wrong' sinon.
  function voyageGrade(given, expected) {
    var g = String(given == null ? '' : given).trim().replace(/\s+/g, ' ');
    var e = String(expected).trim();
    if (!g) return 'empty';
    if (g === e) return 'correct';
    if (g.toLowerCase() === e.toLowerCase()) return 'correct';
    if (fold(g) === fold(e)) return 'almost';
    return 'wrong';
  }

  // 3 étoiles : tout juste ; 2 : une erreur ; 1 : au moins la moitié ; 0 sinon.
  function voyageStars(correct, total) {
    if (!total) return 0;
    if (correct >= total) return 3;
    if (correct >= total - 1 && total > 2) return 2;
    if (correct * 2 >= total) return 1;
    return 0;
  }

  // 'done' | 'open' | 'locked' : une unité s'ouvre quand la précédente est validée.
  function voyageUnitState(progress, units, index) {
    var units_ = (progress && progress.units) || {};
    var u = units[index];
    if (units_[u.id] && units_[u.id].done) return 'done';
    if (index === 0) return 'open';
    var prev = units[index - 1];
    return units_[prev.id] && units_[prev.id].done ? 'open' : 'locked';
  }

  function voyageCurrentIndex(progress, units) {
    for (var i = 0; i < units.length; i++) if (voyageUnitState(progress, units, i) === 'open') return i;
    return units.length; // tout est fait
  }

  // Enregistre un résultat : on garde la meilleure note ; l'unité est validée dès qu'il y a au moins une étoile.
  function voyageRecord(progress, unitId, stars, now) {
    var p = progress && progress.units ? progress : { units: {} };
    var old = p.units[unitId] || { stars: 0, done: false };
    p.units[unitId] = { stars: Math.max(old.stars || 0, stars), done: !!old.done || stars >= 1, at: now };
    return p;
  }

  return { voyageGrade: voyageGrade, voyageStars: voyageStars, voyageUnitState: voyageUnitState, voyageCurrentIndex: voyageCurrentIndex, voyageRecord: voyageRecord };
});
