/* ============================================================
   DONNEES — DEVINE LA QUESTION (mots interrogatifs)
   ============================================================ */
const INTERROGATIVE_PROMPTS = [
  {answer:"Ech kafen e Bic.", answerFr:"J'achète un stylo.", right:"Wat", hint:"Wat kafs du?", hintFr:"Qu'est-ce que tu achètes ?"},
  {answer:"Mir schwätzen iwwer d'Aarbecht.", answerFr:"Nous parlons du travail.", right:"Wat", hint:"Iwwer wat schwätzt Dir?", hintFr:"De quoi parlez-vous ?"},
  {answer:"Ech iessen eng Zalot.", answerFr:"Je mange une salade.", right:"Wat", hint:"Wat ëss du?", hintFr:"Qu'est-ce que tu manges ?"},
  {answer:"Ech heeschen Marc.", answerFr:"Je m'appelle Marc.", right:"Wéi", hint:"Wéi heeschs du?", hintFr:"Comment t'appelles-tu ?"},
  {answer:"Et geet mir gutt.", answerFr:"Je vais bien.", right:"Wéi", hint:"Wéi geet et dir?", hintFr:"Comment vas-tu ?"},
  {answer:"Ech kommen mam Vëlo.", answerFr:"Je viens à vélo.", right:"Wéi", hint:"Wéi kënns du op d'Aarbecht?", hintFr:"Comment viens-tu au travail ?"},
  {answer:"Ech wunnen zu Lëtzebuerg.", answerFr:"J'habite au Luxembourg.", right:"Wou", hint:"Wou wunns du?", hintFr:"Où habites-tu ?"},
  {answer:"D'Reunioun ass am Büro.", answerFr:"La réunion est au bureau.", right:"Wou", hint:"Wou ass d'Reunioun?", hintFr:"Où est la réunion ?"},
  {answer:"Ech sinn am Gaart.", answerFr:"Je suis dans le jardin.", right:"Wou", hint:"Wou bass du?", hintFr:"Où es-tu ?"},
  {answer:"D'Reunioun ass muer.", answerFr:"La réunion est demain.", right:"Wéini", hint:"Wéini ass d'Reunioun?", hintFr:"Quand est la réunion ?"},
  {answer:"Ech kommen ëm néng Auer.", answerFr:"Je viens à neuf heures.", right:"Wéini", hint:"Wéini kënns du?", hintFr:"Quand viens-tu ?"},
  {answer:"De Projet fänkt nächst Woch un.", answerFr:"Le projet commence la semaine prochaine.", right:"Wéini", hint:"Wéini fänkt de Projet un?", hintFr:"Quand commence le projet ?"},
  {answer:"Well ech midd sinn.", answerFr:"Parce que je suis fatigué.", right:"Firwat", hint:"Firwat gees du fréi heem?", hintFr:"Pourquoi rentres-tu tôt ?"},
  {answer:"Well et reent.", answerFr:"Parce qu'il pleut.", right:"Firwat", hint:"Firwat hues du en Prabbeli?", hintFr:"Pourquoi as-tu un parapluie ?"},
  {answer:"Well ech Zäit brauch.", answerFr:"Parce que j'ai besoin de temps.", right:"Firwat", hint:"Firwat bass du net do?", hintFr:"Pourquoi n'es-tu pas là ?"},
  {answer:"Mäi Chef.", answerFr:"Mon chef.", right:"Wien", hint:"Wien huet dat gesot?", hintFr:"Qui a dit ça ?"},
  {answer:"Meng Kolleegin.", answerFr:"Ma collègue.", right:"Wien", hint:"Wien kënnt haut?", hintFr:"Qui vient aujourd'hui ?"},
  {answer:"De Marc.", answerFr:"Marc.", right:"Wien", hint:"Wien schafft haut am Büro?", hintFr:"Qui travaille au bureau aujourd'hui ?"},
  {answer:"Dräi Euro.", answerFr:"Trois euros.", right:"Wéi vill", hint:"Wéi vill kascht dat?", hintFr:"Combien ça coûte ?"},
  {answer:"Fënnef Leit.", answerFr:"Cinq personnes.", right:"Wéi vill", hint:"Wéi vill Leit sinn an der Reunioun?", hintFr:"Combien de personnes sont à la réunion ?"},
  {answer:"Zéng Minutten.", answerFr:"Dix minutes.", right:"Wéi vill", hint:"Wéi vill Zäit brauchs du?", hintFr:"Combien de temps as-tu besoin ?"},
];
const INTERROGATIVE_WORDS = ["Wat","Wéi","Wou","Wéini","Firwat","Wien","Wéi vill"];

