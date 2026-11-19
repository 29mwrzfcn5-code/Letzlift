/* ============================================================
   NIVEAU A2 — ouverture, réglage et carte d'invitation
   La logique pure est dans js/lib/level.js ; ici : VOCAB, profil et écrans.
   ============================================================ */

// Ajoute (idempotent) ou retire les mots A2 de VOCAB selon userProfile.levelA2.
// La progression (vocabProgress) n'est jamais touchée : refermer l'A2 la met seulement en veille.
function applyLevelWords(){
  if(typeof VOCAB_A2 === 'undefined') return;
  const have = new Set(VOCAB.map(v => v.id));
  if(userProfile.levelA2){
    VOCAB_A2.forEach(w => { if(!have.has(w.id)) VOCAB.push({ ...w }); });
  } else {
    for(let i = VOCAB.length - 1; i >= 0; i--) if(VOCAB[i].level === 'A2') VOCAB.splice(i, 1);
  }
}

function levelRefreshLabel(){
  const el = document.getElementById('level-label');
  if(el) el.textContent = 'Lëtzebuergesch ' + levelLabel(!!userProfile.levelA2);
}

function a2Status(){ return a2Readiness(VOCAB, vocabProgress); }

function setLevelA2(on){
  on = !!on;
  if(!!userProfile.levelA2 === on) return;
  userProfile.levelA2 = on;
  saveProfile();
  applyLevelWords();
  if(typeof applyVocabOverlay === 'function') applyVocabOverlay(); // corrections éventuelles sur les mots A2
  levelRefreshLabel();
  // redessine l'écran courant
  const active = document.querySelector('.view.active');
  if(!active) return;
  const id = active.id.replace('view-', '');
  if(id === 'parametres' && typeof renderParametres === 'function') renderParametres();
  else if(id === 'vocab' && typeof renderVocabHub === 'function') renderVocabHub();
  else if(id === 'home' && typeof renderHome === 'function') renderHome();
}

// Carte de l'écran Vocabulaire : proposée seulement quand l'A1 est bien en place et que l'A2 n'est pas ouvert.
function levelHubCardHTML(){
  if(userProfile.levelA2 || typeof VOCAB_A2 === 'undefined') return '';
  const st = a2Status();
  if(!st.ready) return '';
  return `<div class="level-card">
    <div class="level-card-t d">Prêt pour l'A2 ?</div>
    <p>Tu as vu ${st.seenPct} % des mots A1 et ${st.solidPct} % sont bien installés. Tu peux ouvrir l'A2 : ${VOCAB_A2.length} mots de plus pour parler du logement, de la santé, du travail, des achats et des voyages.</p>
    <button class="btn-big" onclick="setLevelA2(true)">Ouvrir l'A2</button>
  </div>`;
}

// Carte des Paramètres : on peut ouvrir ou refermer l'A2 à tout moment.
function levelSettingsCardHTML(){
  if(typeof VOCAB_A2 === 'undefined') return '';
  const on = !!userProfile.levelA2;
  const st = a2Status();
  return `<div class="settings-card" id="settings-level-row">
    <div class="settings-title">Niveau</div>
    <div class="settings-desc">L'A1 est le socle. L'A2 ajoute ${VOCAB_A2.length} mots (logement, santé, travail, achats, voyages). Tu peux l'ouvrir ou le refermer quand tu veux : ta progression est conservée.</div>
    <div class="weekly-chips" role="group" aria-label="Niveau visé">
      <button class="weekly-chip ${on ? '' : 'sel'}" onclick="setLevelA2(false)">A1</button>
      <button class="weekly-chip ${on ? 'sel' : ''}" onclick="setLevelA2(true)">A1 + A2</button>
    </div>
    <div class="settings-desc" style="margin-top:8px;">A1 : ${st.seenPct} % des mots vus, ${st.solidPct} % bien installés.${st.ready && !on ? ' Tu es prêt pour l\'A2.' : ''}</div>
  </div>`;
}
