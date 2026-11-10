/*
 * Objectif de la semaine et messages du bilan hebdomadaire — logique pure (navigateur + Node).
 * L'objectif est un nombre de jours pratiqués par semaine (lundi → dimanche). Jamais punitif : une semaine
 * ratée donne un message d'encouragement, pas un échec.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else Object.assign(root, api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var GOAL_CHOICES = [3, 5, 7];
  var DEFAULT_GOAL = 5;

  function clampGoal(n) {
    n = parseInt(n, 10);
    return n >= 1 && n <= 7 ? n : DEFAULT_GOAL;
  }

  function plural(n, one, many) { return n + ' ' + (n > 1 ? many : one); }

  /*
   * activeDays : jours pratiqués cette semaine ; goal : objectif ; chancesLeft : jours qui peuvent encore compter
   * (jours à venir, et aujourd'hui s'il n'est pas encore fait) — 0 pour une semaine terminée.
   * état : 'reached' (atteint) | 'ontrack' (bien parti) | 'tight' (il faut chaque jour restant)
   *      | 'off' (hors de portée cette semaine) | 'missed' (semaine terminée sans l'atteindre).
   */
  function goalStatus(activeDays, goal, chancesLeft, ended) {
    goal = clampGoal(goal);
    activeDays = Math.max(0, activeDays | 0);
    chancesLeft = Math.max(0, chancesLeft | 0);
    var remaining = Math.max(0, goal - activeDays);
    var state;
    if (activeDays >= goal) state = 'reached';
    else if (ended) state = 'missed';
    else if (remaining > chancesLeft) state = 'off';
    else if (remaining === chancesLeft) state = 'tight';
    else state = 'ontrack';
    return { goal: goal, done: activeDays, remaining: remaining, chancesLeft: chancesLeft, state: state, pct: Math.min(100, Math.round(100 * activeDays / goal)) };
  }

  function goalMessage(st) {
    switch (st.state) {
      case 'reached': return st.done > st.goal ? 'Objectif dépassé : bravo, chaque jour en plus est un bonus.' : 'Objectif atteint, bravo !';
      case 'ontrack': return 'Encore ' + plural(st.remaining, 'jour', 'jours') + ' pour atteindre ton objectif.';
      case 'tight': return 'Il te faut ' + (st.remaining > 1 ? 'chacun des ' + st.remaining + ' jours' : 'le jour') + ' qui reste' + (st.remaining > 1 ? 'nt' : '') + ' : tu peux y arriver.';
      case 'off': return 'L\'objectif est hors de portée cette semaine, et ce n\'est pas grave : continue à ton rythme, on repart lundi.';
      default: return st.done * 2 >= st.goal
        ? 'Presque ! ' + st.done + ' jour' + (st.done > 1 ? 's' : '') + ' sur ' + st.goal + '. Un jour de plus la semaine prochaine ?'
        : 'Semaine plus légère : une courte session vaut mieux qu\'une longue reportée. On repart tranquillement.';
    }
  }

  // Phrase de Roudi en tête du bilan.
  function roudiWeekLine(st, live, firstWeek) {
    if (firstWeek) return 'Première semaine ! Chaque jour compte, même dix minutes.';
    if (st.state === 'reached') return live ? 'Tu as déjà tenu ton objectif cette semaine. Roudi est fier de toi !' : 'Objectif tenu ! Quelle belle régularité.';
    if (st.state === 'missed') return st.done > 0 ? 'Merci d\'être venu(e) ' + (st.done > 1 ? st.done + ' fois' : 'une fois') + ' : c\'est comme ça qu\'on avance.' : 'Pas de souci, on repart ensemble.';
    if (st.state === 'off') return 'Tu en as déjà fait ' + st.done + ' : c\'est toujours ça de pris.';
    return 'Tu avances bien, continue comme ça.';
  }

  return { GOAL_CHOICES: GOAL_CHOICES, DEFAULT_GOAL: DEFAULT_GOAL, clampGoal: clampGoal, goalStatus: goalStatus, goalMessage: goalMessage, roudiWeekLine: roudiWeekLine };
});
