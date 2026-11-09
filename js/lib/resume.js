/*
 * Reprise après une pause — logique pure (navigateur + Node).
 * Étale sur plusieurs jours les cartes en retard depuis longtemps, sans toucher aux boîtes :
 * seule l'échéance (dueAt) change. Les cartes les plus fragiles (boîtes basses, puis les plus
 * anciennes) reviennent en premier. Fonctionne sur n'importe quelle table de progression
 * { id: { box, dueAt, learningStep? } } (vocabulaire ou cours).
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else Object.assign(root, api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var DAY = 24 * 3600 * 1000;
  var BACKLOG_MIN_OVERDUE_DAYS = 3;  // une carte est « en retard de longue date » au-delà
  var BACKLOG_MIN_COUNT = 20;        // en dessous, la file normale suffit : on ne propose rien

  // Cartes en retard de plus de minOverdueDays (celles en cours d'apprentissage sont ignorées).
  function backlogIds(progress, now, minOverdueDays) {
    var limit = now - (minOverdueDays == null ? BACKLOG_MIN_OVERDUE_DAYS : minOverdueDays) * DAY;
    return Object.keys(progress).filter(function (id) {
      var e = progress[id];
      return e && Number.isFinite(e.dueAt) && e.dueAt > 0 && e.dueAt <= limit && !e.learningStep;
    });
  }

  function shouldOfferResume(progress, now) {
    return backlogIds(progress, now).length >= BACKLOG_MIN_COUNT;
  }

  // Étale le retard sur `days` jours (14 par défaut), au moins 10 cartes par jour.
  // Modifie `progress` sur place ; renvoie { moved, days, perDay, undo } où undo = { id: ancien dueAt }.
  function spreadBacklog(progress, now, opts) {
    opts = opts || {};
    var days = Math.max(1, opts.days || 14);
    var ids = backlogIds(progress, now, opts.minOverdueDays).sort(function (a, b) {
      return (progress[a].box - progress[b].box) || (progress[a].dueAt - progress[b].dueAt) || (a < b ? -1 : a > b ? 1 : 0);
    });
    var perDay = Math.max(10, Math.ceil(ids.length / days));
    var undo = {};
    ids.forEach(function (id, i) {
      undo[id] = progress[id].dueAt;
      progress[id].dueAt = now + Math.floor(i / perDay) * DAY;
    });
    return { moved: ids.length, days: ids.length ? Math.floor((ids.length - 1) / perDay) + 1 : 0, perDay: perDay, undo: undo };
  }

  function undoSpread(progress, undo) {
    Object.keys(undo || {}).forEach(function (id) { if (progress[id]) progress[id].dueAt = undo[id]; });
  }

  return {
    BACKLOG_MIN_OVERDUE_DAYS: BACKLOG_MIN_OVERDUE_DAYS, BACKLOG_MIN_COUNT: BACKLOG_MIN_COUNT,
    backlogIds: backlogIds, shouldOfferResume: shouldOfferResume, spreadBacklog: spreadBacklog, undoSpread: undoSpread,
  };
});
