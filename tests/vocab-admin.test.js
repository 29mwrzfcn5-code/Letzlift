require('./helpers/tz.js');
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, loadArchive, ev, sleep } = require('../tools/sandbox.js');
const { makeFakeDom } = require('./helpers/fakedom.js');

const NOW = Date.parse('2026-03-10T09:00:00Z');
const json = (ctx, expr) => JSON.parse(ev(ctx, `JSON.stringify(${expr})`));

async function boot(storage) {
  const app = loadApp({ now: NOW, storage });
  assert.deepEqual(app.errors, []);
  await sleep(30); // init() fini : on peut remplacer le faux DOM
  const dom = makeFakeDom();
  app.ctx.document = dom;
  for (const id of ['vocab-admin-container', 'vocab-enrich-container', 'niveau-container', 'parametres-container', 'settings-minutes-slider', 'hero-section']) dom.add(id);
  for (const k of ['lu', 'fr', 'cat', 'g', 'sentence', 'sentenceFr', 'note', 'search']) dom.add('va-' + k);
  return { app, ctx: app.ctx, dom };
}
function fill(dom, f) {
  const base = { lu: '', fr: '', cat: '', g: '', sentence: '', sentenceFr: '', note: '' };
  for (const [k, v] of Object.entries({ ...base, ...f })) dom.els.get('va-' + k).value = v;
}
const KUERF = { lu: 'Kuerf', fr: 'panier', cat: 'Divers', g: 'c', sentence: 'Ech hunn e ___.', sentenceFr: 'J\'ai un panier.' };
const container = dom => dom.els.get('vocab-admin-container').innerHTML;
const storedOverlay = ctx => JSON.parse(ctx.__store.get('letzlift:vocab-overlay') || '{}');

test('ajout : id automatique, prise en compte immédiate, persistance, mot « nouveau » pour les sessions', async () => {
  const { ctx, dom } = await boot();
  const before = json(ctx, 'VOCAB.length');
  fill(dom, KUERF);
  await ev(ctx, 'vocabAdminSave()');
  assert.equal(json(ctx, 'VOCAB.length'), before + 1);
  const w = json(ctx, 'VOCAB[VOCAB.length-1]');
  assert.deepEqual(w, { lu: 'Kuerf', fr: 'panier', cat: 'Divers', g: 'c', sentence: 'Ech hunn e ___.', sentenceFr: 'J\'ai un panier.', id: 'perso1' });
  assert.deepEqual(storedOverlay(ctx).perso1, { lu: 'Kuerf', fr: 'panier', cat: 'Divers', g: 'c', sentence: 'Ech hunn e ___.', sentenceFr: 'J\'ai un panier.' });
  assert.ok(json(ctx, "VOCAB.filter(v => !vocabProgress[v.id]).some(v => v.id === 'perso1')"));
  assert.match(container(dom), /ajouté \(perso1\)/);
  fill(dom, { ...KUERF, lu: 'Fësch', fr: 'poisson' });
  await ev(ctx, 'vocabAdminSave()');
  assert.equal(json(ctx, 'VOCAB[VOCAB.length-1].id'), 'perso2');
});

test('ajout invalide : rien n’est enregistré, les erreurs sont affichées', async () => {
  const { ctx, dom } = await boot();
  const before = json(ctx, 'VOCAB.length');
  fill(dom, { ...KUERF, sentence: 'Ech hunn e Kuerf.', cat: '' });
  await ev(ctx, 'vocabAdminSave()');
  assert.equal(json(ctx, 'VOCAB.length'), before);
  assert.deepEqual(storedOverlay(ctx), {});
  assert.deepEqual(Object.keys(json(ctx, 'vocabAdminState.errors')).sort(), ['cat', 'sentence']);
  assert.match(container(dom), /exactement un trou/);
});

