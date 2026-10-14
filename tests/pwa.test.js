const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const exists = p => fs.existsSync(path.join(ROOT, p));

const html = read('index.html');
const css = read('css/styles.css');
const manifest = JSON.parse(read('manifest.webmanifest'));
const sw = read('sw.js');
const pkg = JSON.parse(read('package.json'));

function cssVar(name) { return new RegExp(`--${name}:\\s*(#[0-9A-Fa-f]{6})`).exec(css)[1].toUpperCase(); }
function walk(dir) {
  return fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })
    .flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name).split(path.sep).join('/')]);
}
function pngSize(file) {
  const b = fs.readFileSync(path.join(ROOT, file));
  assert.deepEqual([...b.subarray(0, 8)], [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], `${file} n'est pas un PNG`);
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}
const shellList = () => [...sw.slice(sw.indexOf('const SHELL = ['), sw.indexOf('];', sw.indexOf('const SHELL = [')))
  .matchAll(/'([^']+)'/g)].map(m => m[1]);

test('manifest : nom, affichage, couleurs tirées du CSS', () => {
  assert.equal(manifest.name, 'LetzLift');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.background_color.toUpperCase(), cssVar('bg'));
  assert.equal(manifest.theme_color.toUpperCase(), cssVar('accent'));
  assert.equal(manifest.background_color.toUpperCase(), '#EDE8DC');
  assert.equal(manifest.theme_color.toUpperCase(), '#1F5C56');
  assert.ok(!manifest.start_url.startsWith('/'), 'start_url doit être relatif (GitHub Pages sert sous /Letzlift/)');
  assert.ok(!manifest.scope.startsWith('/'));
});

test('manifest : icônes présentes, aux bonnes dimensions', () => {
  const sizes = manifest.icons.map(i => i.sizes);
  assert.ok(sizes.includes('192x192') && sizes.includes('512x512'));
  for (const icon of manifest.icons) {
    assert.ok(exists(icon.src), icon.src);
    assert.deepEqual(pngSize(icon.src).join('x'), icon.sizes);
  }
  assert.deepEqual(pngSize('icons/apple-touch-icon.png'), [180, 180]);
});

test('icônes : les fichiers committés sont ceux que génère tools/make-icons.js', () => {
  const { png, SIZES } = require('../tools/make-icons.js');
  for (const [file, n] of Object.entries(SIZES)) {
    assert.ok(png(n).equals(fs.readFileSync(path.join(ROOT, 'icons', file))), `icons/${file} périmée : relancer node tools/make-icons.js`);
  }
});

test('index.html : manifest, icône tactile et balises iOS', () => {
  assert.match(html, /<link rel="manifest" href="manifest\.webmanifest">/);
  assert.match(html, /<link rel="apple-touch-icon" href="icons\/apple-touch-icon\.png">/);
  assert.match(html, /<meta name="apple-mobile-web-app-capable" content="yes">/);
  assert.match(html, /<meta name="apple-mobile-web-app-title" content="LetzLift">/);
  assert.match(html, /<meta name="apple-mobile-web-app-status-bar-style" content="default">/);
  assert.match(html, new RegExp(`<meta name="theme-color" content="${cssVar('accent')}">`, 'i'));
  assert.match(html, /viewport-fit=cover/);
  assert.ok(!/<script type="module"/.test(html), 'pas de module ES : file:// doit continuer de marcher');
});

test('version : sw.js, pastille de index.html et package.json concordent', () => {
  const swVersion = /const VERSION = '([^']+)'/.exec(sw)[1];
  const pill = /<span class="version-pill">v([^<]+)<\/span>/.exec(html)[1];
  assert.equal(swVersion, pill);
  assert.equal(swVersion, pkg.version);
  assert.ok(sw.includes("'letzlift-shell-v' + VERSION"), 'le nom du cache doit dépendre de VERSION');
});

test('précache : tout ce que index.html référence est dans la liste, et existe', () => {
  const list = shellList();
  const referenced = [
    ...[...html.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]),
    ...[...html.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map(m => m[1]),
    ...[...html.matchAll(/<link rel="(?:manifest|apple-touch-icon|icon)"[^>]*href="([^"]+)"/g)].map(m => m[1]),
    'index.html', './',
  ].filter(u => !/^https?:/.test(u));
  for (const u of referenced) assert.ok(list.includes(u), `${u} absent de SHELL dans sw.js`);
  for (const f of list) if (f !== './') assert.ok(exists(f), `${f} (SHELL) n'existe pas`);
});

test('précache : aucun fichier de l’app oublié (css, js, data, assets, icons)', () => {
  const list = new Set(shellList());
  for (const dir of ['css', 'js', 'data', 'assets', 'icons']) {
    for (const f of walk(dir)) assert.ok(list.has(f), `${f} n'est pas précaché`);
  }
  assert.ok(list.has('manifest.webmanifest'));
});

test('précache : pas de doublon', () => {
  const list = shellList();
  assert.equal(new Set(list).size, list.length);
});

test('précache : les images des scènes (DESCRIPTION_SCENES) sont toutes dans la liste', () => {
  const list = shellList();
  const scenes = [...read('js/games/imagedesc.js').matchAll(/img:'([^']+)'/g)].map(m => m[1]);
  assert.equal(scenes.length, 8);
  for (const s of scenes) assert.ok(list.includes(s), s);
});

test('service worker : polices Google en stale-while-revalidate, chemins relatifs, nettoyage des anciens caches', () => {
  assert.match(sw, /fonts\.googleapis\.com/);
  assert.match(sw, /fonts\.gstatic\.com/);
  assert.match(sw, /staleWhileRevalidate/);
  assert.match(sw, /caches\.delete/);
  assert.match(sw, /registration\.scope/);
  assert.ok(!/['"]\/(?!\/)[a-z]/i.test(shellList().join('\n')), 'chemins du SHELL relatifs, sans « / » initial');
});

test('enregistrement : js/pwa.js ne s’exécute pas en file:// (aucune erreur, aucun appel)', () => {
  const vm = require('node:vm');
  for (const location of [{ protocol: 'file:', hostname: '' }, undefined]) {
    let registered = 0;
    const ctx = vm.createContext({
      navigator: { serviceWorker: { register() { registered++; return Promise.resolve(); } } },
      window: { addEventListener(_e, cb) { cb(); } },
      location,
    });
    vm.runInContext(read('js/pwa.js'), ctx);
    assert.equal(registered, 0);
  }
  let registered = 0;
  const ctx = vm.createContext({
    navigator: { serviceWorker: { register(u) { registered++; assert.equal(u, 'sw.js'); return Promise.resolve(); } } },
    window: { addEventListener(_e, cb) { cb(); } },
    location: { protocol: 'https:', hostname: 'example.github.io' },
  });
  vm.runInContext(read('js/pwa.js'), ctx);
  assert.equal(registered, 1);
  // navigateur sans service worker
  vm.runInContext(read('js/pwa.js'), vm.createContext({ navigator: {}, window: { addEventListener() { throw new Error('ne doit pas être appelé'); } }, location: { protocol: 'https:' } }));
});

test('workflow GitHub Pages : tests avant déploiement, seulement les fichiers de l’app publiés', () => {
  const wf = read('.github/workflows/pages.yml');
  assert.match(wf, /npm test/);
  assert.match(wf, /actions\/deploy-pages@v4/);
  assert.match(wf, /actions\/upload-pages-artifact@v3/);
  assert.match(wf, /cp -r index\.html sw\.js manifest\.webmanifest css js data assets icons _site\//);
  assert.match(wf, /pages: write/);
});
