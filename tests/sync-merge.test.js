const test = require('node:test');
const assert = require('node:assert/strict');
const { mergeData } = require('../js/lib/sync-merge.js');

const same = (a, b) => assert.deepEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)));

test('progression : la réponse la plus récente gagne, wrongCount garde le plus grand', () => {
  const local = { vocabProgress: { v1: { box: 3, dueAt: 500, updatedAt: 200, wrongCount: 1 }, v2: { box: 2, dueAt: 10, updatedAt: 50 } } };
  const remote = { vocabProgress: { v1: { box: 1, dueAt: 900, updatedAt: 100, wrongCount: 4 }, v3: { box: 5, dueAt: 7, updatedAt: 1 } } };
  const m = mergeData(local, remote).vocabProgress;
  same(m.v1, { box: 3, dueAt: 500, updatedAt: 200, wrongCount: 4 });
  same(m.v2, local.vocabProgress.v2); same(m.v3, remote.vocabProgress.v3);
});

test('progression sans horodatage (anciennes données) : l’échéance la plus lointaine gagne', () => {
  const m = mergeData({ vocabProgress: { v1: { box: 2, dueAt: 100 } } }, { vocabProgress: { v1: { box: 4, dueAt: 900 } } }).vocabProgress;
  assert.equal(m.v1.box, 4);
  const m2 = mergeData({ vocabProgress: { v1: { box: 2, dueAt: 100 } } }, { vocabProgress: { v1: { box: 4, dueAt: 90, updatedAt: 5 } } }).vocabProgress;
  assert.equal(m2.v1.box, 4); // l’horodaté l’emporte sur l’ancien
});

test('cours, grammaire, small talk : union ; une fiche faite reste faite', () => {
  const m = mergeData(
    { courseProgress: { 'l01:w:a': { box: 2, dueAt: 1, updatedAt: 9 } }, grammarProgress: { g1: true }, smalltalkProgress: { a: false, b: true } },
    { courseProgress: { 'l02:w:b': { box: 1, dueAt: 1, updatedAt: 3 } }, grammarProgress: { g2: true }, smalltalkProgress: { a: true, b: false } });
  assert.deepEqual(Object.keys(m.courseProgress), ['l01:w:a', 'l02:w:b']);
  assert.deepEqual(m.grammarProgress, { g1: true, g2: true });
  assert.deepEqual(m.smalltalkProgress, { a: true, b: true });
});

test('statistiques : compteurs au maximum, série de l’appareil le plus récemment actif', () => {
  const local = { sessionStats: { streakDays: 3, lastActiveDate: '2026-11-08', totalReviews: 100, totalAnswered: 50, pauseTokens: 0, lastBackupExportAt: '2026-10-01' } };
  const remote = { sessionStats: { streakDays: 9, lastActiveDate: '2026-11-09', totalReviews: 80, totalAnswered: 70, pauseTokens: 2, lastBackupExportAt: '2026-11-02' } };
  const s = mergeData(local, remote).sessionStats;
  assert.equal(s.streakDays, 9); assert.equal(s.pauseTokens, 2); assert.equal(s.lastActiveDate, '2026-11-09');
  assert.equal(s.totalReviews, 100); assert.equal(s.totalAnswered, 70); assert.equal(s.lastBackupExportAt, '2026-11-02');
});

test('XP au maximum ; jour en cours : le plus récent, à date égale le plus avancé', () => {
  const m = mergeData({ xpState: { enduranceXP: 220, arcadeXP: 5 }, dailyState: { date: '2026-11-09', xpToday: 10, newWordsToday: 1 } },
    { xpState: { enduranceXP: 200, arcadeXP: 15 }, dailyState: { date: '2026-11-09', xpToday: 30, newWordsToday: 2 } });
  assert.deepEqual(m.xpState, { arcadeXP: 15, enduranceXP: 220 });
  assert.equal(m.dailyState.xpToday, 30);
  const later = mergeData({ dailyState: { date: '2026-11-10', xpToday: 1 } }, { dailyState: { date: '2026-11-09', xpToday: 99 } });
  assert.equal(later.dailyState.date, '2026-11-10');
});

