require('./helpers/tz.js');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const V = require('../js/lib/voyage.js');
const N = require('../js/lib/nrule.js');
const { loadApp, ev, sleep } = require('../tools/sandbox.js');
const { makeFakeDom } = require('./helpers/fakedom.js');

const root = path.join(__dirname, '..');
const loadData = (file, expr) => { const c = {}; vm.createContext(c); vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8') + ';this.X = ' + expr, c); return c.X; };
const UNITS = loadData('data/voyage.js', 'VOYAGE_UNITS');
const MANIFEST = JSON.parse(fs.readFileSync(path.join(root, 'tools/voyage-audio.json'), 'utf8'));
const VOCAB = loadData('data/vocab.js', 'VOCAB');
const json = (ctx, expr) => JSON.parse(ev(ctx, `JSON.stringify(${expr})`));

test('notation : exact, casse ignorée, accents seuls = presque, sinon faux', () => {
  assert.equal(V.voyageGrade('e', 'e'), 'correct');
  assert.equal(V.voyageGrade(' E ', 'e'), 'correct');
  assert.equal(V.voyageGrade('flasch', 'Fläsch'), 'almost');
  assert.equal(V.voyageGrade('en', 'e'), 'wrong');
  assert.equal(V.voyageGrade('', 'e'), 'empty');
});

test('étoiles : 3 si tout juste, 2 avec une erreur, 1 avec la moitié, 0 en dessous', () => {
  assert.deepEqual([4, 3, 2, 1, 0].map(n => V.voyageStars(n, 4)), [3, 2, 1, 0, 0]);
  assert.equal(V.voyageStars(0, 0), 0);
});

test('déblocage : une unité s’ouvre quand la précédente est validée ; on garde la meilleure note', () => {
  const units = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  let p = { units: {} };
  assert.deepEqual([0, 1, 2].map(i => V.voyageUnitState(p, units, i)), ['open', 'locked', 'locked']);
  p = V.voyageRecord(p, 'a', 2, 5);
  assert.deepEqual([0, 1, 2].map(i => V.voyageUnitState(p, units, i)), ['done', 'open', 'locked']);
  assert.equal(V.voyageCurrentIndex(p, units), 1);
  p = V.voyageRecord(p, 'a', 1, 6);
  assert.equal(p.units.a.stars, 2);
  p = V.voyageRecord(p, 'b', 0, 7);
  assert.equal(p.units.b.done, false);
  assert.equal(V.voyageCurrentIndex(V.voyageRecord(V.voyageRecord(p, 'b', 3, 8), 'c', 1, 9), units), 3);
});

test('données : chaque exercice a sa réponse, un seul trou, et la règle du n est respectée devant le trou', () => {
  for (const u of UNITS) {
    assert.ok(u.cards.length >= 6 && u.exercises.length >= 3 && u.scene.lines.length >= 4);
    for (const ex of u.exercises) {
      assert.ok(ex.before && ex.after && ex.answer && ex.fr && ex.why, ex.answer);
      if (ex.answer === 'e' || ex.answer === 'en') {
        const next = ex.after.split(/\s+/)[0];
        assert.equal(ex.answer, N.keepsN(next) ? 'en' : 'e', `devant « ${next} »`);
      }
    }
    for (const r of u.rule.examples) {
      assert.equal(r.art, r.keep ? 'en' : 'e', r.word);
      assert.equal(N.keepsN(r.word), r.keep, r.word);
      assert.equal(r.letter, r.word[0]);
    }
  }
});

test('données : les mots de l’unité existent dans le vocabulaire, avec le bon genre', () => {
  for (const u of UNITS) {
    for (const lu of u.words) assert.ok(VOCAB.some(v => v.lu === lu), lu);
    for (const c of u.cards.filter(x => x.art)) {
      const v = VOCAB.find(x => x.lu === c.lu);
      assert.ok(v, c.lu);
      assert.equal(v.g, c.g, `${c.lu} : fiche ${c.g} / vocabulaire ${v.g}`);
      assert.equal(c.art, N.indefinite(c.g, c.lu), c.lu);
    }
  }
});

test('son : tous les fichiers cités existent, sont décrits dans le manifeste, et pèsent peu', () => {
  for (const u of UNITS) {
    const used = new Set();
    u.scene.lines.forEach(l => used.add(l.audio));
    u.cards.forEach(c => { used.add(c.audio); if (c.exAudio) used.add(c.exAudio); });
    u.exercises.forEach(e => used.add(e.audio));
    const inManifest = new Set(MANIFEST.clips.map(c => c.id));
    for (const id of used) {
      assert.ok(inManifest.has(id), `${id} absent du manifeste`);
      const f = path.join(root, 'assets/audio/voyage', u.id, id + '.mp3');
      assert.ok(fs.existsSync(f), f);
      assert.ok(fs.statSync(f).size < 60000, f);
    }
  }
  assert.ok(MANIFEST.clips.every(c => c.voice === 'maxine' || c.voice === 'claude'), 'la voix « max » est interdite (non commerciale)');
});

test('manifeste : les textes sont en minuscules et sans espace avant la ponctuation (rendu validé à l’écoute)', () => {
  for (const c of MANIFEST.clips) {
    assert.equal(c.text, c.text.toLowerCase(), c.id);
    assert.doesNotMatch(c.text, / [?!]/, c.id);
  }
});

async function boot() {
  const app = loadApp({ now: Date.parse('2026-03-10T09:00:00Z') });
  assert.deepEqual(app.errors, []);
  await sleep(30);
  const dom = makeFakeDom();
  app.ctx.document = dom;
  for (const id of ['voyage-root']) dom.add(id);
  ev(app.ctx, 'feedbackSessionEnd = () => {}; feedbackCorrect = () => {}; feedbackWrong = () => {}'); // confettis et sons : hors sujet ici
  return { ctx: app.ctx, dom };
}

test('droits : sans « voyage » le module affiche qu’il n’est pas activé ; avec, la carte et l’unité', async () => {
  const { ctx, dom } = await boot();
  ev(ctx, 'renderVoyage()');
  assert.match(dom.els.get('voyage-root').innerHTML, /pas activé/);
  ev(ctx, "syncMe = { entitlements: ['voyage'], role: 'user' }; renderVoyage()");
  const html = dom.els.get('voyage-root').innerHTML;
  assert.match(html, /Faire ses courses/);
  assert.match(html, /Commencer l/);
  assert.doesNotMatch(html, /vy-play/);
});

test('droits : le son n’est proposé qu’avec le droit « audio »', async () => {
  const { ctx } = await boot();
  assert.equal(json(ctx, 'voyageAudioOn()'), false);
  ev(ctx, "syncMe = { entitlements: ['voyage', 'audio'], role: 'user' }");
  assert.equal(json(ctx, 'voyageAudioOn()'), true);
  ev(ctx, "voyageStart('courses')");
  assert.match(ctx.document.els.get('voyage-root').innerHTML, /vy-play/);
  ev(ctx, "syncMe = { entitlements: ['voyage'], role: 'user' }; voyageStart('courses')");
  assert.doesNotMatch(ctx.document.els.get('voyage-root').innerHTML, /vy-play/);
});

test('fin d’unité : étoiles et validation enregistrées, mots du vocabulaire ajoutés aux révisions, une seule fois', async () => {
  const { ctx } = await boot();
  ev(ctx, "syncMe = { entitlements: ['voyage'], role: 'user' }; voyageStart('courses'); voyageSession.results = [true, true, true, false]; voyageSession.step = 4; voyageShow()");
  assert.equal(json(ctx, "userProfile.voyage.units.courses.stars"), 2);
  assert.equal(json(ctx, "userProfile.voyage.units.courses.done"), true);
  const ids = ['Kéis', 'Mëllech', 'Brout', 'Fläsch', 'wannechgelift'].map(lu => VOCAB.find(v => v.lu === lu).id);
  for (const id of ids) {
    assert.equal(json(ctx, `vocabProgress['${id}'].box`), 2);
    assert.equal(json(ctx, `vocabProgress['${id}'].learningStep`), 3);
  }
  const before = json(ctx, 'JSON.stringify(vocabProgress)');
  ev(ctx, 'voyageShow()'); // réaffichage du bilan : rien ne change
  assert.equal(json(ctx, 'JSON.stringify(vocabProgress)'), before);
});

test('fin d’unité ratée : pas d’étoile, rien ajouté aux révisions, unité non validée', async () => {
  const { ctx } = await boot();
  ev(ctx, "voyageStart('courses'); voyageSession.results = [false, false, false, false]; voyageSession.step = 4; voyageShow()");
  assert.equal(json(ctx, "userProfile.voyage.units.courses.done"), false);
  assert.equal(json(ctx, "Object.keys(vocabProgress).length"), 0);
});

test('la barre du bas : « Mon voyage » prend la place de « Grammaire » pour les comptes autorisés', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.match(html, /class="nav-tab is-off" data-view="voyage"/);
  assert.match(fs.readFileSync(path.join(root, 'js/voyage.js'), 'utf8'), /grammar-list/);
});

