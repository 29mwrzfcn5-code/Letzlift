/*
 * Fusion de deux sauvegardes LetzLift (appareil local + copie du serveur) — logique pure
 * (navigateur + Node). Entrée et sortie : l'objet `data` d'une sauvegarde (voir buildBackupPayload),
 * avec en plus le champ optionnel vocabOverlay (mots personnels) et courseProgress.
 *
 * Règles (aucune donnée n'est perdue quand deux appareils ont avancé chacun de leur côté) :
 *  - progression par carte (vocabulaire, cours) : la version la plus récemment répondue gagne
 *    (champ updatedAt) ; sans horodatage des deux côtés (anciennes données), l'échéance la plus
 *    lointaine gagne ; wrongCount garde le plus grand des deux ;
 *  - grammaire, small talk : une fiche faite d'un côté reste faite ;
 *  - compteurs (statistiques, XP) : le plus grand des deux — pas une somme, car on ne sait pas
 *    ce qui a déjà été compté ; la série vient de l'appareil le plus récemment actif ;
 *  - records : le plus petit temps, le plus haut score ;
 *  - historique des jours : union par date ;
 *  - mots personnels : union, la version la plus récente gagne (une suppression n'est pas propagée).
 * La fusion est idempotente : merge(merge(a, b), b) donne merge(a, b).
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LetzSyncMerge = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var HIGH_RECORD_KEYS = ['phrasedrill']; // jeux notés en points ; tous les autres sont des temps
  var COUNTER_FIELDS = ['totalReviews', 'totalSessions', 'totalDaysActive', 'totalActiveSeconds', 'totalAnswered', 'totalCorrect'];

  function isObj(x) { return x !== null && typeof x === 'object' && !Array.isArray(x); }
  function num(x) { return typeof x === 'number' && isFinite(x) ? x : 0; }
  function clone(x) { return x === undefined ? undefined : JSON.parse(JSON.stringify(x)); }

  function mergeEntry(a, b) {
    var ta = num(a.updatedAt), tb = num(b.updatedAt), win;
    if (ta !== tb) win = ta > tb ? a : b;
    else win = num(a.dueAt) >= num(b.dueAt) ? a : b;
    var out = clone(win);
    var wrong = Math.max(num(a.wrongCount), num(b.wrongCount));
    if (wrong) out.wrongCount = wrong;
    return out;
  }

  function mergeProgress(local, remote) {
    var out = {}, ids = {};
    Object.keys(local || {}).forEach(function (k) { ids[k] = 1; });
    Object.keys(remote || {}).forEach(function (k) { ids[k] = 1; });
    Object.keys(ids).sort().forEach(function (id) {
      var a = local && local[id], b = remote && remote[id];
      out[id] = a && b ? mergeEntry(a, b) : clone(a || b);
    });
    return out;
  }

  function mergeFlags(local, remote) {
    var out = {}, ids = {};
    Object.keys(local || {}).forEach(function (k) { ids[k] = 1; });
    Object.keys(remote || {}).forEach(function (k) { ids[k] = 1; });
    Object.keys(ids).sort().forEach(function (k) {
      var a = local && local[k], b = remote && remote[k];
      out[k] = a === true || b === true ? true : (a !== undefined ? a : b);
    });
    return out;
  }

  function mergeStats(local, remote) {
    local = local || {}; remote = remote || {};
    var la = local.lastActiveDate || '', ra = remote.lastActiveDate || '';
    var winner = la > ra ? local : ra > la ? remote : (num(local.streakDays) >= num(remote.streakDays) ? local : remote);
    var out = clone(winner);
    COUNTER_FIELDS.forEach(function (f) {
      var v = Math.max(num(local[f]), num(remote[f]));
      if (v || local[f] !== undefined || remote[f] !== undefined) out[f] = v;
    });
    var bk = [local.lastBackupExportAt, remote.lastBackupExportAt].filter(Boolean).sort().pop();
    if (bk) out.lastBackupExportAt = bk;
    return out;
  }

  function mergeMax(local, remote) {
    var out = {}, keys = {};
    Object.keys(local || {}).forEach(function (k) { keys[k] = 1; });
    Object.keys(remote || {}).forEach(function (k) { keys[k] = 1; });
    Object.keys(keys).sort().forEach(function (k) { out[k] = Math.max(num(local && local[k]), num(remote && remote[k])); });
    return out;
  }

  function mergeDaily(local, remote) {
    local = local || {}; remote = remote || {};
    var ld = local.date || '', rd = remote.date || '';
    if (ld !== rd) return clone(ld > rd ? local : remote);
    var score = function (d) { return num(d.xpToday) * 1000 + num(d.newWordsToday) * 10 + num(d.activeSeconds) / 1000; };
    return clone(score(local) >= score(remote) ? local : remote);
  }

  function mergeRecords(local, remote) {
    var out = {}, keys = {};
    Object.keys(local || {}).forEach(function (k) { keys[k] = 1; });
    Object.keys(remote || {}).forEach(function (k) { keys[k] = 1; });
    Object.keys(keys).sort().forEach(function (k) {
      var a = local && local[k], b = remote && remote[k];
      if (a === undefined) out[k] = b; else if (b === undefined) out[k] = a;
      else out[k] = HIGH_RECORD_KEYS.indexOf(k) !== -1 ? Math.max(a, b) : Math.min(a, b);
    });
    return out;
  }

  function mergeHistory(local, remote) {
    var byDate = {};
    (Array.isArray(local) ? local : []).concat(Array.isArray(remote) ? remote : []).forEach(function (d) {
      if (!isObj(d) || typeof d.date !== 'string') return;
      var prev = byDate[d.date];
      if (!prev || num(d.answered) > num(prev.answered) || (num(d.answered) === num(prev.answered) && num(d.xp) > num(prev.xp))) byDate[d.date] = clone(d);
    });
    return Object.keys(byDate).sort().map(function (k) { return byDate[k]; });
  }

  function mergeProfile(local, remote) {
    local = local || {}; remote = remote || {};
    var out = Object.assign({}, clone(remote), clone(local));
    out.name = local.name || remote.name || null;
    out.onboardingDone = !!(local.onboardingDone || remote.onboardingDone);
    return out;
  }

  function mergeOverlay(local, remote) {
    var out = {}, ids = {};
    Object.keys(local || {}).forEach(function (k) { ids[k] = 1; });
    Object.keys(remote || {}).forEach(function (k) { ids[k] = 1; });
    Object.keys(ids).sort().forEach(function (id) {
      var a = local && local[id], b = remote && remote[id];
      out[id] = a && b ? clone(num(b.updatedAt) > num(a.updatedAt) ? b : a) : clone(a || b);
    });
    return out;
  }

  function mergeData(local, remote) {
    local = isObj(local) ? local : {}; remote = isObj(remote) ? remote : {};
    var out = {
      vocabProgress: mergeProgress(local.vocabProgress, remote.vocabProgress),
      grammarProgress: mergeFlags(local.grammarProgress, remote.grammarProgress),
      sessionStats: mergeStats(local.sessionStats, remote.sessionStats),
      smalltalkProgress: mergeFlags(local.smalltalkProgress, remote.smalltalkProgress),
      xpState: mergeMax(local.xpState, remote.xpState),
      dailyState: mergeDaily(local.dailyState, remote.dailyState),
      gameRecords: mergeRecords(local.gameRecords, remote.gameRecords),
      userProfile: mergeProfile(local.userProfile, remote.userProfile),
      dailyHistory: mergeHistory(local.dailyHistory, remote.dailyHistory),
      courseProgress: mergeProgress(local.courseProgress, remote.courseProgress),
      vocabOverlay: mergeOverlay(local.vocabOverlay, remote.vocabOverlay),
    };
    return out;
  }

  return { mergeData: mergeData, HIGH_RECORD_KEYS: HIGH_RECORD_KEYS };
});
