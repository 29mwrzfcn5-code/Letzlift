/* ============================================================
   MINI-JEU — DIALOGUE
   Un court échange (small talk), traduction masquée par défaut, puis une réplique finale
   en QCM parmi des réponses grammaticalement correctes mais pas toutes pertinentes au contexte.
   Un seul dialogue pour l'instant (validation du concept, même logique que Timeline).
   ============================================================ */
const DIALOGUES = [
  {
    id: 'smalltalk_bureau',
    title: 'Small talk au bureau',
    lines: [
      { lu:"Moien! Wéi geet et dir haut?", fr:"Bonjour ! Comment allez-vous aujourd'hui ?" },
      { lu:"Mir geet et gutt, merci. An dir?", fr:"Je vais bien, merci. Et vous ?" },
      { lu:"Net esou gutt, ech sinn e bëssen midd.", fr:"Pas très bien, je suis un peu fatigué." },
    ],
    options: [
      { lu:"Dat deet mir leed. Hues du gutt geschlof?", fr:"Je suis désolé. As-tu bien dormi ?", correct:true },
      { lu:"Ech hu keng Zäit haut.", fr:"Je n'ai pas le temps aujourd'hui.", correct:false },
      { lu:"Wéi vill kascht dat?", fr:"Combien ça coûte ?", correct:false },
    ]
  }
];

let dlgCurrent = null;
let dlgShowFr = false;

function startDialogueGame(){
  dlgCurrent = DIALOGUES[Math.floor(Math.random() * DIALOGUES.length)];
  dlgShowFr = false;
  switchView('dialogue');
  renderDialogueGame();
}

function toggleDialogueFr(){
  dlgShowFr = !dlgShowFr;
  renderDialogueGame();
}

function renderDialogueGame(){
  const container = document.getElementById('dialogue-container');
  const shuffledOptions = [...dlgCurrent.options].sort(()=>Math.random()-0.5);
  container.innerHTML = `
    <div class="session-card">
      <div class="hint" style="margin-bottom:10px;">Dialogue · ${dlgCurrent.title}</div>
      <div class="timeline-text" id="dialogue-text">
        ${dlgCurrent.lines.map(l => `<p>${l.lu}${dlgShowFr ? `<br><span class="timeline-fr">${l.fr}</span>` : ''}</p>`).join('')}
      </div>
      <button class="btn btn-ghost" style="margin:10px 0 18px;" onclick="toggleDialogueFr()">${dlgShowFr ? 'Masquer' : 'Afficher'} la traduction</button>
      <div class="sentence-fr" style="margin-bottom:12px;">Quelle est la réponse la plus appropriée ?</div>
      <div class="qcm-options" id="dialogue-options">
        ${shuffledOptions.map((o,i) => `<button class="qcm-opt" onclick="answerDialogue(this, ${o.correct})">${o.lu}</button>`).join('')}
      </div>
      <div class="feedback" id="dialogue-feedback"></div>
      <div class="continue-wrap" id="continue-wrap-dialogue"></div>
    </div>`;
}

function answerDialogue(btn, isCorrect){
  document.querySelectorAll('#dialogue-options .qcm-opt').forEach(b => b.disabled = true);
  const feedback = document.getElementById('dialogue-feedback');
  const xp = isCorrect ? 4 : 0;
  if(xp) addArcadeXP(xp);
  markMiniGameCompleted('dialogue');
  if(isCorrect){
    btn.classList.add('correct');
    feedback.className = 'feedback correct';
    feedback.textContent = `Richteg ! +${xp} XP Arcade.`;
  } else {
    btn.classList.add('wrong');
    feedback.className = 'feedback wrong';
    const right = dlgCurrent.options.find(o => o.correct);
    feedback.textContent = `Pas la plus naturelle ici — on attendrait plutôt : "${right.lu}" (${right.fr})`;
  }
  const wrap = document.getElementById('continue-wrap-dialogue');
  wrap.innerHTML = `
    <div class="cta-row" style="justify-content:center; margin-top:16px;">
      <button class="btn btn-primary" onclick="switchView('home')">Accueil</button>
      <button class="btn btn-secondary" onclick="startDialogueGame()">Rejouer</button>
    </div>`;
}