test('administration : les droits « voyage » et « audio » se donnent à la création de la clé et par compte', () => {
  const admin = fs.readFileSync(path.join(root, 'js/admin.js'), 'utf8');
  assert.match(admin, /admin-key-voyage/);
  assert.match(admin, /admin-key-audio/);
  assert.match(admin, /\['audio', 'le son'\]/);
});

test('administration : un administrateur peut gérer ses propres droits, sans pouvoir se suspendre ni se supprimer', () => {
  const admin = fs.readFileSync(path.join(root, 'js/admin.js'), 'utf8');
  assert.match(admin, /u\.id === me \? `<details><summary>Mes droits<\/summary><div class="admin-actions">\$\{entButtons\}/);
  assert.match(admin, /id === syncMe\.id && typeof syncRefreshMe/);
  const own = admin.match(/Mes droits<\/summary>[^`]*`/)[0];
  assert.doesNotMatch(own, /suspend|Supprimer|set-plan/);
});

test('cartes : un exemple n’est donné que s’il illustre l’expression (pas de phrase tirée du dialogue sans rapport)', () => {
  for (const u of UNITS) for (const c of u.cards) {
    assert.equal(!!c.ex, !!c.exFr, `${c.lu} : exemple et traduction vont ensemble`);
    if (c.ex) assert.ok(c.exAudio, `${c.lu} : exemple sans son`);
    if (!c.ex) assert.ok(!c.exAudio, c.lu);
    if (c.ex && c.lu !== 'wannechgelift' && !c.lu.includes('…') && !c.lu.includes('?')) assert.ok(c.ex.includes(c.lu), `${c.lu} doit figurer dans son exemple`);
  }
  const hatt = UNITS[0].cards.find(c => c.lu.startsWith('Ech hätt gär'));
  assert.equal(hatt.ex, 'Ech hätt gär e Kéis.');
});

test('son des mots : nom avec son article (« fläsch, eng fläsch »)', () => {
  const byId = Object.fromEntries(MANIFEST.clips.map(c => [c.id, c.text]));
  for (const c of UNITS[0].cards.filter(x => x.art)) {
    assert.equal(byId[c.audio], `${c.lu.toLowerCase()}, ${c.art} ${c.lu.toLowerCase()}.`, c.lu);
  }
});

test('vitesse du son : lent (0,75) par défaut, réglable, mémorisée', async () => {
  const { ctx } = await boot();
  ev(ctx, "syncMe = { entitlements: ['voyage', 'audio'], role: 'user' }");
  ev(ctx, 'globalThis.__played = []; Audio = function (src) { this.src = src; this.playbackRate = 1; this.pause = () => {}; this.play = () => { globalThis.__played.push([src, this.playbackRate]); return Promise.resolve(); }; }');
  ev(ctx, "voyagePlay('courses', 'd1')");
  assert.deepEqual(json(ctx, '__played[0]'), ['assets/audio/voyage/courses/d1.mp3', 0.75]);
  ev(ctx, 'voyageToggleRate()');
  ev(ctx, "voyagePlay('courses', 'd2')");
  assert.deepEqual(json(ctx, '__played[1]'), ['assets/audio/voyage/courses/d2.mp3', 1]);
  ev(ctx, 'voyageToggleRate()');
  assert.equal(json(ctx, 'voyageRate()'), 0.75);
});
