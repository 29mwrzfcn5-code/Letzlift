/*
 * XP et niveaux Endurance — calculs purs (navigateur + Node).
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else Object.assign(root, api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var OVERTIME_MULTIPLIER = 1.5;
  var XP_VALUES = { type: 3, qcm: 2, reverse: 4, genre: 2, grammar: 3, smalltalk: 2 };
  var ENDURANCE_LEVELS = [0, 150, 500, 1050, 1900, 3000, 3600, 4200, 4800, 5500, 6200];

  // XP accordé pour une bonne réponse. ratio : réduction (ex. 0.5 pour « presque »), minimum 1.
  // overtime : objectif du jour déjà atteint → bonus ×1.5 (le gain va alors à l'Arcade, pas à l'Endurance).
  function computeXpAmount(baseAmount, ratio, overtime) {
    var adjustedBase = ratio ? Math.max(1, Math.round(baseAmount * ratio)) : baseAmount;
    return overtime ? Math.round(adjustedBase * OVERTIME_MULTIPLIER) : adjustedBase;
  }

  function levelInfoForXp(enduranceXP) {
    var level = 1;
    for (var i = 0; i < ENDURANCE_LEVELS.length; i++) {
      if (enduranceXP >= ENDURANCE_LEVELS[i]) level = i + 1;
    }
    var idx = level - 1;
    var next = ENDURANCE_LEVELS[idx + 1];
    return { level: level, nextThreshold: next === undefined ? null : next, currentThreshold: ENDURANCE_LEVELS[idx] };
  }

  return { OVERTIME_MULTIPLIER: OVERTIME_MULTIPLIER, XP_VALUES: XP_VALUES, ENDURANCE_LEVELS: ENDURANCE_LEVELS,
           computeXpAmount: computeXpAmount, levelInfoForXp: levelInfoForXp };
});
