/*
 * Séries, jetons de pause et mode vacances — logique pure (navigateur + Node).
 * Dépend de js/lib/dates.js (globales dans le navigateur, require dans Node).
 */
(function (root, factory) {
  var dates = (typeof module === 'object' && module.exports) ? require('./dates.js') : root;
  var api = factory(dates);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else Object.assign(root, api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (dates) {
  'use strict';

  var PAUSE_TOKEN_INTERVAL = 5; // 1 jeton gagné tous les N jours de série
  var PAUSE_TOKEN_CAP = 3;      // stock maximum de jetons

  /*
   * Met à jour les statistiques de série pour le jour `today` ('YYYY-MM-DD', date locale).
   * Ne modifie pas `stats` : renvoie { stats, changed } où stats est une copie à jour.
   * changed = false si rien n'est à enregistrer (déjà compté aujourd'hui, ou date enregistrée dans
   * le futur : horloge ou fuseau changé — on ne casse alors pas la série par erreur).
   *
   * Règles (inchangées depuis v1.18.0) : veille → +1 ; absence couverte en entier par la fenêtre de
   * vacances → +1 sans jeton ; sinon 1 jeton par jour manqué s'il y en a assez → +1 ; sinon retour à 1.
   * Un jeton est attribué à chaque multiple de PAUSE_TOKEN_INTERVAL jours de série (stock plafonné).
   */
  function computeStreakUpdate(stats, today) {
    var s = Object.assign({}, stats);
    if (s.pauseTokens === undefined) s.pauseTokens = 0;
    if (s.lastTokenAwardStreak === undefined) s.lastTokenAwardStreak = 0;
    if (s.vacationStart === undefined) s.vacationStart = null;
    if (s.vacationEnd === undefined) s.vacationEnd = null;

    if (s.lastActiveDate === today) return { stats: s, changed: false };

    if (s.lastActiveDate) {
      var gap = dates.daysBetween(s.lastActiveDate, today); // 1 = hier, 3 = ven.→lun., ...
      if (gap < 0) return { stats: s, changed: false };     // date enregistrée dans le futur
      var missedDays = gap - 1;
      // Vacances : toute la période sautée doit tomber dans la fenêtre déclarée (pas de recouvrement partiel).
      var coveredByVacation = false;
      if (missedDays >= 1 && s.vacationStart && s.vacationEnd) {
        var missedStart = dates.addDaysStr(s.lastActiveDate, 1);
        var missedEnd = dates.addDaysStr(today, -1);
        coveredByVacation = missedStart >= s.vacationStart && missedEnd <= s.vacationEnd;
      }
      if (gap === 1) {
        s.streakDays += 1;
      } else if (coveredByVacation) {
        s.streakDays += 1; // aucun jeton consommé
      } else if (missedDays >= 1 && s.pauseTokens >= missedDays) {
        s.pauseTokens -= missedDays; // 1 jeton PAR JOUR manqué
        s.streakDays += 1;
        s.pauseTokenJustUsed = true;
      } else {
        s.streakDays = 1;
      }
    } else {
      s.streakDays = 1;
    }

    // Usage ponctuel : la fenêtre de vacances dépassée est effacée.
    if (s.vacationEnd && today > s.vacationEnd) {
      s.vacationStart = null;
      s.vacationEnd = null;
    }

    if (s.streakDays > 0
        && s.streakDays % PAUSE_TOKEN_INTERVAL === 0
        && s.streakDays !== s.lastTokenAwardStreak
        && s.pauseTokens < PAUSE_TOKEN_CAP) {
      s.pauseTokens += 1;
      s.lastTokenAwardStreak = s.streakDays;
      s.pauseTokenJustEarned = true;
      s.pauseTokenEarnedVia = 'streak';
    }

    s.lastActiveDate = today;
    s.totalDaysActive = (s.totalDaysActive || 0) + 1;
    return { stats: s, changed: true };
  }

  // Valide une fenêtre de vacances saisie (dates locales 'YYYY-MM-DD'). Renvoie un message ou null.
  function validateVacationRange(start, end, today) {
    if (!start || !end) return 'Choisis une date de début et une date de fin.';
    if (end < start) return 'La date de fin doit être après la date de début.';
    if (end < today) return 'Cette période est déjà passée.';
    return null;
  }

  return { PAUSE_TOKEN_INTERVAL: PAUSE_TOKEN_INTERVAL, PAUSE_TOKEN_CAP: PAUSE_TOKEN_CAP,
           computeStreakUpdate: computeStreakUpdate, validateVacationRange: validateVacationRange };
});
