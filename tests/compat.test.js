require('./helpers/tz.js');
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, loadArchive, ev, sleep } = require('../tools/sandbox.js');

const json = (ctx, expr) => JSON.parse(ev(ctx, `JSON.stringify(${expr})`));

// État représentatif, injecté dans la v1.18.0 pour fabriquer de vraies sauvegardes v1.18.0.
const SEED = `
  vocabProgress = { v1: { box: 3, dueAt: 1760000000000, wrongCount: 2 }, v2: { box: 1, dueAt: 0, learningStep: 1 }, v3: { box: 5, dueAt: 1770000000000 } };
  grammarProgress = { g1: true };
  smalltalkProgress = { 'st-aarbecht-0': true };
  sessionStats = { streakDays: 6, lastActiveDate: '2026-03-09', totalReviews: 42, totalSessions: 5, totalDaysActive: 9, pauseTokens: 1,
    lastTokenAwardStreak: 5, totalActiveSeconds: 900, lastWeeklyReviewWeek: '2026-03-09', totalAnswered: 40, totalCorrect: 30,
    lastBackupExportAt: '2026-03-01', vacationStart: null, vacationEnd: null };
  xpState = { enduranceXP: 220, arcadeXP: 15 };
  dailyState = { date: '2026-03-09', xpToday: 12, newWordsToday: 2, activeSeconds: 60 };
  gameRecords = { flash: 41 };
  dailyHistory = [{ date: '2026-03-08', xp: 50, newWords: 3, answered: 20, correct: 15, seconds: 300 }];
`;

function v118Backup(name) {
  const { ctx, errors } = loadArchive({ now: Date.parse('2026-03-09T23:00:00Z') });
  assert.deepEqual(errors, []);
  const ids = json(ctx, 'VOCAB.slice(0,3).map(v=>v.id)');
  let seed = SEED.replace('v1:', `'${ids[0]}':`).replace('v2:', `'${ids[1]}':`).replace('v3:', `'${ids[2]}':`);
  seed += `userProfile = { name: ${JSON.stringify(name)}, sessionMinutes: 15, onboardingDone: true, keyboardNavEnabled: true, backupReminderDays: 7 };`;
  ev(ctx, seed);
  return { text: ev(ctx, 'JSON.stringify(buildBackupPayload(), null, 2)'), ids };
}

async function importInto(app, text) {
  const input = { files: [{ size: text.length, text: async () => text }], value: 'x' };
  await ev(app.ctx, 'handleImportBackupFile')(input);
}

test('tous les scripts de index.html se chargent sans erreur', () => {
  const { errors } = loadApp();
  assert.deepEqual(errors, []);
});

test('une sauvegarde exportée par la v1.18.0 est validée et importée sans erreur', async () => {
  const { text, ids } = v118Backup('Léa');
  const app = loadApp({ now: Date.parse('2026-03-10T09:00:00Z') });
  assert.deepEqual(app.errors, []);
  await sleep(20);
  assert.doesNotThrow(() => ev(app.ctx, `validateBackupPayload(${text})`));
  await importInto(app, text);
  assert.deepEqual(Object.keys(json(app.ctx, 'vocabProgress')).sort(), [...ids].sort());
  assert.equal(json(app.ctx, 'userProfile.name'), 'Léa');
  assert.equal(json(app.ctx, 'xpState.enduranceXP'), 220);
  assert.equal(json(app.ctx, 'dailyHistory.length'), 2); // + la journée du 9, archivée au changement de jour
  assert.equal(json(app.ctx, 'vocabProgress')[ids[1]].learningStep, 1);
});

