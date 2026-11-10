const test = require('node:test');
const assert = require('node:assert/strict');
const W = require('../js/lib/weekly-goal.js');

test('objectif : valeur par défaut et bornes', () => {
  assert.equal(W.clampGoal(undefined), 5); assert.equal(W.clampGoal('3'), 3); assert.equal(W.clampGoal(0), 5);
  assert.equal(W.clampGoal(8), 5); assert.equal(W.clampGoal(7), 7); assert.equal(W.clampGoal(1), 1);
});

test('semaine en cours : atteint, bien parti, juste, hors de portée', () => {
  assert.equal(W.goalStatus(5, 5, 2, false).state, 'reached');
  assert.equal(W.goalStatus(6, 5, 1, false).state, 'reached');
  assert.equal(W.goalStatus(2, 5, 5, false).state, 'ontrack');   // il reste 3 jours à faire, 5 possibles
  assert.equal(W.goalStatus(3, 5, 2, false).state, 'tight');     // il faut tous les jours restants
  assert.equal(W.goalStatus(1, 5, 2, false).state, 'off');       // 4 jours à faire, 2 possibles
  assert.equal(W.goalStatus(3, 5, 2, false).remaining, 2);
  assert.equal(W.goalStatus(2, 5, 4, false).pct, 40);
});

test('semaine terminée : atteint ou manqué, jamais « hors de portée »', () => {
  assert.equal(W.goalStatus(5, 5, 0, true).state, 'reached');
  assert.equal(W.goalStatus(4, 5, 0, true).state, 'missed');
  assert.equal(W.goalStatus(0, 5, 0, true).state, 'missed');
});

test('messages : jamais punitifs, précis sur ce qui reste à faire', () => {
  assert.match(W.goalMessage(W.goalStatus(5, 5, 2, false)), /Objectif atteint/);
  assert.match(W.goalMessage(W.goalStatus(6, 5, 1, false)), /dépassé/);
  assert.match(W.goalMessage(W.goalStatus(2, 5, 5, false)), /Encore 3 jours/);
  assert.match(W.goalMessage(W.goalStatus(4, 5, 1, false)), /Il te faut le jour qui reste/);
  assert.match(W.goalMessage(W.goalStatus(3, 5, 2, false)), /chacun des 2 jours qui restent/);
  assert.match(W.goalMessage(W.goalStatus(1, 5, 2, false)), /pas grave/);
  assert.match(W.goalMessage(W.goalStatus(4, 5, 0, true)), /Presque ! 4 jours sur 5/);
  assert.match(W.goalMessage(W.goalStatus(1, 5, 0, true)), /Semaine plus légère/);
  for (const st of [W.goalStatus(0, 7, 0, true), W.goalStatus(0, 3, 1, false), W.goalStatus(2, 7, 3, false)]) assert.ok(!/nul|échec|raté|honte/i.test(W.goalMessage(st)));
});

test('phrase de Roudi selon la situation', () => {
  assert.match(W.roudiWeekLine(W.goalStatus(0, 5, 7, false), true, true), /Première semaine/);
  assert.match(W.roudiWeekLine(W.goalStatus(5, 5, 1, false), true, false), /déjà tenu/);
  assert.match(W.roudiWeekLine(W.goalStatus(5, 5, 0, true), false, false), /Objectif tenu/);
  assert.match(W.roudiWeekLine(W.goalStatus(2, 5, 0, true), false, false), /2 fois/);
  assert.match(W.roudiWeekLine(W.goalStatus(0, 5, 0, true), false, false), /On repart ensemble|repart/);
});

// ---- dans l'application ----
const { loadApp, ev, sleep } = require('../tools/sandbox.js');
const { makeFakeDom } = require('./helpers/fakedom.js');
const json = (ctx, expr) => JSON.parse(ev(ctx, `JSON.stringify(${expr})`));
const NOW = Date.parse('2026-03-12T10:00:00Z'); // jeudi 12 mars 2026 (lundi : 9 mars)

async function boot() {
  const app = loadApp({ now: NOW });
  assert.deepEqual(app.errors, []);
  await sleep(30);
  return app.ctx;
}

