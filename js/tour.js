/* ============================================================
   VISITE GUIDÉE — après l'accueil, Roudi présente les cinq onglets
   (Accueil, Vocab., Parler, Grammaire, Moi). Se lance une fois, juste après le parcours d'accueil
   (userProfile.tourPending), se passe d'un geste, se rejoue depuis Paramètres.
   ============================================================ */
const TOUR_STEPS = [
  { tab:'home', title:'Ton accueil',
    text: () => 'Ici, ton billet du jour : ta série, ta semaine et ta prochaine session. Reviens-y chaque jour, il te dit quoi faire.' + (typeof hasEntitlement === 'function' && hasEntitlement('course') ? ' Plus bas : Parler, Grammaire et le Cours des leçons.' : ' Plus bas : Parler et Grammaire.') },
  { tab:'vocab', title:'Vocab.',
    text: () => 'Ta session du jour : des mots à revoir et quelques nouveaux, dosés selon ton rythme. Les mini-jeux s\'ouvrent quand tu as vu 20 mots.' },
  { tab:'smalltalk-list', title:'Parler',
    text: () => 'Des phrases prêtes à l\'emploi pour les vraies situations : courses, travail, administration. Lis, dis la phrase à voix haute, puis révèle.' },
  { tab:'grammar-list', title:'Grammaire',
    text: () => 'Les fiches essentielles, avec leurs exercices. Sur l\'accueil, « Genre et n » entraîne les deux points les plus délicats : la règle du n et le genre des noms.' },
  { tab:'niveau', title:'Moi',
    text: () => 'Ta progression, tes badges et ta sauvegarde. L\'engrenage en haut ouvre les Réglages : rythme, couleurs des genres, sons, et cette visite si tu veux la revoir.' }
];
let tourIndex = -1;

function tourMaybeStart(){
  if(typeof userProfile === 'undefined' || !userProfile.tourPending || tourIndex >= 0) return;
  const home = document.getElementById('view-home');
  if(!home || !home.classList.contains('active')) return;
  tourStart();
}

function tourStart(){
  tourIndex = 0;
  tourRender();
}

function tourClear(){
  const root = document.getElementById('tour-root');
  if(root) root.remove();
  document.body.classList.remove('tour-on');
  document.querySelectorAll('.tour-hl').forEach(el => el.classList.remove('tour-hl'));
}

function tourRender(){
  tourClear();
  const step = TOUR_STEPS[tourIndex];
  if(!step) return;
  const last = tourIndex === TOUR_STEPS.length - 1;
  const dots = TOUR_STEPS.map((_, i) => `<i class="${i === tourIndex ? 'on' : ''}"></i>`).join('');
  const root = document.createElement('div');
  root.id = 'tour-root';
  root.innerHTML = `
    <div class="tour-dim" onclick="tourSkip()"></div>
    <div class="tour-card" role="dialog" aria-modal="true" aria-label="Visite guidée, étape ${tourIndex + 1} sur ${TOUR_STEPS.length}">
      <div class="tour-talk">${typeof ROUDI_SVG === 'function' ? ROUDI_SVG('tour-roudi') : ''}
        <div><div class="tour-title d">${escapeHtml(step.title)}</div><div class="tour-text">${escapeHtml(step.text())}</div></div>
      </div>
      <div class="tour-dots" aria-hidden="true">${dots}</div>
      <div class="tour-btns">
        <button class="btn-soft" onclick="${last ? 'tourSkip()' : 'tourSkip()'}">${last ? 'Fermer' : 'Passer'}</button>
        ${tourIndex > 0 ? '<button class="btn-soft" onclick="tourBack()">Retour</button>' : ''}
        <button class="btn-big" id="tour-next" onclick="tourNext()">${last ? 'C\'est parti !' : 'Suivant'}</button>
      </div>
    </div>`;
  document.body.appendChild(root);
  document.body.classList.add('tour-on');
  document.querySelectorAll(`.nav-tab[data-view="${step.tab}"]`).forEach(el => el.classList.add('tour-hl'));
  const next = document.getElementById('tour-next');
  if(next) next.focus();
}

function tourNext(){
  if(tourIndex >= TOUR_STEPS.length - 1) return tourEnd();
  tourIndex++;
  tourRender();
}
function tourBack(){
  if(tourIndex > 0){ tourIndex--; tourRender(); }
}
function tourSkip(){ tourEnd(); }
function tourEnd(){
  tourClear();
  tourIndex = -1;
  if(userProfile.tourPending){
    userProfile.tourPending = false;
    userProfile.tourSeen = true;
    saveProfile();
  }
}

// Rejouer depuis Paramètres : va sur l'accueil, puis relance la visite.
function tourReplay(){
  switchView('home');
  tourStart();
}

document.addEventListener('keydown', e => {
  if(tourIndex < 0) return;
  if(e.key === 'Escape'){ e.preventDefault(); tourSkip(); }
  else if(e.key === 'ArrowRight'){ e.preventDefault(); tourNext(); }
  else if(e.key === 'ArrowLeft'){ e.preventDefault(); tourBack(); }
});