test('doublon : le premier ajout est suspendu, le second (même mot) confirme', async () => {
  const { ctx, dom } = await boot();
  fill(dom, KUERF); await ev(ctx, 'vocabAdminSave()');
  const n = json(ctx, 'VOCAB.length');
  fill(dom, { ...KUERF, lu: 'kuerf', fr: 'corbeille' });
  await ev(ctx, 'vocabAdminSave()');
  assert.equal(json(ctx, 'VOCAB.length'), n);
  assert.equal(json(ctx, 'vocabAdminState.duplicates.length'), 1);
  assert.match(container(dom), /existe déjà/);
  assert.match(container(dom), /Ajouter quand même/);
  await ev(ctx, 'vocabAdminSave()');
  assert.equal(json(ctx, 'VOCAB.length'), n + 1);
  assert.equal(json(ctx, 'vocabAdminState.duplicates.length'), 0);
});

test('affichage : toute saisie est échappée', async () => {
  const { ctx, dom } = await boot();
  fill(dom, { ...KUERF, lu: 'd\'Äppel & co', fr: 'la pomme', sentence: 'Ech iessen en ___ & e Stéck Brout.' });
  await ev(ctx, 'vocabAdminSave()');
  const html = container(dom);
  assert.ok(html.includes('d&#39;Äppel &amp; co'));
  assert.ok(!html.includes('d\'Äppel & co'));
  // pas de code injecté non plus à la lecture d'un mot venu d'un import
  ev(ctx, `vocabOverlay['x1'] = { lu: 'a', fr: 'b', cat: 'c', sentence: '___', sentenceFr: 'z' }; VOCAB.push({ id: 'x1', lu: '<img src=x onerror=alert(1)>', fr: '"><script>', cat: 'c', sentence: '___', sentenceFr: 'z' }); renderVocabAdmin();`);
  const html2 = container(dom);
  assert.ok(!html2.includes('<img src=x'));
  assert.ok(!html2.includes('<script>'));
  assert.ok(html2.includes('&lt;img src=x onerror=alert(1)&gt;'));
});

