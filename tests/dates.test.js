require('./helpers/tz.js');
const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('../js/lib/dates.js');

const at = iso => new Date(iso); // instants exprimés en UTC ; le fuseau local est Europe/Luxembourg

test('todayStr : 00h30 heure du Luxembourg (hiver) est déjà le lendemain', () => {
  const now = at('2026-03-09T23:30:00Z'); // 00:30 CET le 10 mars
  assert.equal(D.todayStr(now), '2026-03-10');
  // l'ancien calcul (UTC) se trompait :
  assert.equal(now.toISOString().slice(0, 10), '2026-03-09');
});

test('todayStr : 00h30 heure du Luxembourg (été) est déjà le lendemain', () => {
  const now = at('2026-07-14T22:30:00Z'); // 00:30 CEST le 15 juillet
  assert.equal(D.todayStr(now), '2026-07-15');
  assert.equal(now.toISOString().slice(0, 10), '2026-07-14');
});

test('todayStr : bascule exacte à minuit local, été et hiver', () => {
  assert.equal(D.todayStr(at('2026-07-14T21:59:59Z')), '2026-07-14'); // 23:59:59 CEST
  assert.equal(D.todayStr(at('2026-07-14T22:00:00Z')), '2026-07-15'); // 00:00:00 CEST
  assert.equal(D.todayStr(at('2026-01-14T22:59:59Z')), '2026-01-14'); // 23:59:59 CET
  assert.equal(D.todayStr(at('2026-01-14T23:00:00Z')), '2026-01-15'); // 00:00:00 CET
});

test('todayStr : 1h30 en été (UTC = veille) reste le bon jour', () => {
  assert.equal(D.todayStr(at('2026-07-14T23:30:00Z')), '2026-07-15'); // 01:30 CEST
});

test('changement d’heure de printemps (29 mars 2026, journée de 23 h)', () => {
  assert.equal(D.todayStr(at('2026-03-28T22:59:00Z')), '2026-03-28'); // 23:59 CET
  assert.equal(D.todayStr(at('2026-03-28T23:00:00Z')), '2026-03-29'); // 00:00 CET
  assert.equal(D.todayStr(at('2026-03-29T00:59:00Z')), '2026-03-29'); // 01:59 CET, juste avant le saut
  assert.equal(D.todayStr(at('2026-03-29T01:00:00Z')), '2026-03-29'); // 03:00 CEST, juste après
  assert.equal(D.todayStr(at('2026-03-29T21:59:00Z')), '2026-03-29'); // 23:59 CEST
  assert.equal(D.todayStr(at('2026-03-29T22:00:00Z')), '2026-03-30'); // 00:00 CEST
  assert.equal(D.todayStr(new Date(2026, 2, 29, 2, 30)), '2026-03-29'); // heure locale inexistante
});

test('changement d’heure d’automne (25 octobre 2026, journée de 25 h)', () => {
  assert.equal(D.todayStr(at('2026-10-24T21:59:00Z')), '2026-10-24'); // 23:59 CEST
  assert.equal(D.todayStr(at('2026-10-24T22:00:00Z')), '2026-10-25'); // 00:00 CEST
  assert.equal(D.todayStr(at('2026-10-25T00:30:00Z')), '2026-10-25'); // 02:30 CEST (première fois)
  assert.equal(D.todayStr(at('2026-10-25T01:30:00Z')), '2026-10-25'); // 02:30 CET (deuxième fois)
  assert.equal(D.todayStr(at('2026-10-25T22:59:00Z')), '2026-10-25'); // 23:59 CET
  assert.equal(D.todayStr(at('2026-10-25T23:00:00Z')), '2026-10-26'); // 00:00 CET
});

test('daysBetween et addDaysStr ne sont pas affectés par les changements d’heure', () => {
  assert.equal(D.daysBetween('2026-03-28', '2026-03-30'), 2);
  assert.equal(D.daysBetween('2026-10-24', '2026-10-26'), 2);
  assert.equal(D.daysBetween('2026-03-29', '2026-03-29'), 0);
  assert.equal(D.daysBetween('2026-03-10', '2026-03-09'), -1);
  assert.equal(D.daysBetween('2025-12-31', '2026-01-01'), 1);
  assert.equal(D.addDaysStr('2026-03-28', 1), '2026-03-29');
  assert.equal(D.addDaysStr('2026-03-29', 1), '2026-03-30');
  assert.equal(D.addDaysStr('2026-10-25', 1), '2026-10-26');
  assert.equal(D.addDaysStr('2026-12-31', 1), '2027-01-01');
  assert.equal(D.addDaysStr('2028-02-28', 1), '2028-02-29'); // année bissextile
  assert.equal(D.addDaysStr('2026-03-01', -1), '2026-02-28');
});

test('mondayOf : semaines du lundi au dimanche, y compris en fin d’année', () => {
  assert.equal(D.mondayOf('2026-03-09'), '2026-03-09'); // lundi
  assert.equal(D.mondayOf('2026-03-10'), '2026-03-09'); // mardi
  assert.equal(D.mondayOf('2026-03-15'), '2026-03-09'); // dimanche
  assert.equal(D.mondayOf('2026-03-16'), '2026-03-16');
  assert.equal(D.mondayOf('2027-01-01'), '2026-12-28'); // vendredi
  assert.equal(D.mondayOf('2026-03-29'), '2026-03-23'); // dimanche du changement d'heure
});

test('semaine en cours à minuit local : le lundi 00h10 appartient à la nouvelle semaine', () => {
  const sundayNight = D.todayStr(at('2026-03-15T22:50:00Z')); // dim. 23:50 CET
  const mondayNight = D.todayStr(at('2026-03-15T23:10:00Z')); // lun. 00:10 CET
  assert.equal(D.mondayOf(sundayNight), '2026-03-09');
  assert.equal(D.mondayOf(mondayNight), '2026-03-16');
});

test('formatDayFR ne dépend pas du fuseau', () => {
  assert.match(D.formatDayFR('2026-03-10'), /10/);
  assert.match(D.formatDayFR('2026-03-10'), /mars/);
});

test('isDateStr', () => {
  assert.ok(D.isDateStr('2026-03-10'));
  assert.ok(!D.isDateStr('2026-02-31'));
  assert.ok(!D.isDateStr('2026-3-10'));
  assert.ok(!D.isDateStr(null));
  assert.ok(!D.isDateStr('2026-03-10T00:00:00Z'));
});

test('isNewDay : bascule seulement vers un jour strictement postérieur', () => {
  assert.ok(D.isNewDay(null, '2026-03-10'));
  assert.ok(D.isNewDay('2026-03-09', '2026-03-10'));
  assert.ok(!D.isNewDay('2026-03-10', '2026-03-10'));
  assert.ok(!D.isNewDay('2026-03-11', '2026-03-10')); // date enregistrée dans le futur (horloge/fuseau changé)
});
