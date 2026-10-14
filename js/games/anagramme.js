/* ============================================================
   MINI-JEU — ANAGRAMME
   Remet les lettres d'UN mot dans l'ordre (indice : traduction FR). Cible spécifiquement
   l'orthographe interne (accents, doubles consonnes, sch/ë/é) — angle mort des autres jeux,
   qui travaillent au niveau du mot entier ou de la phrase, jamais de la lettre.
   Remplace "pendu" (jamais construit, juste réservé dans GAME_UNLOCK_LEVELS) : Maxime ne
   voulait pas du pendu classique.
   ============================================================ */
let anaQueue = [];
let anaIndex = 0;
let anaTotal = 0;
let anaScore = 0;
let anaCurrent = null;
let anaPlaced = [];

function getAnagramPool(){
  // Mots déjà vus, assez longs pour être un vrai exercice, sans espace (formes composées
  // du type "wéi vill" exclues — l'anagramme ne porte que sur un seul mot).
  return getUnlockedVocab().filter(v => v.lu.length >= 4 && !v.lu.includes(' '));
}

function startAnagramGame(){
  const pool = getAnagramPool();
  anaQueue = [...pool].sort(()=>Math.random()-0.5).slice(0, Math.min(8, pool.length));
  anaTotal = anaQueue.length;
  anaIndex = 0;
  anaScore = 0;
  switchView('anagramme');
  nextAnagram();
}

function nextAnagram(){
  const container = document.getElementById('anagramme-container');
  if(anaIndex >= anaTotal){
    addArcadeXP(anaScore);
    markMiniGameCompleted('anagramme');
    // Badge "Bretzelsonndeg" (dimanche des bretzels) : lettres tordues remises droites, sans-faute.
    if(anaScore === anaTotal && !gameRecords.anagramPerfect){
      gameRecords.anagramPerfect = true; saveGameRecords();
    }
    container.innerHTML = `
      <div class="end-screen">
        <div class="num">${anaScore}/${anaTotal}</div>
        <p>mots reconstitués. +${anaScore} XP Arcade.</p>
        <div class="cta-row" style="justify-content:center;">
          <button class="btn btn-primary" onclick="switchView('home')">Accueil</button>
          <button class="btn btn-secondary" onclick="startAnagramGame()">Rejouer</button>
        </div>
      </div>`;
    return;
  }
  const item = anaQueue[anaIndex];
  anaCurrent = item;
  anaPlaced = [];
  const letters = Array.from(item.lu).map((ch,i)=>({ch,i})).sort(()=>Math.random()-0.5);
  container.innerHTML = `
    <div class="session-card">
      <div class="game-header" style="width:100%;"><span>${anaIndex+1}/${anaTotal}</span><span>${anaScore} justes</span></div>
      <div class="sentence-fr" style="margin-bottom:14px;">Indice : « ${item.fr} »</div>
      <div class="scramble-answer" id="ana-answer"></div>
      <div class="scramble-chips" id="ana-chips">
        ${letters.map(l => `<button class="scramble-chip" id="ana-chip-${l.i}" onclick="placeAnaLetter(${l.i}, '${l.ch.replace(/'/g,"\\'")}')">${l.ch}</button>`).join('')}
      </div>
      <div class="feedback" id="ana-feedback"></div>
      <div class="continue-wrap" id="continue-wrap-ana"></div>
    </div>`;
}

function placeAnaLetter(idx, ch){
  const chip = document.getElementById(`ana-chip-${idx}`);
  if(chip.classList.contains('used')) return;
  chip.classList.add('used');
  anaPlaced.push({idx, ch});
  const answerZone = document.getElementById('ana-answer');
  const span = document.createElement('button');
  span.className = 'placed';
  span.textContent = ch;
  span.onclick = () => unplaceAnaLetter(idx);
  span.id = `ana-placed-${idx}`;
  answerZone.appendChild(span);
  if(anaPlaced.length === Array.from(anaCurrent.lu).length) resolveAnagram();
}

function unplaceAnaLetter(idx){
  anaPlaced = anaPlaced.filter(p => p.idx !== idx);
  const el = document.getElementById(`ana-placed-${idx}`);
  if(el) el.remove();
  const chip = document.getElementById(`ana-chip-${idx}`);
  if(chip) chip.classList.remove('used');
}

function resolveAnagram(){
  document.querySelectorAll('#ana-chips .scramble-chip').forEach(b => b.disabled = true);
  document.querySelectorAll('#ana-answer .placed').forEach(b => b.disabled = true);
  const built = anaPlaced.map(p => p.ch).join('');
  const correct = built === anaCurrent.lu; // comparaison stricte (casse comprise) : c'est justement ce que ce jeu teste
  const feedback = document.getElementById('ana-feedback');
  if(correct){
    anaScore++;
    feedback.className = 'feedback correct';
    feedback.textContent = `Richteg — ${anaCurrent.lu}`;
  } else {
    feedback.className = 'feedback wrong';
    feedback.textContent = `Presque : c'était "${anaCurrent.lu}"`;
  }
  showContinueButton('continue-wrap-ana', () => { anaIndex++; nextAnagram(); });
}