test('records : plus petit temps, plus haut score (phrasedrill)', () => {
  const m = mergeData({ gameRecords: { flash: 41, phrasedrill: 80, memory: 30 } }, { gameRecords: { flash: 35, phrasedrill: 95, intrus: 22 } }).gameRecords;
  assert.deepEqual(m, { flash: 35, intrus: 22, memory: 30, phrasedrill: 95 });
});

test('historique : union par date, le jour le plus complet gagne, trié', () => {
  const m = mergeData({ dailyHistory: [{ date: '2026-11-02', answered: 5, xp: 10 }, { date: '2026-11-01', answered: 20, xp: 50 }] },
    { dailyHistory: [{ date: '2026-11-02', answered: 15, xp: 40 }, { date: '2026-11-03', answered: 1, xp: 1 }] }).dailyHistory;
  assert.deepEqual(m.map(d => d.date), ['2026-11-01', '2026-11-02', '2026-11-03']);
  assert.equal(m[1].answered, 15);
});

test('profil : celui de cet appareil, prénom et accueil récupérés si absents', () => {
  const m = mergeData({ userProfile: { name: null, sessionMinutes: 15, onboardingDone: false } }, { userProfile: { name: 'Max', sessionMinutes: 10, onboardingDone: true } }).userProfile;
  assert.equal(m.name, 'Max'); assert.equal(m.sessionMinutes, 15); assert.equal(m.onboardingDone, true);
});

test('mots personnels : union, la version la plus récente gagne', () => {
  const m = mergeData({ vocabOverlay: { perso1: { lu: 'a', updatedAt: 5 }, v10: { note: 'x', updatedAt: 9 } } },
    { vocabOverlay: { perso1: { lu: 'b', updatedAt: 7 }, perso2: { lu: 'c', updatedAt: 1 } } }).vocabOverlay;
  assert.equal(m.perso1.lu, 'b'); assert.equal(m.v10.note, 'x'); assert.equal(m.perso2.lu, 'c');
});

test('fusion idempotente et sans effet de bord sur les entrées', () => {
  const a = { vocabProgress: { v1: { box: 3, dueAt: 5, updatedAt: 8, wrongCount: 2 } }, gameRecords: { flash: 10 }, dailyHistory: [{ date: '2026-11-01', answered: 3 }],
    sessionStats: { streakDays: 2, lastActiveDate: '2026-11-01', totalReviews: 4 }, courseProgress: { x: { box: 2, dueAt: 1, updatedAt: 2 } } };
  const b = { vocabProgress: { v1: { box: 1, dueAt: 9, updatedAt: 3 }, v2: { box: 2, dueAt: 1, updatedAt: 1 } }, gameRecords: { flash: 12 }, dailyHistory: [{ date: '2026-11-04', answered: 9 }],
    sessionStats: { streakDays: 5, lastActiveDate: '2026-11-04', totalReviews: 1 } };
  const snapA = JSON.stringify(a), snapB = JSON.stringify(b);
  const m = mergeData(a, b);
  assert.equal(JSON.stringify(a), snapA); assert.equal(JSON.stringify(b), snapB);
  same(mergeData(m, b), m); same(mergeData(m, a), m); same(mergeData(b, a), mergeData(a, b));
  same(mergeData(m, m), m);
});

test('entrées vides ou absentes', () => {
  const m = mergeData({}, undefined);
  assert.deepEqual(m.vocabProgress, {}); assert.deepEqual(m.dailyHistory, []); assert.deepEqual(m.gameRecords, {});
  const only = mergeData({ vocabProgress: { v1: { box: 2, dueAt: 1 } } }, {});
  assert.equal(only.vocabProgress.v1.box, 2);
});