test('semaine en cours : jours pratiqués, jours restants, aujourd’hui compté une seule fois', async () => {
  const c = await boot();
  ev(c, `dailyHistory = [{date:'2026-03-09',xp:10,newWords:2,answered:10,correct:8,seconds:300},{date:'2026-03-11',xp:5,newWords:0,answered:5,correct:5,seconds:120}]; userProfile.weeklyGoalDays = 5; dailyState = Object.assign({}, dailyState, {date:'2026-03-12', xpToday:0, answeredToday:0, activeSeconds:0});`);
  let g = json(c, `weeklyGoalFor('2026-03-09', true).st`);
  assert.deepEqual([g.done, g.goal, g.chancesLeft, g.state], [2, 5, 4, 'ontrack']); // jeudi, vendredi, samedi, dimanche encore possibles
  ev(c, `dailyState.answeredToday = 12; dailyState.xpToday = 8;`); // aujourd'hui : de l'activité
  g = json(c, `weeklyGoalFor('2026-03-09', true).st`);
  assert.deepEqual([g.done, g.chancesLeft, g.state], [3, 3, 'ontrack']); // 2 jours à faire, 3 possibles
  ev(c, `userProfile.weeklyGoalDays = 6`);
  assert.equal(json(c, `weeklyGoalFor('2026-03-09', true).st.state`), 'tight'); // 3 à faire, 3 possibles
  ev(c, `userProfile.weeklyGoalDays = 3`);
  assert.equal(json(c, `weeklyGoalFor('2026-03-09', true).st.state`), 'reached');
  ev(c, `userProfile.weeklyGoalDays = undefined`);
  assert.equal(json(c, `weeklyGoalFor('2026-03-09', true).st.goal`), 5); // valeur par défaut
});

test('semaine terminée : jamais « hors de portée », objectif atteint ou manqué', async () => {
  const c = await boot();
  ev(c, `dailyHistory = ['2026-03-02','2026-03-03','2026-03-04','2026-03-06'].map(d => ({date:d,xp:1,newWords:0,answered:3,correct:3,seconds:60})); userProfile.weeklyGoalDays = 5;`);
  assert.equal(json(c, `weeklyGoalFor('2026-03-02', false).st.state`), 'missed');
  ev(c, `userProfile.weeklyGoalDays = 3`);
  assert.equal(json(c, `weeklyGoalFor('2026-03-02', false).st.state`), 'reached');
});

test('bilan : l’objectif, la phrase de Roudi et le choix de l’objectif suivant s’affichent ; changer l’objectif le sauvegarde et redessine', async () => {
  const c = await boot();
  const dom = makeFakeDom(); c.document = dom;
  for (const id of ['weekly-modal', 'weekly-overlay', 'view-home']) dom.add(id);
  ev(c, `dailyHistory = [{date:'2026-03-09',xp:10,newWords:2,answered:10,correct:8,seconds:300},{date:'2026-03-10',xp:5,newWords:0,answered:5,correct:5,seconds:120}]; userProfile.weeklyGoalDays = 3; sessionStats.totalDaysActive = 20; sessionStats.lastWeeklyReviewWeek = '2026-03-09';`);
  ev(c, `showWeeklyReview('2026-03-09', { live:true })`);
  const html = dom.els.get('weekly-modal').innerHTML;
  assert.match(html, /Objectif : 2 \/ 3 jours/); assert.match(html, /Encore 1 jour pour atteindre/); assert.match(html, /Ton objectif par semaine/);
  assert.match(html, /aria-pressed="true">3 jours/);
  ev(c, `setWeeklyGoal(5)`);
  assert.equal(json(c, 'userProfile.weeklyGoalDays'), 5);
  assert.match(dom.els.get('weekly-modal').innerHTML, /Objectif : 2 \/ 5 jours/);
  assert.match(c.__store.get('letzlift:profile'), /"weeklyGoalDays":5/);
  ev(c, `showWeeklyReview('2026-03-02')`); // bilan de la semaine passée : « pour la semaine qui vient »
  assert.match(dom.els.get('weekly-modal').innerHTML, /pour la semaine qui vient/);
});
