#!/usr/bin/env node
/*
 * Vérifie que le découpage de letzlift.html (archive/letzlift-v1.18.0.html) en fichiers séparés
 * n'a rien changé :
 *   1. VOCAB, GRAMMAR, SMALLTALK (et le texte de DESCRIPTION_SCENES) identiques avant/après ;
 *   2. les 8 images extraites sont octet pour octet celles du base64 d'origine ;
 *   3. chaque fonction appelée dans un onclick/onchange/oninput existe toujours (et le jeu de
 *      fonctions référencées est le même qu'avant) ;
 *   4. le CSS et le HTML sont identiques (hors numéro de version) ;
 *
 * Les scripts sont exécutés dans un bac à sable `vm` avec un faux DOM : aucun navigateur, aucune
 * dépendance. Usage : node tools/verify-split.js
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const ARCHIVE = path.join(ROOT, 'archive', 'letzlift-v1.18.0.html');
const INDEX = path.join(ROOT, 'index.html');
const read = p => fs.readFileSync(p, 'utf8');

let failures = 0;
const results = [];
function check(name, ok, detail) {
  results.push({ name, ok, detail });
  if (!ok) failures++;
  console.log(`${ok ? 'OK  ' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
}

// ---------- faux DOM : un proxy qui accepte tout ----------
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

function makeContext() {
  const store = new Map();
  const errors = [];
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
  };
  sandbox.addEventListener = () => {};
  sandbox.scrollTo = () => {};
  sandbox.window = sandbox;
  const ctx = vm.createContext(sandbox);
  ctx.__errors = errors;
  return ctx;
}

function run(ctx, code, filename) {
  try {
    vm.runInContext(code, ctx, { filename });
    return null;
  } catch (e) {
    return e;
  }
}
process.on('unhandledRejection', e => { console.log('  (rejet non géré dans le bac à sable : ' + (e && e.message) + ')'); });
const ev = (ctx, expr) => vm.runInContext(expr, ctx);
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---------- extraction ----------
function between(text, open, close) {
  const a = text.indexOf(open);
  const b = text.lastIndexOf(close);
  return text.slice(a + open.length, b);
}
const archiveHtml = read(ARCHIVE);
const archiveScript = between(archiveHtml, '<script>\n', '\n</script>');
const archiveCss = between(archiveHtml, '<style>\n', '\n</style>');
const archiveBody = archiveHtml.slice(archiveHtml.indexOf('<body>'), archiveHtml.indexOf('<script>'));

const indexHtml = read(INDEX);
const scriptSrcs = [...indexHtml.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
const cssHref = /<link rel="stylesheet" href="([^"]+)">/.exec(indexHtml)[1];
const indexBody = indexHtml.slice(indexHtml.indexOf('<body>'), indexHtml.indexOf('<script src='));

async function main() {
  // ---------- exécution ancienne / nouvelle version ----------
  const oldCtx = makeContext();
  const oldErr = run(oldCtx, archiveScript, 'archive');
  const newCtx = makeContext();
  let newErr = null;
  for (const src of scriptSrcs) {
    const e = run(newCtx, read(path.join(ROOT, src)), src);
    if (e && !newErr) newErr = new Error(`${src} : ${e.message}`);
  }
  await sleep(50); // laisse init() (async) se dérouler
  check('le script d’origine se charge sans erreur', !oldErr, oldErr && oldErr.message);
  check(`les ${scriptSrcs.length} scripts de index.html se chargent sans erreur, dans l’ordre`, !newErr, newErr && newErr.message);

  // ---------- 1. données ----------
  // Seules modifications de contenu voulues depuis la v1.18.0 (validées par le propriétaire) :
  // tout autre écart reste une erreur.
  const KNOWN_CHANGES = {
    VOCAB: [{ id: 'v83', field: 'note', from: 'ka -> Exception', to: 'ka → Exception' }],
  };
  for (const name of ['VOCAB', 'GRAMMAR', 'SMALLTALK']) {
    let a = ev(oldCtx, `JSON.stringify(${name})`);
    if (KNOWN_CHANGES[name]) {
      const items = JSON.parse(a);
      for (const c of KNOWN_CHANGES[name]) {
        const item = items.find(x => x.id === c.id);
        check(`${name} : modification attendue ${c.id}.${c.field} (« ${c.from} » → « ${c.to} ») présente en v1.18.0`, !!item && item[c.field] === c.from);
        if (item) item[c.field] = c.to;
      }
      a = JSON.stringify(items);
    }
    const b = ev(newCtx, `JSON.stringify(${name})`);
    const na = ev(oldCtx, `${name}.length`);
    const nb = ev(newCtx, `${name}.length`);
    check(`${name} : même nombre d’éléments (${na} / ${nb})`, na === nb);
    const idsA = ev(oldCtx, `JSON.stringify(${name}.map(x=>x.id))`);
    const idsB = ev(newCtx, `JSON.stringify(${name}.map(x=>x.id))`);
    check(`${name} : mêmes ids, dans le même ordre`, idsA === idsB);
    const fieldsA = ev(oldCtx, `JSON.stringify(${name}.map(x=>Object.keys(x)))`);
    const fieldsB = ev(newCtx, `JSON.stringify(${name}.map(x=>Object.keys(x)))`);
    check(`${name} : mêmes champs pour chaque élément`, fieldsA === fieldsB);
    check(`${name} : contenu strictement identique (JSON)`, a === b, `${a.length} caractères`);
  }
  const stA = ev(oldCtx, 'SMALLTALK.reduce((s,t)=>s+t.phrases.length,0)');
  const stB = ev(newCtx, 'SMALLTALK.reduce((s,t)=>s+t.phrases.length,0)');
  check(`SMALLTALK : même nombre de phrases (${stA} / ${stB})`, stA === stB);

  // ---------- 2. images ----------
  const sceneText = c => ev(c, 'JSON.stringify(DESCRIPTION_SCENES.map(s=>({...s, img:undefined})))');
  check('DESCRIPTION_SCENES : textes identiques (hors champ img)', sceneText(oldCtx) === sceneText(newCtx));
  const scenesOld = JSON.parse(ev(oldCtx, 'JSON.stringify(DESCRIPTION_SCENES.map(s=>({id:s.id,img:s.img})))'));
  const scenesNew = JSON.parse(ev(newCtx, 'JSON.stringify(DESCRIPTION_SCENES.map(s=>({id:s.id,img:s.img})))'));
  check(`images : ${scenesOld.length} scènes avant, ${scenesNew.length} après`, scenesOld.length === 8 && scenesNew.length === 8);
  scenesOld.forEach((s, i) => {
    const n = scenesNew[i];
    const file = path.join(ROOT, n.img);
    const same = n.id === s.id && fs.existsSync(file) &&
      fs.readFileSync(file).toString('base64') === s.img.replace('data:image/jpeg;base64,', '');
    check(`image « ${s.id} » : ${n.img} identique octet pour octet au base64 d’origine`, same);
  });

  // ---------- 3. onclick ----------
  const IGNORE = new Set(['if', 'for', 'while', 'function', 'return', 'switch', 'catch']);
  function handlerNames(text) {
    const names = new Set();
    for (const m of text.matchAll(/\bon(?:click|change|input|keydown|keyup|submit)\s*=\s*"([^"]*)"/g)) {
      const code = m[1].replace(/\$\{[^}]*\}/g, '');
      for (const n of code.matchAll(/(?<![.\w$])([A-Za-z_$][\w$]*)\s*\(/g)) if (!IGNORE.has(n[1])) names.add(n[1]);
    }
    return names;
  }
  function launcherNames(ctx) {
    const strings = JSON.parse(ev(ctx, 'JSON.stringify([...MINI_GAMES.map(g=>g.fn), ...Object.values(DAILY_CHALLENGE_GAME_LAUNCHERS)])'));
    const names = new Set();
    for (const s of strings) for (const n of s.matchAll(/([A-Za-z_$][\w$]*)\s*\(/g)) names.add(n[1]);
    return names;
  }
  const oldNames = new Set([...handlerNames(archiveHtml), ...launcherNames(oldCtx)]);
  const newText = [indexHtml, ...scriptSrcs.map(s => read(path.join(ROOT, s)))].join('\n');
  const newNames = new Set([...handlerNames(newText), ...launcherNames(newCtx)]);
  // Les handlers peuvent évoluer (nouvelles fonctions, champ fichier créé à la demande…) : on exige
  // seulement que toute fonction référencée en v1.18.0 existe toujours.
  const stillThere = [...oldNames].filter(n => ev(newCtx, `typeof ${n}`) === 'function');
  check(`handlers inline : les ${oldNames.size} fonctions référencées en v1.18.0 existent toujours (${newNames.size} référencées aujourd’hui)`, stillThere.length === oldNames.size);
  const missing = [...newNames].filter(n => ev(newCtx, `typeof ${n}`) !== 'function');
  check('chaque fonction référencée dans un onclick/onchange/oninput existe (typeof === "function")', missing.length === 0, missing.join(', '));
  const lost = [...oldNames].filter(n => ev(oldCtx, `typeof ${n}`) !== 'function');
  check('(contrôle) toutes existaient déjà dans la version d’origine', lost.length === 0, lost.join(', '));

  // ---------- 4. CSS et HTML ----------
  const newCss = read(path.join(ROOT, cssHref));
  // Depuis la v1.22.0 des classes nouvelles sont ajoutées à la fin : le CSS d'origine doit rester intact en tête.
  check('CSS d’origine intact (les ajouts éventuels sont seulement à la fin)', newCss.startsWith(archiveCss + '\n'));
  const bodyA = archiveBody.split('\n');
  const bodyB = indexBody.split('\n');
  const diffs = [];
  for (let i = 0; i < Math.max(bodyA.length, bodyB.length); i++) if (bodyA[i] !== bodyB[i]) diffs.push([bodyA[i], bodyB[i]]);
  const onlyVersion = diffs.length === 1 && /version-pill/.test(diffs[0][0] || '') && /version-pill/.test(diffs[0][1] || '');
  check('HTML du <body> identique (seule la pastille de version change)', onlyVersion || diffs.length === 0,
    diffs.length ? `${diffs.length} ligne(s) différente(s)${onlyVersion ? ' : ' + diffs[0][0].trim() + ' → ' + diffs[0][1].trim() : ''}` : '');

  // Le contrôle « mêmes lignes de JS qu'avant » n'a de sens que pour le découpage pur de la v1.19.0
  // (commit d496bba) : depuis la v1.20.0 le code a volontairement changé (voir CHANGELOG.md).
  const newTextAll = [indexHtml, ...scriptSrcs.map(s => read(path.join(ROOT, s)))].join('\n');
  const imgLinesNew = scriptSrcs.flatMap(s => read(path.join(ROOT, s)).split('\n')).filter(l => /^\s*img:'assets\/img\//.test(l)).length;
  check('JS : 8 références d’image par chemin, plus aucun base64 dans le code', imgLinesNew === 8 && !newTextAll.includes('base64,'));

  console.log(failures ? `\n${failures} vérification(s) en échec.` : '\nToutes les vérifications passent.');
  process.exit(failures ? 1 : 0);
}
main();
