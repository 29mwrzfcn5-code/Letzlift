/* ============================================================
   MINI-JEU — L'HORLOGE (dire l'heure)
   ============================================================ */
const LU_HOURS = ['zwielef','eng','zwou','dräi','véier','fënnef','sechs','siwen','aacht','néng','zéng','eelef'];
let clockIndex = 0;
let clockTotal = 10;
let clockScore = 0;
let clockCurrent = null;
let clockLevel = 1;

function timeToLux(h, m){
  const h12 = h % 12;
  const next = (h12 + 1) % 12;
  if(m === 0) return `Et ass ${LU_HOURS[h12]} Auer`;
  if(m === 15) return `Et ass Véierel no ${LU_HOURS[h12]}`;
  if(m === 30) return `Et ass hallwer ${LU_HOURS[next]}`;
  if(m === 45) return `Et ass Véierel vir ${LU_HOURS[next]}`;
  return '';
}

function clockSvg(h, m){
  const hourAngle = ((h % 12) + m/60) * 30 - 90;
  const minAngle = m * 6 - 90;
  const hx = 100 + 45 * Math.cos(hourAngle * Math.PI/180);
  const hy = 100 + 45 * Math.sin(hourAngle * Math.PI/180);
  const mx = 100 + 68 * Math.cos(minAngle * Math.PI/180);
  const my = 100 + 68 * Math.sin(minAngle * Math.PI/180);
  let ticks = '';
  for(let i=0; i<12; i++){
    const a = i * 30 * Math.PI/180;
    ticks += `<line x1="${100+80*Math.cos(a)}" y1="${100+80*Math.sin(a)}" x2="${100+88*Math.cos(a)}" y2="${100+88*Math.sin(a)}" stroke="#8A8A78" stroke-width="2"/>`;
  }
  return `<svg class="clock-face" width="170" height="170" viewBox="0 0 200 200">
    <circle cx="100" cy="100" r="92" fill="#fff" stroke="#123B37" stroke-width="4"/>
    ${ticks}
    <line x1="100" y1="100" x2="${hx}" y2="${hy}" stroke="#1F2620" stroke-width="6" stroke-linecap="round"/>
    <line x1="100" y1="100" x2="${mx}" y2="${my}" stroke="#123B37" stroke-width="4" stroke-linecap="round"/>
    <circle cx="100" cy="100" r="6" fill="#1F2620"/>
  </svg>`;
}

function chooseClockLevel(){
  switchView('horloge');
  const container = document.getElementById('horloge-container');
  container.innerHTML = `
    <div class="session-card">
      <div class="sentence-fr" style="margin-bottom:14px;">Choisis un niveau</div>
      <div class="cta-row" style="flex-direction:column; gap:12px; width:100%; max-width:320px;">
        <button class="btn btn-primary" onclick="startClockGame(1)">Niveau 1 — Lire l'heure (QCM)</button>
        <button class="btn btn-secondary" onclick="startClockGame(2)">Niveau 2 — Écrire l'heure</button>
      </div>
    </div>`;
}

function startClockGame(level){
  clockLevel = level || 1;
  clockIndex = 0;
  clockScore = 0;
  switchView('horloge');
  nextClock();
}

