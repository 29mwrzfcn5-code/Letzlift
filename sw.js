/*
 * Service worker de LetzLift.
 *
 * - Précache de tout l'app shell (HTML, CSS, JS, données, images, icônes, manifest) à l'installation :
 *   l'app démarre et fonctionne ensuite sans réseau.
 * - Le cache est nommé d'après VERSION. VERSION doit être égal au numéro affiché dans l'app
 *   (pastille de index.html) et à package.json : tests/pwa.test.js le vérifie. Changer VERSION crée
 *   un nouveau cache ; l'ancien est supprimé à l'activation.
 * - Les polices sont hébergées avec l'app (assets/fonts/) et précachées : aucune requête vers un tiers.
 * - Aucune donnée utilisateur ne passe par ici : la progression est dans localStorage.
 */
'use strict';

const VERSION = '1.35.0';
const SHELL_CACHE = 'letzlift-shell-v' + VERSION;

// Chemins relatifs à l'emplacement de sw.js (fonctionne à la racine ou sous /Letzlift/).
const SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/styles.css',
  'data/grammar.js',
  'data/smalltalk.js',
  'data/vocab.js',
  'data/course/course.js',
  'data/course/lesson-01.js',
  'data/course/lesson-02.js',
  'data/course/lesson-03.js',
  'data/course/lesson-04.js',
  'data/course/lesson-05.js',
  'data/course/lesson-06.js',
  'js/lib/dates.js',
  'js/lib/srs.js',
  'js/lib/xp.js',
  'js/lib/streak.js',
  'js/lib/journey.js',
  'js/lib/stamps.js',
  'js/lib/text.js',
  'js/lib/vocab-entry.js',
  'js/lib/resume.js',
  'js/lib/sync-merge.js',
  'js/lib/sync-core.js',
  'js/lib/nrule.js',
  'js/lib/genre-n.js',
  'js/lib/keynav.js',
  'js/lib/course.js',
  'js/lib/course-ex.js',
  'js/storage.js',
  'js/profile.js',
  'js/srs.js',
  'js/progress.js',
  'js/weekly.js',
  'js/screens.js',
  'js/genre.js',
  'js/home.js',
  'js/feedback.js',
  'js/vocab-csv.js',
  'js/vocab-admin.js',
  'js/course.js',
  'js/sync.js',
  'js/telemetry.js',
  'js/admin.js',
  'legal/cgu.html',
  'legal/confidentialite.html',
  'legal/mentions.html',
  'js/vocab-session.js',
  'js/placement.js',
  'js/grammar.js',
  'js/games/flash.js',
  'js/games/truefalse.js',
  'js/games/phrase-drill.js',
  'js/games/memory.js',
  'js/games/intrus.js',
  'js/games/horloge.js',
  'js/games/article.js',
  'js/games/imagedesc.js',
  'js/games/interrogatif.js',
  'js/games/connecteur.js',
  'js/games/timeline.js',
  'js/games/anagramme.js',
  'js/games/dialogue.js',
  'js/niveau.js',
  'js/main.js',
  'js/touch.js',
  'js/pwa.js',
  'assets/img/arret.jpg',
  'assets/img/bureau.jpg',
  'assets/img/medecin.jpg',
  'assets/img/parc.jpg',
  'assets/img/petitdej.jpg',
  'assets/fonts/LICENSES.txt',
  'assets/fonts/baloo-2-latin-600-normal.woff2',
  'assets/fonts/baloo-2-latin-700-normal.woff2',
  'assets/fonts/baloo-2-latin-800-normal.woff2',
  'assets/fonts/nunito-latin-500-normal.woff2',
  'assets/fonts/nunito-latin-600-normal.woff2',
  'assets/fonts/nunito-latin-700-normal.woff2',
  'assets/fonts/nunito-latin-800-normal.woff2',
  'assets/img/restaurant.jpg',
  'assets/img/salon.jpg',
  'assets/img/supermarche.jpg',
  'icons/apple-touch-icon.png',
  'icons/icon-192.png',
  'icons/icon-512.png'
];

function shellUrl(path) { return new URL(path, self.registration.scope).href; }

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    // cache: 'reload' : on ne remplit jamais le nouveau cache avec une copie périmée du cache HTTP
    await cache.addAll(SHELL.map(p => new Request(shellUrl(p), { cache: 'reload' })));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter(n => (n.startsWith('letzlift-shell-') && n !== SHELL_CACHE) || n === 'letzlift-fonts-v1') // l'ancien cache des polices Google
      .map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

async function shellFirst(request) {
  const cache = await caches.open(SHELL_CACHE);
  const hit = await cache.match(request, { ignoreSearch: true });
  if (hit) return hit;
  try {
    return await fetch(request);
  } catch (e) {
    // Hors ligne : une navigation retombe sur l'app (index.html en cache), le reste sur une 503 propre.
    if (request.mode === 'navigate') {
      const index = await cache.match(shellUrl('index.html'));
      if (index) return index;
    }
    return new Response('Hors ligne', { status: 503, statusText: 'Hors ligne', headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin === self.location.origin) {
    event.respondWith(shellFirst(request));
  }
});
