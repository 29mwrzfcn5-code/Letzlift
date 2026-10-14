require('./helpers/tz.js');
const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('../js/lib/dates.js');
const K = require('../js/lib/streak.js');

const base = over => ({ streakDays: 3, lastActiveDate: '2026-03-09', totalDaysActive: 10, pauseTokens: 0,
  lastTokenAwardStreak: 0, vacationStart: null, vacationEnd: null, ...over });
const update = (stats, today) => K.computeStreakUpdate(stats, today);

test('même jour : rien à enregistrer', () => {
  const r = update(base(), '2026-03-09');
  assert.equal(r.changed, false);
  assert.equal(r.stats.streakDays, 3);
});

test('la série continue le lendemain', () => {
  const r = update(base(), '2026-03-10');
  assert.equal(r.changed, true);
  assert.equal(r.stats.streakDays, 4);
  assert.equal(r.stats.lastActiveDate, '2026-03-10');
  assert.equal(r.stats.totalDaysActive, 11);
});

test('ne modifie pas l’objet reçu', () => {
  const s = base();
  const copy = JSON.stringify(s);
  update(s, '2026-03-10');
  assert.equal(JSON.stringify(s), copy);
});

test('minuit local : 23h50 puis 00h10 comptent comme deux jours (l’ancien calcul UTC n’en voyait qu’un)', () => {
  const evening = new Date('2026-03-09T22:50:00Z'); // 23:50 CET le 9
  const justAfter = new Date('2026-03-09T23:10:00Z'); // 00:10 CET le 10
  const first = update(base({ lastActiveDate: '2026-03-08' }), D.todayStr(evening)).stats;
  assert.equal(first.lastActiveDate, '2026-03-09');
  const second = update(first, D.todayStr(justAfter));
  assert.equal(second.stats.streakDays, first.streakDays + 1);
  // ancien calcul : les deux instants donnaient « 2026-03-09 » → aucune progression
  assert.equal(evening.toISOString().slice(0, 10), justAfter.toISOString().slice(0, 10));
});

test('la série traverse les deux changements d’heure', () => {
  for (const [a, b] of [['2026-03-28', '2026-03-29'], ['2026-03-29', '2026-03-30'], ['2026-10-24', '2026-10-25'], ['2026-10-25', '2026-10-26']]) {
    const r = update(base({ lastActiveDate: a }), b);
    assert.equal(r.stats.streakDays, 4, `${a} → ${b}`);
  }
});

test('un jour manqué sans jeton casse la série', () => {
  const r = update(base(), '2026-03-11');
  assert.equal(r.stats.streakDays, 1);
  assert.equal(r.stats.lastActiveDate, '2026-03-11');
});

test('première utilisation : série à 1', () => {
  const r = update(base({ lastActiveDate: null, streakDays: 0, totalDaysActive: 0 }), '2026-03-10');
  assert.equal(r.stats.streakDays, 1);
});

test('jeton de pause : 1 jeton par jour manqué', () => {
  let r = update(base({ pauseTokens: 1 }), '2026-03-11'); // 1 jour manqué
  assert.equal(r.stats.streakDays, 4);
  assert.equal(r.stats.pauseTokens, 0);
  assert.equal(r.stats.pauseTokenJustUsed, true);

  r = update(base({ pauseTokens: 3 }), '2026-03-13'); // 3 jours manqués
  assert.equal(r.stats.streakDays, 4);
  assert.equal(r.stats.pauseTokens, 0);
});

test('jetons insuffisants : la série casse et les jetons sont conservés', () => {
  const r = update(base({ pauseTokens: 1 }), '2026-03-12'); // 2 jours manqués, 1 jeton
  assert.equal(r.stats.streakDays, 1);
  assert.equal(r.stats.pauseTokens, 1);
  assert.ok(!r.stats.pauseTokenJustUsed);
});

test('un week-end complet (vendredi → lundi) coûte 2 jetons', () => {
  const r = update(base({ lastActiveDate: '2026-03-06', pauseTokens: 2 }), '2026-03-09');
  assert.equal(r.stats.streakDays, 4);
  assert.equal(r.stats.pauseTokens, 0);
});

test('un jeton est gagné tous les 5 jours de série', () => {
  const r = update(base({ streakDays: 4 }), '2026-03-10');
  assert.equal(r.stats.streakDays, 5);
  assert.equal(r.stats.pauseTokens, 1);
  assert.equal(r.stats.lastTokenAwardStreak, 5);
  assert.equal(r.stats.pauseTokenJustEarned, true);
  assert.equal(r.stats.pauseTokenEarnedVia, 'streak');
});

