/* ============================================================
   MINI-JEU — MEMORY (paires LU ↔ FR)
   ============================================================ */
let memCards = [];
let memFlipped = [];
let memMatched = 0;
let memMoves = 0;
let memLock = false;

function getUnlockedVocab(){
  const unlocked = VOCAB.filter(v => vocabProgress[v.id]);
  return unlocked.length >= 8 ? unlocked : VOCAB.slice(0, 30);
}

function startMemoryGame(){
  const pool = [...getUnlockedVocab()].sort(()=>Math.random()-0.5).slice(0, 8);
  memCards = [];
  pool.forEach((v, i) => {
    memCards.push({ pairId:i, text:v.lu, side:'lu' });
    memCards.push({ pairId:i, text:v.fr, side:'fr' });
  });
  memCards.sort(()=>Math.random()-0.5);
  memFlipped = [];
  memMatched = 0;
  memMoves = 0;
  memLock = false;
  switchView('memory');
  renderMemory();
}

function renderMemory(){
  const container = document.getElementById('memory-container');
  container.innerHTML = `
    <div class="session-card" style="min-height:auto;">
      <div class="game-header" style="width:100%;"><span>Memory</span><span>${memMoves} coups · ${memMatched}/8 paires</span></div>
      <div class="memory-grid">
        ${memCards.map((c, i) => `
          <div class="memory-card ${c.matched ? 'matched' : (memFlipped.includes(i) ? '' : 'face-down')}"
               onclick="flipMemCard(${i})">${c.matched || memFlipped.includes(i) ? c.text : '?'}</div>
        `).join('')}
      </div>
      <div class="feedback" id="mem-feedback" style="margin-top:14px;"></div>
    </div>`;
}

function flipMemCard(i){
  if(memLock || memCards[i].matched || memFlipped.includes(i)) return;
  memFlipped.push(i);
  renderMemory();
  if(memFlipped.length === 2){
    memMoves++;
    memLock = true;
    const [a, b] = memFlipped;
    if(memCards[a].pairId === memCards[b].pairId && memCards[a].side !== memCards[b].side){
      memCards[a].matched = true;
      memCards[b].matched = true;
      memMatched++;
      memFlipped = [];
      memLock = false;
      if(memMatched === 8){
        const xp = Math.max(4, 20 - memMoves);
        addArcadeXP(xp);
        markMiniGameCompleted('memory');
        renderMemory();
        document.getElementById('mem-feedback').className = 'feedback correct';
        document.getElementById('mem-feedback').innerHTML = `Gewonnen ! +${xp} XP Arcade. <button class="btn btn-secondary" onclick="startMemoryGame()" style="margin-left:10px;">Rejouer</button>`;
        return;
      }
      renderMemory();
    } else {
      setTimeout(()=>{ memFlipped = []; memLock = false; renderMemory(); }, 900);
    }
  }
}
