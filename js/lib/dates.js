/*
 * Dates calendaires 'YYYY-MM-DD' — logique pure, utilisable dans le navigateur et dans Node.
 *
 * Règle : « aujourd'hui » est la date LOCALE du navigateur (getFullYear/getMonth/getDate), et non
 * la date UTC de toISOString() — sinon, au Luxembourg, entre minuit et 1 h (hiver) ou 2 h (été),
 * l'app croit être encore la veille. Toutes les autres opérations (écart, ajout de jours, lundi de
 * la semaine) travaillent sur des chaînes calendaires via Date.UTC : une date calendaire n'a pas
 * d'heure, donc aucun changement d'heure été/hiver ne peut décaler le résultat (pas de jour de
 * 23 h ou de 25 h).
 *
 * Navigateur : les fonctions sont exposées comme globales (todayStr(), daysBetween()…).
 * Node : module.exports.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else Object.assign(root, api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  // Date locale du navigateur au format 'YYYY-MM-DD'. `now` (Date) est injectable pour les tests.
  function localDateStr(now) {
    var d = now || new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function todayStr(now) { return localDateStr(now); }

  function isDateStr(s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    var d = new Date(s + 'T00:00:00Z');
    return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s; // refuse 2026-02-31
  }

  // Un nouveau jour a commencé si aucune date n'est enregistrée ou si elle est STRICTEMENT antérieure
  // à aujourd'hui. Une date enregistrée dans le futur (horloge ou fuseau changé) ne déclenche pas de
  // bascule : on n'archive pas et on ne remet rien à zéro tant qu'aujourd'hui ne l'a pas rattrapée.
  function isNewDay(storedDate, today) {
    return !storedDate || storedDate < today;
  }

  // Différence en jours calendaires entre deux dates 'YYYY-MM-DD'. daysBetween('2026-07-24','2026-07-27') = 3.
  function daysBetween(dateStrA, dateStrB) {
    var a = new Date(dateStrA + 'T00:00:00Z').getTime();
    var b = new Date(dateStrB + 'T00:00:00Z').getTime();
    return Math.round((b - a) / 86400000);
  }

  function addDaysStr(dateStr, n) {
    var d = new Date(dateStr + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }

  function mondayOf(dateStr) {
    var d = new Date(dateStr + 'T00:00:00Z');
    var dow = d.getUTCDay();                 // 0 = dimanche, 1 = lundi ...
    var shift = (dow === 0) ? 6 : dow - 1;   // recule jusqu'au lundi
    d.setUTCDate(d.getUTCDate() - shift);
    return d.toISOString().slice(0, 10);
  }

  function formatDayFR(dateStr) {
    var d = new Date(dateStr + 'T00:00:00Z');
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  }

  return { localDateStr: localDateStr, todayStr: todayStr, isDateStr: isDateStr, isNewDay: isNewDay,
           daysBetween: daysBetween, addDaysStr: addDaysStr, mondayOf: mondayOf, formatDayFR: formatDayFR };
});
