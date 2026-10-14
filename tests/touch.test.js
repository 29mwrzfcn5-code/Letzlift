const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const sources = ['index.html', ...fs.readdirSync(path.join(ROOT, 'js')).filter(f => f.endsWith('.js')).map(f => 'js/' + f),
  ...fs.readdirSync(path.join(ROOT, 'js', 'games')).map(f => 'js/games/' + f)];

test('chaque champ de texte coupe la correction automatique et le correcteur orthographique de iOS', () => {
  const missing = [];
  for (const file of sources) {
    const text = read(file);
    for (const m of text.matchAll(/<input\b[^>]*>/g)) {
      const tag = m[0];
      if (/type="(range|checkbox|radio|file|date)"/.test(tag)) continue;
      if (!/autocorrect="off"/.test(tag) || !/spellcheck="false"/.test(tag)) missing.push(`${file}: ${tag.slice(0, 90)}`);
    }
  }
  assert.deepEqual(missing, []);
});

test('champs de réponse : pas de majuscule automatique, touche « Go » du clavier', () => {
  for (const [file, id] of [['js/vocab-session.js', 'answer-input'], ['js/placement.js', 'placement-input'], ['js/games/flash.js', 'flash-input'],
    ['js/games/horloge.js', 'clock-input'], ['js/games/phrase-drill.js', 'pd-input']]) {
    const tag = new RegExp(`<input[^>]*id="${id}"[^>]*>`).exec(read(file))[0];
    assert.match(tag, /autocapitalize="off"/, file);
    assert.match(tag, /enterkeyhint="go"/, file);
  }
});

test('prénom : majuscule au début de chaque mot', () => {
  const html = read('js/screens.js');
  assert.match(/<input[^>]*id="onboard-name-input"[^>]*>/.exec(html)[0], /autocapitalize="words"/);
  assert.match(/<input[^>]*id="settings-name-input"[^>]*>/.exec(html)[0], /autocapitalize="words"/);
});

test('CSS : champs à 16 px sur écran étroit (sinon Safari zoome), cibles de 44 px, retour visuel au toucher', () => {
  const css = read('css/styles.css');
  const block = css.slice(css.indexOf('v1.23 — ergonomie tactile'));
  const narrow = block.slice(block.indexOf('@media (max-width:640px)'));
  assert.match(narrow, /input:not\(\[type=range\]\)[\s\S]*?font-size:16px/);
  for (const sel of ['.answer-input', '.settings-input', '.settings-select', '.onboard-input', '.vocab-search-input', '.vocab-filter-select']) {
    assert.ok(narrow.includes(sel), sel);
  }
  assert.match(narrow, /\.btn[^{]*\{ min-height:44px; \}/);
  assert.match(narrow, /\.avatar-badge::before[^}]*inset:-5px/);
  assert.match(narrow, /\.back-link\{[^}]*min-height:44px/);
  assert.match(block, /@media \(hover:none\)[\s\S]*button:not\(:disabled\):active/);
  assert.match(block, /touch-action:manipulation/);
  assert.match(block, /\.info-pill\.tip-open \.pill-tooltip/);
});

function loadTouch() {
  const handlers = {};
  const classes = el => el._c || (el._c = new Set());
  const mkEl = (tag, cls) => { const e = { tagName: tag, _c: new Set(cls), classList: { contains: c => e._c.has(c), toggle: (c, f) => { f ? e._c.add(c) : e._c.delete(c); }, remove: c => e._c.delete(c), add: c => e._c.add(c) } }; return e; };
  const pill = mkEl('DIV', ['info-pill']);
  const badge = mkEl('DIV', ['medallion-item']);
  const gameBtn = mkEl('BUTTON', ['medallion-item']);
  const inner = mkEl('SPAN', []);
  const all = [pill, badge, gameBtn];
  const withClosest = (el, host) => { el.closest = sel => (host && sel.includes('.info-pill') ? host : null); return el; };
  pill.closest = () => pill; badge.closest = () => badge; gameBtn.closest = () => gameBtn; withClosest(inner, null);
  const doc = {
    addEventListener(type, cb) { handlers[type] = cb; },
    querySelectorAll: () => all.filter(e => e._c.has('tip-open')),
    activeElement: null,
  };
  vm.runInContext(read('js/touch.js'), vm.createContext({ document: doc, window: {} }));
  return { handlers, pill, badge, gameBtn, inner, doc };
}

test('touch.js : un toucher ouvre l’infobulle d’une pastille, un second la ferme, un toucher ailleurs aussi', () => {
  const t = loadTouch();
  t.handlers.click({ target: t.pill });
  assert.ok(t.pill._c.has('tip-open'));
  t.handlers.click({ target: t.pill });
  assert.ok(!t.pill._c.has('tip-open'));
  t.handlers.click({ target: t.pill });
  t.handlers.click({ target: t.inner });
  assert.ok(!t.pill._c.has('tip-open'));
});

test('touch.js : un badge ouvre son infobulle, un médaillon de jeu (bouton) non ; une seule infobulle à la fois', () => {
  const t = loadTouch();
  t.handlers.click({ target: t.gameBtn });
  assert.ok(!t.gameBtn._c.has('tip-open'));
  t.handlers.click({ target: t.badge });
  assert.ok(t.badge._c.has('tip-open'));
  t.handlers.click({ target: t.pill });
  assert.ok(t.pill._c.has('tip-open') && !t.badge._c.has('tip-open'));
});

test('touch.js : se charge sans erreur hors navigateur', () => {
  assert.doesNotThrow(() => vm.runInContext(read('js/touch.js'), vm.createContext({})));
});
