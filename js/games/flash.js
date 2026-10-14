/* ============================================================
   MINI-JEU 2 — CONJUGAISON ÉCLAIR
   ============================================================ */
const FLASH_VERBS = {
  sinn: { label:'sinn (être)', forms:{ 'ech':'sinn', 'du':'bass', 'hie/si/hatt':'ass', 'mir':'sinn', 'dir':'sidd', 'si':'sinn' } },
  hunn: { label:'hunn (avoir)', forms:{ 'ech':'hunn', 'du':'hues', 'hie/si/hatt':'huet', 'mir':'hunn', 'dir':'hutt', 'si':'hunn' } },
  schaffen: { label:'schaffen (travailler, régulier)', forms:{ 'ech':'schaffen', 'du':'schaffs', 'hie/si/hatt':'schafft', 'mir':'schaffen', 'dir':'schafft', 'si':'schaffen' } },
  kachen: { label:'kachen (cuisiner, régulier)', forms:{ 'ech':'kachen', 'du':'kachs', 'hie/si/hatt':'kacht', 'mir':'kachen', 'dir':'kacht', 'si':'kachen' } },
};
let flashIndex = 0;
let flashTotal = 15;
let flashStreak = 0;
let flashStartTime = 0;
let flashTimerInterval = null;
let flashCurrent = null;
let flashWrongList = [];

function startFlashGame(){
  flashIndex = 0;
  flashStreak = 0;
  flashStartTime = Date.now();
  flashWrongList = [];
  switchView('flash');
  clearInterval(flashTimerInterval);
  flashTimerInterval = setInterval(updateFlashTimer, 1000);
  nextFlash();
}

function updateFlashTimer(){
  const el = document.getElementById('flash-timer');
  if(!el) { clearInterval(flashTimerInterval); return; }
  const secs = Math.floor((Date.now() - flashStartTime)/1000);
  el.textContent = `${secs}s`;
}

function nextFlash(){
  const container = document.getElementById('flash-container');
  if(flashIndex >= flashTotal){
    clearInterval(flashTimerInterval);
    const rawSecs = Math.floor((Date.now()-flashStartTime)/1000);
    const penalty = (flashTotal - flashStreak) * 10;
    const finalScore = rawSecs + penalty;
    const isRecord = recordGameScore('flash', finalScore);
    if(flashStreak === flashTotal && !gameRecords.flashPerfect){ gameRecords.flashPerfect = true; saveGameRecords(); }
    addArcadeXP(flashStreak * 2);
    markMiniGameCompleted('flash');
    const reviewHtml = flashWrongList.length ? `
      <div class="section-title" style="margin-top:20px;">À revoir</div>
      <div style="text-align:left; max-width:340px; margin:0 auto;">
        ${flashWrongList.map(w => `<div style="font-size:13.5px; padding:6px 0; border-bottom:1px solid var(--line);">${w.prompt} → <strong style="color:var(--accent-deep);">${w.correct}</strong> <span style="color:var(--error);">(toi: ${w.given || '—'})</span></div>`).join('')}
      </div>` : '';
    container.innerHTML = `
      <div class="end-screen">
        <div class="num">${flashStreak}/${flashTotal}</div>
        <p>bonnes conjugaisons en ${rawSecs}s (+${penalty}s de pénalité) = <strong>${finalScore}s</strong></p>
        <p style="color:var(--success); font-weight:600;">${isRecord ? 'Nouveau record !' : `Record personnel : ${gameRecords.flash}s`}</p>
        ${reviewHtml}
        <div class="cta-row" style="justify-content:center;">
          <button class="btn btn-primary" onclick="switchView('home')">Retour à l'accueil</button>
          <button class="btn btn-secondary" onclick="startFlashGame()">Rejouer</button>
        </div>
      </div>`;
    return;
  }
  const verbKeys = Object.keys(FLASH_VERBS);
  const verbKey = verbKeys[Math.floor(Math.random()*verbKeys.length)];
  const verb = FLASH_VERBS[verbKey];
  const pronouns = Object.keys(verb.forms);
  const pronoun = pronouns[Math.floor(Math.random()*pronouns.length)];
  flashCurrent = { verbKey, verb, pronoun, answer: verb.forms[pronoun] };

  container.innerHTML = `
    <div class="session-card">
      <div class="game-header"><span>${flashIndex+1} / ${flashTotal}</span><span class="streak">${flashStreak} juste${flashStreak>1?'s':''} · <span id="flash-timer">0s</span></span></div>
      <div class="flash-prompt">${verb.label}</div>
      <div class="flash-word">${pronoun} ___</div>
      <div class="answer-row">
        <input type="text" class="answer-input" id="flash-input" placeholder="conjugue" autocomplete="off">
        <button class="btn btn-primary" onclick="submitFlash()">Valider</button>
      </div>
      <div class="feedback" id="flash-feedback"></div>
    </div>`;
  const input = document.getElementById('flash-input');
  input.focus();
  input.addEventListener('keydown', (e)=>{ if(e.key === 'Enter') submitFlash(); });
}

function submitFlash(){
  const input = document.getElementById('flash-input');
  if(input.disabled) return;
  const status = matchStatus(input.value, flashCurrent.answer);
  const correct = status !== 'wrong';
  const feedback = document.getElementById('flash-feedback');
  input.disabled = true;
  if(status === 'correct'){
    input.classList.add('correct');
    flashStreak++;
    feedback.className = 'feedback correct';
    feedback.textContent = 'Richteg.';
  } else if(status === 'almost'){
    input.classList.add('almost');
    flashStreak++;
    feedback.className = 'feedback almost';
    feedback.textContent = `Presque ! Forme exacte : "${flashCurrent.answer}"`;
  } else {
    input.classList.add('wrong');
    feedback.className = 'feedback wrong';
    feedback.textContent = `Réponse : "${flashCurrent.answer}"`;
    flashWrongList.push({ prompt: `${flashCurrent.verb.label} — ${flashCurrent.pronoun}`, correct: flashCurrent.answer, given: input.value });
  }
  setTimeout(()=>{ flashIndex++; nextFlash(); }, status === 'wrong' ? 1400 : 800);
}
