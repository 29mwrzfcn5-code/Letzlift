/*
 * Service worker de LetzLift.
 *
 * - Précache de tout l'app shell (HTML, CSS, JS, données, images, icônes, manifest) à l'installation :
 *   l'app démarre et fonctionne ensuite sans réseau.
 * - Le cache est nommé d'après VERSION. VERSION doit être égal au numéro affiché dans l'app
 *   (pastille de index.html) et à package.json : tests/pwa.test.js le vérifie. Changer VERSION crée
 *   un nouveau cache ; l'ancien est supprimé à l'activation.
 * - Polices Google : stale-while-revalidate (on sert la copie en cache tout de suite, et on la met
 *   à jour en arrière-plan). Sans réseau ni copie, l'app retombe sur les polices du système.
 * - Aucune donnée utilisateur ne passe par ici : la progression est dans localStorage.
 */
'use strict';

const VERSION = '1.21.0';
const SHELL_CACHE = 'letzlift-shell-v' + VERSION;
const FONT_CACHE = 'letzlift-fonts-v1';

// Chemins relatifs à l'emplacement de sw.js (fonctionne à la racine ou sous /Letzlift/).
const SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/styles.css',
  'data/grammar.js',
  'data/smalltalk.js',
  'data/vocab.js',
  'js/lib/dates.js',
  'js/lib/srs.js',
  'js/lib/xp.js',
  'js/lib/streak.js',
  'js/lib/text.js',
  'js/storage.js',
  'js/profile.js',
  'js/srs.js',
  'js/progress.js',
  'js/weekly.js',
  'js/screens.js',
  'js/vocab-csv.js',
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
  'js/pwa.js',
  'assets/img/arret.jpg',
  'assets/img/bureau.jpg',
  'assets/img/medecin.jpg',
  'assets/img/parc.jpg',
  'assets/img/petitdej.jpg',
  'assets/img/restaurant.jpg',
  'assets/img/salon.jpg',
  'assets/img/supermarche.jpg',
  'icons/apple-touch-icon.png',
  'icons/icon-192.png',
  'icons/icon-512.png'
];

const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

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
      .filter(n => n.startsWith('letzlift-shell-') && n !== SHELL_CACHE)
      .map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

async function staleWhileRevalidate(request) {
  const cache = await caches.open(FONT_CACHE);
  const cached = await cache.match(request);
  const refresh = fetch(request).then(response => {
    // réponses « opaques » (status 0) acceptées : une feuille de style cross-origin sans CORS en est une
    if (response && (response.ok || response.type === 'opaque')) cache.put(request, response.clone());
    return response;
  }).catch(() => null);
  if (cached) { refresh.catch(() => {}); return cached; }
  return (await refresh) || new Response('', { status: 504, statusText: 'Hors ligne' });
}

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
  if (FONT_HOSTS.includes(url.hostname)) {
    event.respondWith(staleWhileRevalidate(request));
  } else if (url.origin === self.location.origin) {
    event.respondWith(shellFirst(request));
  }
});
