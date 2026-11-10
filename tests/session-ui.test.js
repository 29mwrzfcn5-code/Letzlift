require('./helpers/tz.js');
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, ev, sleep } = require('../tools/sandbox.js');
const { makeFakeDom } = require('./helpers/fakedom.js');

async function boot() {
  const app = loadApp({ now: Date.parse('2026-03-12T10:00:00Z') });
  assert.deepEqual(app.errors, []);
  await sleep(30);
  const dom = makeFakeDom(); app.ctx.document = dom;
  for (const id of ['vocab-session-container', 'vocab-minutes-slider', 'vocab-minutes-value', 'vocab-minutes-caption']) dom.add(id);
  return { ctx: app.ctx, dom };
}
const html = dom => dom.els.get('vocab-session-container').innerHTML;

test('coque de session : croix, progression, compteur, panneau de correction avec bouton', async () => {
  const { ctx } = await boot();
  const h = ev(ctx, `sessionShellHTML({ quit:'vocabQuit()', pct:35, pill:'<i></i>', left:'Question <b>7</b> / 20', tag:'À compléter', hint:'Quel mot manque ?', body:'<p>corps</p>', cap:'cap', panelId:'p1', fbId:'f1', contId:'c1' })`);
  assert.match(h, /onclick="vocabQuit\(\)" aria-label="Quitter la session"/);
  assert.match(h, /aria-valuenow="35"/); assert.match(h, /width:35%/);
  assert.match(h, /Question <b>7<\/b> \/ 20/); assert.match(h, /Quel mot manque \?/);
  assert.match(h, /id="p1"[^>]*>\s*<div class="feedback" id="f1"/); assert.match(h, /id="c1"/);
  assert.match(ev(ctx, `sessionShellHTML({ quit:'q()', pct:250, body:'', panelId:'a', fbId:'b', contId:'c' })`), /aria-valuenow="100"/); // borne
});

test('la correction montre Roudi, un titre et le corps ; les données sont échappées par l’appelant', async () => {
  const { ctx, dom } = await boot();
  const panel = dom.add('p1'), fb = dom.add('f1');
  ev(ctx, `sessionPanel('p1', 'f1', 'wrong', 'Pas tout à fait', 'La bonne réponse : <b>Stull</b>')`);
  assert.equal(panel.className, 'sess-panel open wrong'); assert.equal(fb.className, 'feedback wrong');
  assert.match(fb.innerHTML, /fb-roudi/); assert.match(fb.innerHTML, /<b>Pas tout à fait<\/b>/); assert.match(fb.innerHTML, /id="f1-text"/);
  ev(ctx, `sessionPanel('p1', 'f1', 'wrong', '<img src=x>', 'ok')`);
  assert.ok(!fb.innerHTML.includes('<img'), 'le titre est échappé');
  assert.doesNotThrow(() => ev(ctx, `sessionPanel('absent', 'absent', 'correct', 't', 'b')`));
});

test('session : compteur, mode, panneau fermé au départ, croix sans réponse = retour au hub', async () => {
  const { ctx, dom } = await boot();
  ev(ctx, `switchView = n => { globalThis.__view = n; }; renderVocabHub = () => {};`);
  ev(ctx, `startVocabSession(); sessionQueue = VOCAB.slice(0, 5); sessionPlannedIds = new Set(sessionQueue.map(v => v.id)); sessionIndex = 0; pickCardMode = () => 'type'; nextCard();`);
  const h = html(dom);
  assert.match(h, /Question <b>1<\/b> \/ 5/); assert.match(h, /À compléter/); assert.match(h, /id="sess-panel"/); assert.ok(!/sess-panel open/.test(h));
  assert.match(h, /id="continue-wrap-vocab"/); assert.match(h, /id="answer-input"/);
  assert.ok(!/class="session-card"/.test(h), 'plus de carte plate');
  ev(ctx, 'vocabQuit()');
  assert.equal(ev(ctx, 'globalThis.__view'), 'vocab');
});

test('croix après une réponse : le bilan s’affiche avec le score et les mots à retravailler', async () => {
  const { ctx, dom } = await boot();
  ev(ctx, `switchView = n => {}; startVocabSession(); sessionQueue = VOCAB.slice(0, 4); sessionPlannedIds = new Set(sessionQueue.map(v => v.id)); sessionIndex = 0;`);
  ev(ctx, `sessionAnswered = 3; sessionCorrect = 2; sessionDifficultWords = new Map([['v1', { lu:'Moien', fr:'bonjour', status:'wrong' }]]); sessionSeenIds = new Set(['v1','v2','v3']);`);
  ev(ctx, 'vocabQuit()');
  const h = html(dom);
  assert.match(h, /Session terminée/); assert.match(h, /2<small>\/3<\/small>/); assert.match(h, /67 %/);
  assert.match(h, /Mots à retravailler/); assert.match(h, /Moien/);
  assert.match(h, /onclick="startVocabSession\(\)"/); assert.match(h, /Retour à l'accueil/);
});

test('hub Vocabulaire : un seul bouton principal, durée, statistiques, modes de révision, liste', async () => {
  const { ctx, dom } = await boot();
  ev(ctx, 'renderVocabHub()');
  const h = html(dom);
  assert.match(h, /class="screen-hdr"/); assert.match(h, /Session du jour/);
  assert.match(h, /onclick="startVocabSession\(\)"/); assert.equal((h.match(/startVocabSession\(\)/g) || []).length, 1);
  for (const label of ['Mots difficiles', 'Remise en confiance', 'Révision des acquis', 'Test de placement', 'Voir la liste complète', 'Enrichir ou modifier']) assert.match(h, new RegExp(label));
  for (const id of ['vocab-minutes-slider', 'vocab-minutes-value', 'vocab-minutes-caption']) assert.match(h, new RegExp(`id="${id}"`));
});

test('jeu « Genre et n » : même coque, chrono en pastille, panneau de correction', async () => {
  const { ctx, dom } = await boot();
  dom.add('article-container');
  ev(ctx, `switchView = n => {}; startArticleGame(); clearInterval(artTimerInterval);`);
  const h = dom.els.get('article-container').innerHTML;
  assert.match(h, /onclick="artQuit\(\)"/); assert.match(h, /id="art-timer"/); assert.match(h, /Question <b>1<\/b> \/ 15/);
  assert.match(h, /id="art-panel"/); assert.match(h, /id="continue-wrap-art"/); assert.match(h, /Le chrono s&#39;arrête|Le chrono s'arrête/);
});
