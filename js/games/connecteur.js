/* ============================================================
   DONNEES — RELIE LES IDEES (connecteurs)
   ============================================================ */
const CONNECTOR_PROMPTS = [
  {a:"Ech wollt kommen,", b:"ech hat keng Zäit.", right:"awer", fr:"mais", sentenceFr:"Je voulais venir, mais je n'avais pas le temps."},
  {a:"D'Iessen ass gutt,", b:"ze deier.", right:"awer", fr:"mais", sentenceFr:"Le repas est bon, mais trop cher."},
  {a:"Et reent,", b:"huelen ech e Prabbeli mat.", right:"dofir", fr:"donc", sentenceFr:"Il pleut, donc je prends un parapluie."},
  {a:"Ech sinn midd,", b:"ginn ech fréi schlofen.", right:"dofir", fr:"donc", sentenceFr:"Je suis fatigué, donc je vais me coucher tôt."},
  {a:"Ech bleiwen doheem,", b:"ech krank sinn.", right:"well", fr:"parce que", sentenceFr:"Je reste à la maison, parce que je suis malade."},
  {a:"Mir feieren,", b:"mir de Projet fäerdeg hunn.", right:"well", fr:"parce que", sentenceFr:"Nous fêtons ça, parce que nous avons terminé le projet."},
  {a:"Ech maachen d'Aarbecht fäerdeg,", b:"ginn ech heem.", right:"dann", fr:"alors", sentenceFr:"Je termine le travail, puis je rentre chez moi."},
  {a:"Et war spéit,", b:"sinn ech heemgaangen.", right:"dann", fr:"alors", sentenceFr:"Il était tard, alors je suis rentré à la maison."},
  {a:"Mir hunn eng Reunioun,", b:"iesse mir.", right:"duerno", fr:"ensuite", sentenceFr:"Nous avons une réunion, ensuite nous mangeons."},
  {a:"Ech dusche mech,", b:"iessen ech.", right:"duerno", fr:"ensuite", sentenceFr:"Je me douche, ensuite je mange."},
  {a:"De Projet ass gutt,", b:"feelt eis Zäit.", right:"allerdéngs", fr:"cependant", sentenceFr:"Le projet est bon, cependant il nous manque du temps."},
  {a:"D'Wieder ass schéin,", b:"ass et kal.", right:"allerdéngs", fr:"cependant", sentenceFr:"Le temps est beau, cependant il fait froid."},
  {a:"Ech schaffen haut an", b:"muer.", right:"och", fr:"aussi", sentenceFr:"Je travaille aujourd'hui, et demain aussi."},
  {a:"Si schwätzt Franséisch an", b:"Däitsch.", right:"och", fr:"aussi", sentenceFr:"Elle parle français et aussi allemand."},
  {a:"No der Aarbecht sinn ech", b:"doheem.", right:"endlech", fr:"enfin", sentenceFr:"Après le travail, je suis enfin à la maison."},
  {a:"No laangem Waarden ass de Bus", b:"komm.", right:"endlech", fr:"enfin", sentenceFr:"Après une longue attente, le bus est enfin arrivé."},
];
const CONNECTOR_WORDS = ["awer","dofir","well","dann","duerno","allerdéngs","och","endlech"];

let connIndex = 0;
let connTotal = 0;
let connOrder = [];
let connScore = 0;
let connCurrent = null;

function startConnectorGame(){
  connIndex = 0;
  connScore = 0;
  connOrder = [...CONNECTOR_PROMPTS].sort(()=>Math.random()-0.5);
  connTotal = connOrder.length;
  switchView('connecteur');
  nextConnector();
}

function nextConnector(){
  const container = document.getElementById('connecteur-container');
  if(connIndex >= connTotal){
    addArcadeXP(connScore);
    markMiniGameCompleted('connecteur');
    container.innerHTML = `
      <div class="end-screen">
        <div class="num">${connScore}/${connTotal}</div>
        <p>connecteurs trouvés. +${connScore} XP Arcade.</p>
        <div class="cta-row" style="justify-content:center;">
          <button class="btn btn-primary" onclick="switchView('home')">Accueil</button>
          <button class="btn btn-secondary" onclick="startConnectorGame()">Rejouer</button>
        </div>
      </div>`;
    return;
  }
  const p = connOrder[connIndex];
  connCurrent = p;
  const distractors = CONNECTOR_WORDS.filter(w => w !== p.right).sort(()=>Math.random()-0.5).slice(0,3);
  const options = [...distractors, p.right].sort(()=>Math.random()-0.5);
  container.innerHTML = `
    <div class="session-card">
      <div class="game-header" style="width:100%;"><span>${connIndex+1}/${connTotal}</span><span>${connScore} justes</span></div>
      <div class="sentence-fr" style="margin-bottom:8px;">Quel connecteur relie logiquement ces deux idées ?</div>
      <div class="sentence" style="color:var(--accent-deep);">${p.a} ___ ${p.b}</div>
      <div class="qcm-options" id="conn-options">
        ${options.map(o => `<button class="qcm-opt" onclick="answerConnector(this, '${o}')">${o}</button>`).join('')}
      </div>
      <div class="feedback" id="conn-feedback"></div>
      <div class="continue-wrap" id="continue-wrap-conn"></div>
    </div>`;
}

function answerConnector(btn, chosen){
  document.querySelectorAll('#conn-options .qcm-opt').forEach(b => b.disabled = true);
  const correct = chosen === connCurrent.right;
  const feedback = document.getElementById('conn-feedback');
  if(correct){
    connScore++;
    btn.classList.add('correct');
    feedback.className = 'feedback correct';
    feedback.textContent = `Richteg — ${connCurrent.a} ${connCurrent.right} ${connCurrent.b} (${connCurrent.sentenceFr})`;
  } else {
    btn.classList.add('wrong');
    feedback.className = 'feedback wrong';
    feedback.textContent = `Non : ${connCurrent.a} ${connCurrent.right} ${connCurrent.b} (${connCurrent.sentenceFr})`;
  }
  showContinueButton('continue-wrap-conn', () => { connIndex++; nextConnector(); });
}
