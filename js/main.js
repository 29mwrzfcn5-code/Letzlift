/* ============================================================
   INIT
   ============================================================ */
// Navigation au clavier (flèches) pour TOUT écran à choix multiple, présent ou futur — un seul
// gestionnaire générique plutôt qu'un par mini-jeu, tant que l'écran utilise .qcm-options/.qcm-opt
// OU .tf-btn-row/.tf-btn (Vrai/Faux, Le bon article — mise en page à part, mêmes deux jeux à
// chrono que Maxime a signalés comme non couverts). Les flèches déplacent le focus entre les
// boutons ; Entrée/Espace les activent nativement (comportement natif d'un <button> focus, rien
// à coder pour ça). Scope volontairement restreint à la vue active (.view.active) : toutes les
// vues restent dans le DOM même masquées, donc sans ce filtre les flèches agiraient sur un écran caché.
// Menu avatar en topbar (Niveau / Paramètres / Sauvegarder) — v1.14.0, remplace la pastille
// unique v1.13.2 (retour à 2 pastilles série/jetons directement visibles + ce menu séparé pour
// le reste). Même précaution de fermeture différée que pour l'ancien panneau de statut : sinon
// le clic qui vient d'OUVRIR le menu serait aussitôt intercepté par le listener de fermeture.
function toggleAvatarMenu(){
  const menu = document.getElementById('avatar-menu');
  const opening = !menu.classList.contains('open');
  menu.classList.toggle('open', opening);
  if(opening){
    setTimeout(() => {
      document.addEventListener('click', closeAvatarMenuOnOutsideClick);
    }, 0);
  }
}
function closeAvatarMenu(){
  document.getElementById('avatar-menu').classList.remove('open');
  document.removeEventListener('click', closeAvatarMenuOnOutsideClick);
}
function closeAvatarMenuOnOutsideClick(e){
  const badge = document.getElementById('avatar-badge');
  if(badge && !badge.contains(e.target)) closeAvatarMenu();
}

document.addEventListener('keydown', (e) => {
  if(!userProfile.keyboardNavEnabled) return; // désactivable depuis Paramètres (v1.14.0)
  if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) return;
  const container = document.querySelector('.view.active .qcm-options, .view.active .tf-btn-row');
  if(!container) return;
  const opts = [...container.querySelectorAll('.qcm-opt:not([disabled]), .tf-btn:not([disabled])')];
  if(opts.length === 0) return;
  e.preventDefault(); // empêche le défilement de page avec les flèches
  const currentIndex = opts.indexOf(document.activeElement);
  let nextIndex;
  if(e.key === 'ArrowDown' || e.key === 'ArrowRight'){
    nextIndex = currentIndex === -1 ? 0 : Math.min(opts.length - 1, currentIndex + 1);
  } else {
    nextIndex = currentIndex === -1 ? 0 : Math.max(0, currentIndex - 1);
  }
  opts[nextIndex].focus();
});

// App ouverte avant minuit puis remise au premier plan après (cas d'une app installée jamais
// rechargée) : on bascule le jour (objectif, défi, série), on propose le bilan hebdomadaire si
// une nouvelle semaine commence, et on rafraîchit l'accueil s'il est affiché.
let lastSeenDay = todayStr();
document.addEventListener('visibilitychange', () => {
  if(document.hidden) return;
  const today = todayStr();
  if(today === lastSeenDay) return;
  lastSeenDay = today;
  ensureDailyState();
  maybeShowWeeklyReview();
  if(document.getElementById('view-home').classList.contains('active')) renderHome();
});

(async function init(){
  await loadState();
  switchView('home');
  maybeShowWeeklyReview();
})();
