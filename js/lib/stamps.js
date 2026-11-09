/*
 * Tampons de passeport et messages de Roudi — logique pure (navigateur + Node).
 * Les tampons se calculent à partir de l'état de l'apprenant : rien n'est stocké pour les gagner.
 * Seule la liste des tampons déjà « fêtés » est gardée sur l'appareil (voir js/feedback.js).
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else Object.assign(root, api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /*
   * ctx : { seen, total, mastered, streak, sessions, reached } — mots vus, taille du vocabulaire, mots acquis,
   * série en jours, nombre de sessions, étapes du parcours franchies (0 à 5).
   */
  var STAMPS = [
    { id: 'p-schengen',   group: 'Parcours', label: 'Schengen',         sub: 'Premier mot appris',        glyph: 'S',   check: function (c) { return c.reached >= 1; } },
    { id: 'p-vianden',    group: 'Parcours', label: 'Vianden',          sub: '25 % du vocabulaire vu',    glyph: 'V',   check: function (c) { return c.reached >= 2; } },
    { id: 'p-echternach', group: 'Parcours', label: 'Echternach',       sub: '50 % du vocabulaire vu',    glyph: 'E',   check: function (c) { return c.reached >= 3; } },
    { id: 'p-clervaux',   group: 'Parcours', label: 'Clervaux',         sub: '75 % du vocabulaire vu',    glyph: 'C',   check: function (c) { return c.reached >= 4; } },
    { id: 'p-lux',        group: 'Parcours', label: 'Luxembourg-Ville', sub: 'Tout le vocabulaire vu',    glyph: 'L',   check: function (c) { return c.reached >= 5; } },
    { id: 's-3',   group: 'Série', label: '3 jours',   sub: '3 jours de suite',   glyph: '3',   check: function (c) { return c.streak >= 3; } },
    { id: 's-7',   group: 'Série', label: '7 jours',   sub: 'Une semaine entière', glyph: '7',   check: function (c) { return c.streak >= 7; } },
    { id: 's-14',  group: 'Série', label: '14 jours',  sub: 'Deux semaines',      glyph: '14',  check: function (c) { return c.streak >= 14; } },
    { id: 's-30',  group: 'Série', label: '30 jours',  sub: 'Un mois de suite',   glyph: '30',  check: function (c) { return c.streak >= 30; } },
    { id: 'm-20',  group: 'Mots', label: '20 mots',   sub: '20 mots vus',    glyph: '20',  check: function (c) { return c.seen >= 20; } },
    { id: 'm-50',  group: 'Mots', label: '50 mots',   sub: '50 mots vus',    glyph: '50',  check: function (c) { return c.seen >= 50; } },
    { id: 'm-100', group: 'Mots', label: '100 mots',  sub: '100 mots vus',   glyph: '100', check: function (c) { return c.seen >= 100; } },
    { id: 'm-200', group: 'Mots', label: '200 mots',  sub: '200 mots vus',   glyph: '200', check: function (c) { return c.seen >= 200; } },
    { id: 'a-10',  group: 'Acquis', label: '10 acquis', sub: '10 mots bien ancrés', glyph: '10', check: function (c) { return c.mastered >= 10; } },
    { id: 'a-50',  group: 'Acquis', label: '50 acquis', sub: '50 mots bien ancrés', glyph: '50', check: function (c) { return c.mastered >= 50; } },
    { id: 'x-1',   group: 'Sessions', label: 'Première session', sub: 'Un premier billet validé', glyph: '1',  check: function (c) { return c.sessions >= 1; } },
    { id: 'x-10',  group: 'Sessions', label: '10 sessions',      sub: 'Dix billets validés',      glyph: '10', check: function (c) { return c.sessions >= 10; } }
  ];

  function earnedStamps(ctx) {
    return STAMPS.filter(function (s) { try { return s.check(ctx); } catch (e) { return false; } });
  }

  /* Tampons gagnés et pas encore fêtés. */
  function newStamps(earnedIds, celebratedIds) {
    var done = {}; (celebratedIds || []).forEach(function (id) { done[id] = 1; });
    return STAMPS.filter(function (s) { return earnedIds.indexOf(s.id) !== -1 && !done[s.id]; });
  }

  /* ---- Messages de Roudi ---- */
  function pick(list, seed) { return list[Math.abs(seed | 0) % list.length]; }

  /*
   * Phrase d'accueil sous « Moien ». ctx : { streak, daysAway, doneToday, hour }.
   * daysAway : jours depuis la dernière activité (null si jamais). seed : pour varier sans hasard dans les tests.
   */
  function homeLine(ctx, seed) {
    if (ctx.daysAway !== null && ctx.daysAway >= 14) return 'Content de te revoir ! On reprend tout doucement, sans pression.';
    if (ctx.daysAway !== null && ctx.daysAway >= 3) return pick(['Tu m\'as manqué ! Un petit billet pour repartir ?', 'Te voilà ! On reprend par les bases, à ton rythme.'], seed);
    if (ctx.doneToday) return pick(['Bravo, ta session du jour est faite. Un petit bonus ?', 'C\'est fait pour aujourd\'hui. Roudi est fier de toi !'], seed);
    if (ctx.streak >= 7) return 'Déjà ' + ctx.streak + ' jours de suite. Ne casse pas la série !';
    if (ctx.hour >= 18) return pick(['Bonsoir ! Ton billet du jour t\'attend.', 'Une petite session avant la fin de la journée ?'], seed);
    if (ctx.hour < 10) return pick(['Bon matin ! Ton billet du jour est prêt.', 'Moien ! Un café et dix minutes de luxembourgeois ?'], seed);
    return 'Ton billet du jour est prêt.';
  }

  /* Message de fin de session selon le taux de réussite (0 à 100, ou null). */
  function sessionLine(pct, seed) {
    if (pct === null) return 'Belle révision !';
    if (pct >= 90) return pick(['Excellent ! Tu connais ça sur le bout des doigts.', 'Quel score ! Roudi applaudit.'], seed);
    if (pct >= 70) return pick(['Très bien ! Tu avances vite.', 'Joli travail, continue comme ça.'], seed);
    if (pct >= 50) return pick(['Bon début. Les mots ratés reviendront bientôt.', 'Ça rentre petit à petit.'], seed);
    return 'Pas grave, c\'est comme ça qu\'on apprend. Les mots difficiles reviendront.';
  }

  return { STAMPS: STAMPS, earnedStamps: earnedStamps, newStamps: newStamps, homeLine: homeLine, sessionLine: sessionLine };
});
