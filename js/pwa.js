/*
 * Enregistrement du service worker (hors ligne). Sans effet, et sans erreur, quand l'app est
 * ouverte en double-clic (file://) ou dans un navigateur sans service worker : elle fonctionne
 * alors exactement comme avant.
 */
(function registerServiceWorker(){
  if(typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  if(typeof location === 'undefined' || (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1')) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => { /* hors ligne non disponible : l'app reste utilisable */ });
  });
})();