test('la sauvegarde produite par la nouvelle version a exactement la même forme que celle de la v1.18.0', async () => {
  const { text } = v118Backup('Léa');
  const app = loadApp({ now: Date.parse('2026-03-10T09:00:00Z') });
  await sleep(20);
  await importInto(app, text);
  const fresh = JSON.parse(ev(app.ctx, 'JSON.stringify(buildBackupPayload())'));
  const old = JSON.parse(text);
  assert.equal(fresh.app, old.app);
  assert.equal(fresh.formatVersion, old.formatVersion);
  assert.deepEqual(Object.keys(fresh.data), Object.keys(old.data));
  assert.deepEqual(fresh.data.vocabProgress, old.data.vocabProgress);
  assert.deepEqual(fresh.data.userProfile, old.data.userProfile);
});

test('bug du prénom : une sauvegarde v1.18.0 dont le prénom contient < ou > s’importe (caractères retirés)', async () => {
  const { text } = v118Backup('Max <b>le</b> grand');
  // la v1.18.0 elle-même refusait de la réimporter :
  const old = loadArchive();
  assert.throws(() => ev(old.ctx, `validateBackupPayload(${text})`), /contenu invalide/);
  // la version actuelle la répare avant validation :
  const app = loadApp({ now: Date.parse('2026-03-10T09:00:00Z') });
  await sleep(20);
  await importInto(app, text);
  assert.equal(json(app.ctx, 'userProfile.name'), 'Max ble/b grand');
  assert.equal(Object.keys(json(app.ctx, 'vocabProgress')).length, 3);
});

test('prénom déjà enregistré avec < ou > : réparé au chargement', async () => {
  const profile = JSON.stringify({ name: 'Zoé<script>', sessionMinutes: 10, onboardingDone: true, keyboardNavEnabled: true, backupReminderDays: 7 });
  const app = loadApp({ storage: { 'letzlift:profile': profile }, now: Date.parse('2026-03-10T09:00:00Z') });
  await sleep(30);
  assert.equal(json(app.ctx, 'userProfile.name'), 'Zoéscript');
  assert.equal(JSON.parse(app.ctx.__store.get('letzlift:profile')).name, 'Zoéscript');
  assert.doesNotThrow(() => ev(app.ctx, 'validateBackupPayload(JSON.parse(JSON.stringify(buildBackupPayload())))'));
});

test('saisie du prénom : < et > refusés (réglages)', async () => {
  const app = loadApp();
  await sleep(30); // laisse init() finir avant de remplacer le faux DOM
  ev(app.ctx, `
    var __fb = { className: '', textContent: '' };
    document = { getElementById: id => id === 'settings-name-input' ? { value: 'a<b' } : __fb };
    saveSettingsName();
  `);
  assert.equal(ev(app.ctx, '__fb.className'), 'feedback wrong');
  assert.match(ev(app.ctx, '__fb.textContent'), /ne sont pas autorisés/);
  assert.notEqual(ev(app.ctx, 'userProfile.name'), 'a<b');
});

// ---- données existantes calculées en UTC ----

const LEGACY_STORAGE = (lastActive, dailyDate) => ({
  'letzlift:session-stats': JSON.stringify({ streakDays: 6, lastActiveDate: lastActive, totalReviews: 1, totalSessions: 1, totalDaysActive: 6, pauseTokens: 0,
    lastTokenAwardStreak: 5, totalActiveSeconds: 0, lastWeeklyReviewWeek: '2026-03-09', totalAnswered: 1, totalCorrect: 1, lastBackupExportAt: null }),
  'letzlift:daily-state': JSON.stringify({ date: dailyDate, xpToday: 30, newWordsToday: 2, activeSeconds: 120, answeredToday: 4, correctToday: 3 }),
  'letzlift:profile': JSON.stringify({ name: 'Max', sessionMinutes: 10, onboardingDone: true, keyboardNavEnabled: true, backupReminderDays: 7 }),
});

