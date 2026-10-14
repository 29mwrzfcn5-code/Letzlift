/* ============================================================
   MINI-JEU 3 — VRAI / FAUX CHRONOMÉTRÉ
   ============================================================ */
let tfIndex = 0;
let tfTotal = 20;
let tfStreak = 0;
let tfStartTime = 0;
let tfTimerInterval = null;
let tfCurrent = null;
let tfWrongList = [];

function startTrueFalseGame(){
  tfIndex = 0;
  tfStreak = 0;
  tfStartTime = Date.now();
  tfWrongList = [];
  switchView('truefalse');
  clearInterval(tfTimerInterval);
  tfTimerInterval = setInterval(updateTfTimer, 1000);
  nextTf();
}

function updateTfTimer(){
  const el = document.getElementById('tf-timer');
  if(!el){ clearInterval(tfTimerInterval); return; }
  const secs = Math.floor((Date.now()-tfStartTime)/1000);
  el.textContent = `${secs}s`;
}

function nextTf(){
  const container = document.getElementById('tf-container');
  if(tfIndex >= tfTotal){
    clearInterval(tfTimerInterval);
    const rawSecs = Math.floor((Date.now()-tfStartTime)/1000);
    const penalty = (tfTotal - tfStreak) * 10;
    const finalScore = rawSecs + penalty;
    const isRecord = recordGameScore('truefalse', finalScore);
    if(tfStreak === tfTotal && !gameRecords.tfPerfect){ gameRecords.tfPerfect = true; saveGameRecords(); }
    addArcadeXP(tfStreak);
    markMiniGameCompleted('truefalse');
    const reviewHtml = tfWrongList.length ? `
      <div class="section-title" style="margin-top:20px;">À revoir</div>
      <div style="text-align:left; max-width:340px; margin:0 auto;">
        ${tfWrongList.map(w => `<div style="font-size:13.5px; padding:6px 0; border-bottom:1px solid var(--line);">${w.lu} = <strong style="color:var(--accent-deep);">${w.fr}</strong></div>`).join('')}
      </div>` : '';
    container.innerHTML = `
      <div class="end-screen">
        <div class="num">${tfStreak}/${tfTotal}</div>
        <p>bonnes réponses en ${rawSecs}s (+${penalty}s de pénalité) = <strong>${finalScore}s</strong></p>
        <p style="color:var(--success); font-weight:600;">${isRecord ? 'Nouveau record !' : `Record personnel : ${gameRecords.truefalse}s`}</p>
        ${reviewHtml}
        <div class="cta-row" style="justify-content:center;">
          <button class="btn btn-primary" onclick="switchView('home')">Retour à l'accueil</button>
          <button class="btn btn-secondary" onclick="startTrueFalseGame()">Rejouer</button>
        </div>
      </div>`;
    return;
  }
  const pool = getUnlockedVocab();
  const item = pool[Math.floor(Math.random()*pool.length)];
  const isTrue = Math.random() < 0.5;
  let shownFr = item.fr;
  if(!isTrue){
    const others = pool.filter(v => v.id !== item.id);
    shownFr = others[Math.floor(Math.random()*others.length)].fr;
  }
  tfCurrent = { item, isTrue };

  container.innerHTML = `
    <div class="session-card">
      <div class="game-header"><span>${tfIndex+1} / ${tfTotal}</span><span class="streak">${tfStreak} juste${tfStreak>1?'s':''} · <span id="tf-timer">0s</span></span></div>
      <div class="tf-word">${item.lu}</div>
      <div class="tf-translation">= ${shownFr} ?</div>
      <div class="tf-btn-row">
        <button class="tf-btn tf-true" onclick="answerTf(true)">Vrai</button>
        <button class="tf-btn tf-false" onclick="answerTf(false)">Faux</button>
      </div>
      <div class="feedback" id="tf-feedback"></div>
    </div>`;
}

function answerTf(userSaysTrue){
  const correct = userSaysTrue === tfCurrent.isTrue;
  const feedback = document.getElementById('tf-feedback');
  if(correct){
    tfStreak++;
    feedback.className = 'feedback correct';
    feedback.textContent = 'Richteg.';
  } else {
    feedback.className = 'feedback wrong';
    feedback.textContent = tfCurrent.isTrue ? 'C\'était vrai.' : `C'était faux — "${tfCurrent.item.lu}" = "${tfCurrent.item.fr}"`;
    tfWrongList.push({ lu: tfCurrent.item.lu, fr: tfCurrent.item.fr });
  }
  setTimeout(()=>{ tfIndex++; nextTf(); }, correct ? 500 : 1300);
}
