const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'js/tour.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

function load() {
  const ctx = { document: { addEventListener() {} }, hasEntitlement: () => false };
  vm.createContext(ctx);
  vm.runInContext(src + ';this.__steps = TOUR_STEPS;', ctx);
  return ctx.__steps;
}

test('visite guidée : cinq étapes, chacune sur un onglet qui existe dans la barre de navigation', () => {
  const steps = load();
  assert.equal(steps.length, 5);
  for (const s of steps) {
    assert.match(html, new RegExp(`class="nav-tab" data-view="${s.tab}"`), s.tab);
    assert.ok(s.title && s.text().length > 20);
  }
});

test('visite guidée : le cours n’est cité que pour les comptes qui y ont droit', () => {
  const steps = load();
  assert.doesNotMatch(steps[0].text(), /Cours/);
});

test('visite guidée : lancée après l’accueil, une seule fois, rejouable depuis Paramètres', () => {
  assert.match(fs.readFileSync(path.join(root, 'js/home.js'), 'utf8'), /userProfile\.tourPending = true/);
  assert.match(fs.readFileSync(path.join(root, 'js/screens.js'), 'utf8'), /tourReplay\(\)/);
  assert.match(src, /userProfile\.tourPending = false/);
  assert.ok(html.indexOf('js/tour.js') > html.indexOf('js/session-ui.js'));
});
