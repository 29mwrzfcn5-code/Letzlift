/*
 * Bac à sable `vm` avec un faux DOM, partagé par tools/verify-split.js et les tests de
 * compatibilité (tests/). Permet de charger les scripts de l'app sous Node, sans navigateur.
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');

// Un proxy qui accepte tout : propriétés, appels, constructions, itération (vide).
function makeStub() {
  const handler = {
    get(_t, prop) {
      if (prop === Symbol.toPrimitive) return () => '';
      if (prop === Symbol.iterator) return function* () {};
      if (prop === 'length') return 0;
      if (prop === 'then') return undefined;
      return stub;
    },
    set() { return true; },
    apply() { return stub; },
    construct() { return stub; },
  };
  const stub = new Proxy(function () {}, handler);
  return stub;
}

/*
 * options.storage : contenu initial du localStorage ({ 'letzlift:profile': '...' }).
 * options.now : instant fixe (ms ou Date) renvoyé par `new Date()` / Date.now() dans le bac à sable.
 * Le fuseau est celui du processus Node (process.env.TZ).
 */
function makeContext(options) {
  options = options || {};
  const store = new Map(Object.entries(options.storage || {}));
  const sandbox = {
    console: { log() {}, warn() {}, error() {} },
    setTimeout, clearTimeout, setInterval, clearInterval,
    localStorage: {
      getItem: k => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => { store.set(k, String(v)); },
      removeItem: k => { store.delete(k); },
    },
    document: makeStub(),
    navigator: makeStub(),
    Blob: function () {}, URL: { createObjectURL() { return ''; }, revokeObjectURL() {} },
    addEventListener() {}, scrollTo() {},
  };
  if (options.now !== undefined) {
    const fixed = +options.now;
    const RealDate = Date;
    sandbox.Date = class extends RealDate {
      constructor(...args) { if (args.length === 0) super(fixed); else super(...args); }
      static now() { return fixed; }
    };
  }
  sandbox.window = sandbox;
  const ctx = vm.createContext(sandbox);
  ctx.__store = store;
  return ctx;
}

function run(ctx, code, filename) {
  try { vm.runInContext(code, ctx, { filename }); return null; } catch (e) { return e; }
}
const ev = (ctx, expr) => vm.runInContext(expr, ctx);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const read = p => fs.readFileSync(p, 'utf8');

// Scripts classiques de index.html, dans l'ordre.
function indexScripts() {
  const html = read(path.join(ROOT, 'index.html'));
  return [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
}

function loadApp(options) {
  const ctx = makeContext(options);
  const errors = [];
  for (const src of indexScripts()) {
    const e = run(ctx, read(path.join(ROOT, src)), src);
    if (e) errors.push(`${src} : ${e.message}`);
  }
  return { ctx, errors };
}

function loadArchive(options) {
  const html = read(path.join(ROOT, 'archive', 'letzlift-v1.18.0.html'));
  const code = html.slice(html.indexOf('<script>\n') + 9, html.lastIndexOf('\n</script>'));
  const ctx = makeContext(options);
  const e = run(ctx, code, 'archive');
  return { ctx, errors: e ? [e.message] : [] };
}

process.on('unhandledRejection', () => { /* init() async dans le bac à sable : sans DOM réel, on ignore */ });

module.exports = { ROOT, makeContext, run, ev, sleep, read, indexScripts, loadApp, loadArchive };
