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
// Écrans à choix multiple : .qcm-opt (sessions, jeux), .tf-btn (Vrai/Faux) et .course-choice (module Cours :
// révision de leçon, exercices sur la règle du n). Flèches = déplacer, chiffres 1 à 9 = choisir directement.
const KEYNAV_CONTAINERS = '.view.active .qcm-options, .view.active .tf-btn-row, .view.active .course-choices';
const KEYNAV_OPTIONS = '.qcm-opt:not([disabled]), .tf-btn:not([disabled]), .course-choice:not([disabled])';
document.addEventListener('keydown', (e) => {
  if(!userProfile.keyboardNavEnabled) return; // désactivable depuis Paramètres (v1.14.0)
  if(e.ctrlKey || e.metaKey || e.altKey) return;
  const arrow = LetzKeyNav.isArrow(e.key);
  const digit = !arrow && /^[1-9]$/.test(e.key);
  if(!arrow && !digit) return;
  const target = e.target;
  if(digit && target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName || '')) return; // on ne détourne pas la saisie
  const container = document.querySelector(KEYNAV_CONTAINERS);
  if(!container) return;
  const opts = [...container.querySelectorAll(KEYNAV_OPTIONS)];
  if(opts.length === 0) return;
  if(digit){
    const i = LetzKeyNav.digitIndex(e.key, opts.length);
    if(i === -1) return;
    e.preventDefault();
    opts[i].click();
    return;
  }
  e.preventDefault(); // empêche le défilement de page avec les flèches
  opts[LetzKeyNav.moveIndex(e.key, opts.indexOf(document.activeElement), opts.length)].focus();
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
  syncGateStartup(); // écran de connexion tant qu'aucun compte n'est connecté
  await loadState();
  switchView('home');
  maybeShowWeeklyReview();
  syncStartup();
})();
