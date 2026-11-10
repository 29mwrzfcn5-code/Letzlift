/*
 * Navigation au clavier des écrans à choix multiple — logique pure (navigateur + Node).
 * Flèches : déplacent la sélection ; chiffres 1 à 9 : choisissent directement la Nième réponse.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LetzKeyNav = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var ARROWS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
  function isArrow(key) { return ARROWS.indexOf(key) !== -1; }

  // Nouvel indice après une flèche. current = -1 : rien n'est encore sélectionné, on commence par la première réponse.
  function moveIndex(key, current, count) {
    if (!count || !isArrow(key)) return -1;
    if (current < 0) return 0;
    var forward = key === 'ArrowDown' || key === 'ArrowRight';
    return forward ? Math.min(count - 1, current + 1) : Math.max(0, current - 1);
  }

  // « 1 » → 0, « 2 » → 1… ; -1 si la touche n'est pas un chiffre ou dépasse le nombre de réponses.
  function digitIndex(key, count) {
    if (!/^[1-9]$/.test(String(key))) return -1;
    var i = Number(key) - 1;
    return i < count ? i : -1;
  }

  return { isArrow: isArrow, moveIndex: moveIndex, digitIndex: digitIndex };
});