test('le stock de jetons est plafonné à 3', () => {
  const r = update(base({ streakDays: 9, pauseTokens: 3 }), '2026-03-10');
  assert.equal(r.stats.streakDays, 10);
  assert.equal(r.stats.pauseTokens, 3);
  assert.ok(!r.stats.pauseTokenJustEarned);
});

test('pas de double attribution pour un même palier de série', () => {
  const r = update(base({ streakDays: 4, lastTokenAwardStreak: 5 }), '2026-03-10');
  assert.equal(r.stats.streakDays, 5);
  assert.equal(r.stats.pauseTokens, 0);
});

test('vacances : absence entièrement couverte, aucun jeton consommé', () => {
  const r = update(base({ lastActiveDate: '2026-03-10', vacationStart: '2026-03-11', vacationEnd: '2026-03-19', pauseTokens: 1 }), '2026-03-20');
  assert.equal(r.stats.streakDays, 4);
  assert.equal(r.stats.pauseTokens, 1);
  assert.equal(r.stats.vacationStart, null); // fenêtre dépassée : effacée
  assert.equal(r.stats.vacationEnd, null);
});

test('vacances : fenêtre plus large que l’absence, retour pendant les vacances', () => {
  const r = update(base({ lastActiveDate: '2026-03-10', vacationStart: '2026-03-05', vacationEnd: '2026-03-25' }), '2026-03-15');
  assert.equal(r.stats.streakDays, 4);
  assert.equal(r.stats.vacationEnd, '2026-03-25'); // pas encore dépassée : conservée
});

test('vacances : absence seulement partiellement couverte → comportement normal (cassée sans jeton)', () => {
  const r = update(base({ lastActiveDate: '2026-03-10', vacationStart: '2026-03-12', vacationEnd: '2026-03-19' }), '2026-03-20');
  assert.equal(r.stats.streakDays, 1);
});

test('vacances : partiellement couverte mais assez de jetons → jetons consommés', () => {
  const r = update(base({ lastActiveDate: '2026-03-10', vacationStart: '2026-03-12', vacationEnd: '2026-03-19', pauseTokens: 3 }), '2026-03-12');
  assert.equal(r.stats.streakDays, 4);
  assert.equal(r.stats.pauseTokens, 2);
});

test('vacances : veille → +1 normal, sans toucher à la fenêtre', () => {
  const r = update(base({ vacationStart: '2026-03-20', vacationEnd: '2026-03-25' }), '2026-03-10');
  assert.equal(r.stats.streakDays, 4);
  assert.equal(r.stats.vacationEnd, '2026-03-25');
});

test('date enregistrée dans le futur (horloge ou fuseau changé) : la série n’est pas cassée', () => {
  const r = update(base({ lastActiveDate: '2026-03-12' }), '2026-03-10');
  assert.equal(r.changed, false);
  assert.equal(r.stats.streakDays, 3);
  assert.equal(r.stats.lastActiveDate, '2026-03-12');
});

test('anciennes sauvegardes : champs manquants initialisés', () => {
  const r = update({ streakDays: 2, lastActiveDate: '2026-03-09' }, '2026-03-10');
  assert.equal(r.stats.streakDays, 3);
  assert.equal(r.stats.pauseTokens, 0);
  assert.equal(r.stats.vacationStart, null);
  assert.equal(r.stats.totalDaysActive, 1);
});

test('validateVacationRange', () => {
  assert.match(K.validateVacationRange('', '2026-03-20', '2026-03-10'), /début et une date de fin/);
  assert.match(K.validateVacationRange('2026-03-20', '2026-03-15', '2026-03-10'), /après la date de début/);
  assert.match(K.validateVacationRange('2026-03-01', '2026-03-05', '2026-03-10'), /déjà passée/);
  assert.equal(K.validateVacationRange('2026-03-10', '2026-03-10', '2026-03-10'), null); // se termine aujourd'hui
  assert.equal(K.validateVacationRange('2026-03-11', '2026-03-20', '2026-03-10'), null);
});

test('vacances saisies (date locale) et « aujourd’hui » local sont comparables à 00h30', () => {
  const today = D.todayStr(new Date('2026-03-09T23:30:00Z')); // 00:30 CET le 10
  assert.equal(K.validateVacationRange('2026-03-10', '2026-03-10', today), null);
});