test('correction d’un mot d’origine : surcouche, genre et note vidables, retour à l’original', async () => {
  const { ctx, dom } = await boot();
  const orig = json(ctx, "VOCAB.find(v => v.id === 'v123')"); // Kapp, genre « c »
  assert.equal(orig.g, 'c');
  ev(ctx, "vocabAdminEdit('v123')");
  const draft = json(ctx, 'vocabAdminState.draft');
  assert.equal(draft.lu, 'Kapp'); assert.equal(draft.g, 'c');
  fill(dom, { ...draft, fr: 'tête (corps)', g: '' });
  await ev(ctx, 'vocabAdminSave()');
  const now = json(ctx, "VOCAB.find(v => v.id === 'v123')");
  assert.equal(now.fr, 'tête (corps)');
  assert.ok(!now.g); // genre vidé
  assert.equal(json(ctx, 'VOCAB.length'), 386);
  assert.equal(storedOverlay(ctx).v123.g, '');
  assert.equal(json(ctx, 'vocabAdminState.editingId'), null);
  // le mot est dans « Mots d'origine modifiés » ; on rétablit
  assert.match(container(dom), /Mots d'origine modifiés \(1\)/);
  await ev(ctx, "vocabAdminRestore('v123')");
  assert.deepEqual(storedOverlay(ctx), {});
  assert.match(container(dom), /prochain rechargement/);
});

test('suppression : seulement un mot ajouté, avec sa progression', async () => {
  const { ctx, dom } = await boot();
  fill(dom, KUERF); await ev(ctx, 'vocabAdminSave()');
  ev(ctx, "vocabProgress['perso1'] = { box: 2, dueAt: 1 }");
  await ev(ctx, "vocabAdminConfirmDelete('v1')"); // mot d'origine : refusé
  assert.equal(json(ctx, 'VOCAB.length'), 387);
  await ev(ctx, "vocabAdminConfirmDelete('perso1')");
  assert.equal(json(ctx, 'VOCAB.length'), 386);
  assert.ok(!json(ctx, "VOCAB.some(v => v.id === 'perso1')"));
  assert.deepEqual(storedOverlay(ctx), {});
  assert.ok(!('perso1' in json(ctx, 'vocabProgress')));
  assert.ok(!('perso1' in JSON.parse(ctx.__store.get('letzlift:vocab-progress'))));
  // la sauvegarde exportée ensuite reste importable ici
  assert.doesNotThrow(() => ev(ctx, 'validateBackupPayload(JSON.parse(JSON.stringify(buildBackupPayload())))'));
});

test('suppression en deux temps : demande puis confirmation', async () => {
  const { ctx, dom } = await boot();
  fill(dom, KUERF); await ev(ctx, 'vocabAdminSave()');
  ev(ctx, "vocabAdminAskDelete('perso1')");
  assert.match(container(dom), /Supprimer pour de bon/);
  ev(ctx, 'vocabAdminCancelDelete()');
  assert.ok(!/Supprimer pour de bon/.test(container(dom)));
  assert.equal(json(ctx, 'VOCAB.length'), 387);
});

test('rechargement : les mots ajoutés reviennent, et restent reconnus comme « à toi »', async () => {
  const a = await boot();
  fill(a.dom, KUERF); await ev(a.ctx, 'vocabAdminSave()');
  const b = await boot(Object.fromEntries(a.ctx.__store));
  assert.equal(json(b.ctx, 'VOCAB.length'), 387);
  assert.ok(json(b.ctx, "vaIsCustomWord('perso1')"));
  assert.ok(!json(b.ctx, "vaIsCustomWord('v1')"));
  assert.equal(json(b.ctx, 'BUILTIN_VOCAB_IDS.size'), 386);
});

test('copie de secours : « mes mots » (CSV) rend une sauvegarde JSON importable sur une installation vierge', async () => {
  const a = await boot();
  fill(a.dom, KUERF); await ev(a.ctx, 'vocabAdminSave()');
  ev(a.ctx, "vocabProgress['perso1'] = { box: 3, dueAt: 5 }");
  const backup = ev(a.ctx, 'JSON.stringify(buildBackupPayload())');
  ev(a.ctx, 'Blob = function(parts){ globalThis.__csv = parts[0]; }');
  ev(a.ctx, "exportVocabSpreadsheet('x', true)");
  const csv = ev(a.ctx, '__csv');
  const lines = csv.replace(/^﻿/, '').split('\r\n');
  assert.equal(lines.length, 2); // en-tête + le seul mot à toi
  assert.match(lines[1], /^perso1,Kuerf,panier,Divers,c,/);

  const b = await boot();
  // sans les mots : la restauration est refusée (comportement documenté dans le README)
  assert.throws(() => ev(b.ctx, `validateBackupPayload(${backup})`), /progression vocabulaire invalide/);
  // avec le CSV réimporté d'abord : elle passe
  await ev(b.ctx, 'handleImportVocabFile')({ files: [{ size: csv.length, text: async () => csv }], value: 'x' });
  assert.equal(json(b.ctx, 'VOCAB.length'), 387);
  assert.doesNotThrow(() => ev(b.ctx, `validateBackupPayload(${backup})`));
});

test('« Télécharger mes mots » exporte aussi les mots d’origine corrigés, et seulement ceux-là', async () => {
  const { ctx, dom } = await boot();
  ev(ctx, "vocabAdminEdit('v123')");
  fill(dom, { ...json(ctx, 'vocabAdminState.draft'), fr: 'tête (corps)' });
  await ev(ctx, 'vocabAdminSave()');
  ev(ctx, 'Blob = function(parts){ globalThis.__csv = parts[0]; }');
  ev(ctx, "exportVocabSpreadsheet('x', true)");
  const lines = ev(ctx, '__csv').replace(/^﻿/, '').split('\r\n');
  assert.equal(lines.length, 2);
  assert.match(lines[1], /^v123,Kapp,tête \(corps\)/);
});

// ---- bouton « Restaurer une sauvegarde » (Paramètres) ----

async function validBackupText() {
  const { ctx } = await boot();
  ev(ctx, "userProfile.name = 'Léa'");
  return ev(ctx, 'JSON.stringify(buildBackupPayload())');
}

test('v1.18.0 : « Restaurer » ne faisait rien tant que l’écran Niveau n’avait pas été ouvert', async () => {
  const old = loadArchive({ now: NOW });
  await sleep(30);
  const dom = makeFakeDom();
  old.ctx.document = dom;
  ev(old.ctx, 'triggerImportBackup()');
  assert.equal(dom.els.get('backup-import-input'), undefined); // aucun champ fichier, aucun clic
});

test('Restaurer depuis Paramètres : le champ fichier est créé à la demande, une seule fois', async () => {
  const { ctx, dom } = await boot();
  ev(ctx, 'triggerImportBackup()');
  const input = dom.els.get('backup-import-input');
  assert.ok(input);
  assert.equal(input.type, 'file');
  assert.equal(input.accept, 'application/json');
  assert.equal(input.clicked, 1);
  assert.equal(typeof input.listeners.change, 'function');
  ev(ctx, 'triggerImportBackup()');
  assert.equal(input.clicked, 2);
  assert.equal(dom.els.get('backup-import-input'), input);
});

test('Restaurer depuis Paramètres : résultat affiché sur place, réglages rafraîchis', async () => {
  const text = await validBackupText();
  const { ctx, dom } = await boot();
  dom.add('view-parametres').classList.add('active');
  dom.add('settings-backup-actions');
  ev(ctx, 'triggerImportBackup()');
  const input = dom.els.get('backup-import-input');
  input.files = [{ size: text.length, text: async () => text }];
  await input.listeners.change();
  const status = dom.els.get('settings-backup-status');
  assert.ok(status);
  assert.match(status.textContent, /^Progression restaurée \(sauvegarde du 2026-03-10\)/);
  assert.equal(status.className, 'feedback correct');
  assert.equal(json(ctx, 'userProfile.name'), 'Léa');
  assert.match(dom.els.get('parametres-container').innerHTML, /value="Léa"/);
});

test('Restaurer depuis Paramètres : un fichier invalide donne un message d’erreur visible', async () => {
  const { ctx, dom } = await boot();
  dom.add('view-parametres').classList.add('active');
  dom.add('settings-backup-actions');
  ev(ctx, 'triggerImportBackup()');
  const input = dom.els.get('backup-import-input');
  const text = '{"pas":"une sauvegarde"}';
  input.files = [{ size: text.length, text: async () => text }];
  await input.listeners.change();
  assert.match(dom.els.get('settings-backup-status').textContent, /pas une sauvegarde LetzLift valide/);
  assert.equal(dom.els.get('settings-backup-status').className, 'feedback wrong');
});

// ---- texte d'onboarding ----

test('onboarding : nouveau texte (app installée), plus de « ce fichier / cet ordinateur »', async () => {
  const { ctx, dom } = await boot();
  ev(ctx, "userProfile.name = 'Max'; userProfile.onboardingDone = false; renderHome()");
  const html = dom.els.get('hero-section').innerHTML;
  assert.match(html, /Ta progression est enregistrée sur cet appareil, dans cette app, sans compte ni serveur\./);
  assert.match(html, /télécharge une sauvegarde \(écran Niveau → Sauvegarde\) et restaure-la sur le nouvel appareil/);
  assert.match(html, /Ne vide <strong>jamais<\/strong> les données du site ou de l'app/);
  assert.match(html, /Télécharge une sauvegarde de temps en temps : l'app te le rappellera\./);
  assert.ok(!/ce fichier|cet ordinateur|\.html/.test(html));
  assert.match(html, /Avant de commencer, Max/);
});