function nextClock(){
  const container = document.getElementById('horloge-container');
  if(clockIndex >= clockTotal){
    const finalScore = Math.round(clockScore);
    addArcadeXP(finalScore);
    markMiniGameCompleted('horloge');
    container.innerHTML = `
      <div class="end-screen">
        <div class="num">${clockScore}/${clockTotal}</div>
        <p>heures correctement lues. +${finalScore} XP Arcade.</p>
        <div class="cta-row" style="justify-content:center;">
          <button class="btn btn-primary" onclick="switchView('home')">Accueil</button>
          <button class="btn btn-secondary" onclick="startClockGame(clockLevel)">Rejouer</button>
          <button class="btn btn-ghost" onclick="chooseClockLevel()">Changer de niveau</button>
        </div>
      </div>`;
    return;
  }
  const h = 1 + Math.floor(Math.random()*12);
  const mins = [0, 15, 30, 45];
  const m = mins[Math.floor(Math.random()*4)];
  const rightAnswer = timeToLux(h, m);
  clockCurrent = { rightAnswer };

  if(clockLevel === 2){
    container.innerHTML = `
      <div class="session-card">
        <div class="game-header" style="width:100%;"><span>${clockIndex+1}/${clockTotal}</span><span>${clockScore} justes</span></div>
        ${clockSvg(h, m)}
        <div class="sentence-fr" style="margin-bottom:10px;">Écris l'heure en luxembourgeois (« Et ass ... »)</div>
        <input type="text" class="answer-input" id="clock-input" autocomplete="off" onkeydown="if(event.key==='Enter') submitClockTyped();">
        <button class="btn btn-primary" style="margin-top:12px;" onclick="submitClockTyped()">Valider</button>
        <div class="feedback" id="clock-feedback"></div>
        <div class="continue-wrap" id="continue-wrap-clock"></div>
      </div>`;
    setTimeout(()=>{ const inp = document.getElementById('clock-input'); if(inp) inp.focus(); }, 0);
    return;
  }

  const distractors = new Set();
  while(distractors.size < 3){
    const dh = 1 + Math.floor(Math.random()*12);
    const dm = mins[Math.floor(Math.random()*4)];
    const d = timeToLux(dh, dm);
    if(d !== rightAnswer) distractors.add(d);
  }
  const options = [rightAnswer, ...distractors].sort(()=>Math.random()-0.5);

  container.innerHTML = `
    <div class="session-card">
      <div class="game-header" style="width:100%;"><span>${clockIndex+1}/${clockTotal}</span><span>${clockScore} justes</span></div>
      ${clockSvg(h, m)}
      <div class="qcm-options" id="clock-options">
        ${options.map(o => `<button class="qcm-opt" onclick="answerClock(this, '${o.replace(/'/g,"\\'")}')">${o}</button>`).join('')}
      </div>
      <div class="feedback" id="clock-feedback"></div>
      <div class="continue-wrap" id="continue-wrap-clock"></div>
    </div>`;
}

function answerClock(btn, chosen){
  const buttons = document.querySelectorAll('#clock-options .qcm-opt');
  buttons.forEach(b => b.disabled = true);
  const correct = chosen === clockCurrent.rightAnswer;
  const feedback = document.getElementById('clock-feedback');
  if(correct){
    clockScore++;
    btn.classList.add('correct');
    feedback.className = 'feedback correct';
    feedback.textContent = 'Richteg.';
  } else {
    btn.classList.add('wrong');
    buttons.forEach(b => { if(b.textContent === clockCurrent.rightAnswer) b.classList.add('correct'); });
    feedback.className = 'feedback wrong';
    feedback.textContent = `C'était : "${clockCurrent.rightAnswer}"`;
  }
  showContinueButton('continue-wrap-clock', () => { clockIndex++; nextClock(); });
}

function submitClockTyped(){
  const input = document.getElementById('clock-input');
  if(input.disabled) return;
  input.disabled = true;
  const status = matchStatus(input.value, clockCurrent.rightAnswer);
  const feedback = document.getElementById('clock-feedback');
  input.classList.add(status === 'wrong' ? 'wrong' : status);
  if(status === 'correct'){
    clockScore++;
    feedback.className = 'feedback correct';
    feedback.textContent = 'Richteg.';
  } else if(status === 'almost'){
    clockScore += 0.5;
    feedback.className = 'feedback almost';
    feedback.textContent = `Presque ! Forme exacte : "${clockCurrent.rightAnswer}"`;
  } else {
    feedback.className = 'feedback wrong';
    feedback.textContent = `C'était : "${clockCurrent.rightAnswer}"`;
  }
  showContinueButton('continue-wrap-clock', () => { clockIndex++; nextClock(); });
}
