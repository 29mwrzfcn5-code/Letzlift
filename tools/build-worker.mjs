// Produit worker/worker.mjs (le fichier à coller dans Cloudflare) à partir de worker/src/worker.mjs
// et de la bibliothèque de fusion js/lib/sync-merge.js. `--check` vérifie que le fichier produit est à jour.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export function buildWorker() {
  const src = fs.readFileSync(path.join(ROOT, 'worker', 'src', 'worker.mjs'), 'utf8');
  const lib = fs.readFileSync(path.join(ROOT, 'js', 'lib', 'sync-merge.js'), 'utf8');
  const embedded = `// --- js/lib/sync-merge.js (embarqué) ---\nconst LetzSyncMerge = (function () {\n  const module = { exports: {} };\n${lib}\n  return module.exports;\n})();\n`;
  const header = '// FICHIER GÉNÉRÉ par tools/build-worker.mjs — ne pas modifier à la main (modifier worker/src/worker.mjs).\n';
  return header + src + '\n' + embedded;
}
const out = path.join(ROOT, 'worker', 'worker.mjs');
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const built = buildWorker();
  if (process.argv.includes('--check')) {
    if (fs.readFileSync(out, 'utf8') !== built) { console.error('worker/worker.mjs n’est pas à jour : lancer node tools/build-worker.mjs'); process.exit(1); }
    console.log('worker/worker.mjs est à jour.');
  } else { fs.writeFileSync(out, built); console.log('worker/worker.mjs écrit (' + built.length + ' caractères).'); }
}
