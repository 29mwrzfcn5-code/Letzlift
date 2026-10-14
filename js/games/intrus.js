/* ============================================================
   MINI-JEU — L'INTRUS (trouve le mot d'une autre catégorie)
   ============================================================ */
let intrusIndex = 0;
let intrusTotal = 10;
// Niveau 2 de L'intrus : au lieu de piocher l'intrus dans une catégorie totalement arbitraire
// (souvent trop évident), on le pioche dans une catégorie THÉMATIQUEMENT PROCHE — curée à la
// main plutôt que déduite automatiquement, faute de sous-tags sémantiques dans les données.
// Repli sur le comportement niveau 1 (catégorie arbitraire) si la catégorie n'a pas de paire
// définie ou si la paire n'a pas assez de mots disponibles — le jeu ne doit jamais rester bloqué.
const INTRUS_ADJACENT_CATS = {
  'Chiffres': ['Ordinaux'], 'Ordinaux': ['Chiffres'],
  'Jours': ['Mois'], 'Mois': ['Jours'],
  'Prépositions': ['Connecteurs'], 'Connecteurs': ['Prépositions'],
  'Verbes': ['Verbes modaux'], 'Verbes modaux': ['Verbes'],
  'Lieux': ['Services'], 'Services': ['Lieux'],
  'Corps': ['Vêtements'], 'Vêtements': ['Corps'],
  'Météo': ['Nature'], 'Nature': ['Météo'],
  'Transport': ['Directions'], 'Directions': ['Transport'],
  'Adjectifs': ['Émotions'], 'Émotions': ['Adjectifs'],
  'Quantité': ['Adverbes'], 'Adverbes': ['Quantité'],
};

let intrusLevel = 1;

function chooseIntrusLevel(){
  switchView('intrus');
  const container = document.getElementById('intrus-container');
  container.innerHTML = `
    <div class="session-card">
      <div class="sentence-fr" style="margin-bottom:14px;">Choisis un niveau</div>
      <div class="cta-row" style="flex-direction:column; gap:12px; width:100%; max-width:340px;">
        <button class="btn btn-primary" onclick="startIntrusGame(1)">Niveau 1 — Catégorie au hasard</button>
        <button class="btn btn-secondary" onclick="startIntrusGame(2)">Niveau 2 — Catégorie proche (plus difficile)</button>
      </div>
    </div>`;
}

let intrusScore = 0;
let intrusCurrent = null;

function startIntrusGame(level){
  intrusLevel = level || 1;
  intrusIndex = 0;
  intrusScore = 0;
  switchView('intrus');
  nextIntrus();
}

function nextIntrus(){
  const container = document.getElementById('intrus-container');
  if(intrusIndex >= intrusTotal){
    addArcadeXP(intrusScore);
    markMiniGameCompleted('intrus');
    // Badge "Renert" (le renard rusé du folklore luxembourgeois) : sans-faute en niveau 2,
    // le niveau qui exige justement de repérer l'intrus le plus rusé.
    if(intrusLevel === 2 && intrusScore === intrusTotal && !gameRecords.intrusL2Perfect){
      gameRecords.intrusL2Perfect = true; saveGameRecords();
    }
    container.innerHTML = `
      <div class="end-screen">
        <div class="num">${intrusScore}/${intrusTotal}</div>
        <p>intrus trouvés. +${intrusScore} XP Arcade.</p>
        <div class="cta-row" style="justify-content:center;">
          <button class="btn btn-primary" onclick="switchView('home')">Accueil</button>
          <button class="btn btn-secondary" onclick="startIntrusGame(intrusLevel)">Rejouer</button>
        </div>
      </div>`;
    return;
  }
  const pool = getUnlockedVocab();
  const cats = [...new Set(pool.map(v=>v.cat))].filter(c => pool.filter(v=>v.cat===c).length >= 3);
  const mainCat = cats[Math.floor(Math.random()*cats.length)];
  let others = cats.filter(c => c !== mainCat);
  if(intrusLevel === 2){
    const adjacent = (INTRUS_ADJACENT_CATS[mainCat] || []).filter(c => others.includes(c));
    if(adjacent.length > 0) others = adjacent; // sinon : repli silencieux sur le niveau 1 pour cette manche
  }
  const intrusCat = others[Math.floor(Math.random()*others.length)];
  const mainWords = pool.filter(v=>v.cat===mainCat).sort(()=>Math.random()-0.5).slice(0,3);
  const intrusPool = pool.filter(v=>v.cat===intrusCat);
  const intrusWord = intrusPool[Math.floor(Math.random()*intrusPool.length)];
  const options = [...mainWords, intrusWord].sort(()=>Math.random()-0.5);
  intrusCurrent = { intrusId: intrusWord.id, intrusLu: intrusWord.lu, intrusCat, mainCat };

  container.innerHTML = `
    <div class="session-card">
      <div class="game-header" style="width:100%;"><span>${intrusIndex+1}/${intrusTotal}</span><span>${intrusScore} justes</span></div>
      <div class="sentence-fr" style="margin-bottom:18px;">Trois mots vont ensemble, un est l'intrus. Lequel ?</div>
      <div class="qcm-options" id="intrus-options">
        ${options.map(o => `<button class="qcm-opt" onclick="answerIntrus(this, '${o.id}')">${o.lu}</button>`).join('')}
      </div>
      <div class="feedback" id="intrus-feedback"></div>
      <div class="continue-wrap" id="continue-wrap-intrus"></div>
    </div>`;
}

function answerIntrus(btn, chosenId){
  const buttons = document.querySelectorAll('#intrus-options .qcm-opt');
  buttons.forEach(b => b.disabled = true);
  const correct = chosenId === intrusCurrent.intrusId;
  const feedback = document.getElementById('intrus-feedback');
  if(correct){
    intrusScore++;
    btn.classList.add('correct');
    feedback.className = 'feedback correct';
    feedback.textContent = `Richteg — les trois autres sont "${intrusCurrent.mainCat}".`;
  } else {
    btn.classList.add('wrong');
    feedback.className = 'feedback wrong';
    feedback.textContent = `Non — l'intrus était "${intrusCurrent.intrusLu}" (${intrusCurrent.intrusCat}), les trois autres sont "${intrusCurrent.mainCat}".`;
  }
  showContinueButton('continue-wrap-intrus', () => { intrusIndex++; nextIntrus(); });
}