let intgIndex = 0;
let intgTotal = 0;
let intgOrder = [];
let intgScore = 0;
let intgCurrent = null;

let intgLevel = 1;

function chooseInterrogativeLevel(){
  switchView('interrogatif');
  const container = document.getElementById('interrogatif-container');
  container.innerHTML = `
    <div class="session-card">
      <div class="sentence-fr" style="margin-bottom:14px;">Choisis un niveau</div>
      <div class="cta-row" style="flex-direction:column; gap:12px; width:100%; max-width:340px;">
        <button class="btn btn-primary" onclick="startInterrogativeGame(1)">Niveau 1 — Avec la traduction</button>
        <button class="btn btn-secondary" onclick="startInterrogativeGame(2)">Niveau 2 — Sans traduction</button>
      </div>
    </div>`;
}

function startInterrogativeGame(level){
  intgLevel = level || 1;
  intgIndex = 0;
  intgScore = 0;
  intgOrder = [...INTERROGATIVE_PROMPTS].sort(()=>Math.random()-0.5);
  intgTotal = intgOrder.length;
  switchView('interrogatif');
  nextInterrogative();
}

function nextInterrogative(){
  const container = document.getElementById('interrogatif-container');
  if(intgIndex >= intgTotal){
    addArcadeXP(intgScore);
    markMiniGameCompleted('interrogatif');
    // Badge "Kniddelen" (boulettes de pâte, plat familier) : sans-faute en niveau 2, sans la
    // traduction pour t'aider — comme reconnaître le plat rien qu'à sa forme.
    if(intgLevel === 2 && intgScore === intgTotal && !gameRecords.interrogatifL2Perfect){
      gameRecords.interrogatifL2Perfect = true; saveGameRecords();
    }
    container.innerHTML = `
      <div class="end-screen">
        <div class="num">${intgScore}/${intgTotal}</div>
        <p>bonnes questions devinées. +${intgScore} XP Arcade.</p>
        <div class="cta-row" style="justify-content:center;">
          <button class="btn btn-primary" onclick="switchView('home')">Accueil</button>
          <button class="btn btn-secondary" onclick="startInterrogativeGame(intgLevel)">Rejouer</button>
        </div>
      </div>`;
    return;
  }
  const p = intgOrder[intgIndex];
  intgCurrent = p;
  const distractors = INTERROGATIVE_WORDS.filter(w => w !== p.right).sort(()=>Math.random()-0.5).slice(0,3);
  const options = [...distractors, p.right].sort(()=>Math.random()-0.5);
  container.innerHTML = `
    <div class="session-card">
      <div class="game-header" style="width:100%;"><span>${intgIndex+1}/${intgTotal}</span><span>${intgScore} justes</span></div>
      <div class="sentence-fr" style="margin-bottom:8px;">Quel mot interrogatif a déclenché cette réponse ?</div>
      <div class="sentence" style="color:var(--accent-deep);">${p.answer}</div>
      ${intgLevel === 1 ? `<div class="sentence-fr" style="margin-top:4px; margin-bottom:4px;">${p.answerFr}</div>` : ''}
      <div class="qcm-options" id="intg-options">
        ${options.map(o => `<button class="qcm-opt" onclick="answerInterrogative(this, '${o}')">${o}</button>`).join('')}
      </div>
      <div class="feedback" id="intg-feedback"></div>
      <div class="continue-wrap" id="continue-wrap-intg"></div>
    </div>`;
}

function answerInterrogative(btn, chosen){
  document.querySelectorAll('#intg-options .qcm-opt').forEach(b => b.disabled = true);
  const correct = chosen === intgCurrent.right;
  const feedback = document.getElementById('intg-feedback');
  const translationBlock = `
    <div style="margin-top:8px; font-size:13.5px; font-weight:400; color:var(--ink-soft); font-family:'IBM Plex Sans',sans-serif;">
      ${intgCurrent.hint} <span style="color:var(--muted);">(${intgCurrent.hintFr})</span><br>
      ${intgCurrent.answer} <span style="color:var(--muted);">(${intgCurrent.answerFr})</span>
    </div>`;
  if(correct){
    intgScore++;
    btn.classList.add('correct');
    feedback.className = 'feedback correct';
    feedback.innerHTML = `Richteg !${translationBlock}`;
  } else {
    btn.classList.add('wrong');
    feedback.className = 'feedback wrong';
    feedback.innerHTML = `Net richteg.${translationBlock}`;
  }
  showContinueButton('continue-wrap-intg', () => { intgIndex++; nextInterrogative(); });
}