test('données UTC existantes, usage normal : la série continue au premier lancement du lendemain', async () => {
  // dernière activité le 9 à 22 h (date UTC = date locale = 9), ouverture le 10 à 09 h
  const app = loadApp({ storage: LEGACY_STORAGE('2026-03-09', '2026-03-09'), now: Date.parse('2026-03-10T08:00:00Z') });
  await sleep(30);
  assert.equal(json(app.ctx, 'sessionStats.streakDays'), 7);
  assert.equal(json(app.ctx, 'sessionStats.lastActiveDate'), '2026-03-10');
  assert.equal(json(app.ctx, 'dailyState.date'), '2026-03-10');
  assert.equal(json(app.ctx, 'dailyState.xpToday'), 0);
  assert.equal(json(app.ctx, 'dailyHistory.length'), 1); // la journée du 9 est archivée
  assert.equal(json(app.ctx, 'dailyHistory[0].date'), '2026-03-09');
  assert.equal(json(app.ctx, 'dailyHistory[0].xp'), 30);
});

test('données UTC existantes, cas limite : activité à 00h30 locale enregistrée sous la veille UTC', async () => {
  // v1.18.0 a écrit lastActiveDate = « 9 mars » pour une session faite à 00h30 le 10 (heure locale).
  // Ouverture le 10 à 09 h : la date locale est le 10 → +1. Sur-comptage possible d'un seul jour,
  // une fois, au moment du changement de version — jamais de série cassée.
  const app = loadApp({ storage: LEGACY_STORAGE('2026-03-09', '2026-03-09'), now: Date.parse('2026-03-10T08:00:00Z') });
  await sleep(30);
  assert.ok(json(app.ctx, 'sessionStats.streakDays') >= 6);
});

test('données UTC existantes : une date enregistrée « dans le futur » ne casse rien', async () => {
  const app = loadApp({ storage: LEGACY_STORAGE('2026-03-12', '2026-03-12'), now: Date.parse('2026-03-10T08:00:00Z') });
  await sleep(30);
  assert.equal(json(app.ctx, 'sessionStats.streakDays'), 6);
  assert.equal(json(app.ctx, 'dailyState.date'), '2026-03-12');
  assert.equal(json(app.ctx, 'dailyState.xpToday'), 30);
  assert.equal(json(app.ctx, 'dailyHistory.length'), 0);
});

test('minuit : à 00h30 locale, le jour et la série ont déjà basculé', async () => {
  const app = loadApp({ storage: LEGACY_STORAGE('2026-03-09', '2026-03-09'), now: Date.parse('2026-03-09T23:30:00Z') });
  await sleep(30);
  assert.equal(json(app.ctx, 'dailyState.date'), '2026-03-10');
  assert.equal(json(app.ctx, 'sessionStats.lastActiveDate'), '2026-03-10');
  assert.equal(json(app.ctx, 'sessionStats.streakDays'), 7);
  // à la même heure, la v1.18.0 croyait encore être le 9
  const old = loadArchive({ storage: LEGACY_STORAGE('2026-03-09', '2026-03-09'), now: Date.parse('2026-03-09T23:30:00Z') });
  await sleep(30);
  assert.equal(json(old.ctx, 'dailyState.date'), '2026-03-09');
  assert.equal(json(old.ctx, 'sessionStats.streakDays'), 6);
});

test('app laissée ouverte à travers minuit : ensureDailyState fait avancer la série', async () => {
  const app = loadApp({ storage: LEGACY_STORAGE('2026-03-09', '2026-03-09'), now: Date.parse('2026-03-09T21:00:00Z') });
  await sleep(30);
  assert.equal(json(app.ctx, 'sessionStats.streakDays'), 6);   // 22 h le 9 : pas de changement
  // minuit passe : on réinstalle une horloge plus tardive dans le même contexte
  const later = Date.parse('2026-03-09T23:30:00Z');
  ev(app.ctx, `Date.now = () => ${later}; globalThis.Date = class extends Date { constructor(...a){ if(a.length===0) super(${later}); else super(...a);} static now(){ return ${later}; } };`);
  ev(app.ctx, 'ensureDailyState()');
  assert.equal(json(app.ctx, 'dailyState.date'), '2026-03-10');
  assert.equal(json(app.ctx, 'sessionStats.streakDays'), 7);
});
