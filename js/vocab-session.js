/* ============================================================
   RENDU — SESSION VOCABULAIRE
   ============================================================ */
let sessionQueue = [];
let sessionIndex = 0;
let sessionPlannedIds = new Set();
let sessionSeenIds = new Set();   // mots affichés au moins une fois cette session (bouge dès la 1ère carte)
let sessionCredit = new Map();    // id -> 0..1, progression fractionnelle (learning steps) pour la barre
let sessionAnswered = 0;          // nb de réponses données cette session (pour le résumé de fin)
let sessionCorrect = 0;           // dont correctes ('almost' compte comme correct, cohérent avec le reste de l'app)
let sessionDifficultWords = new Map(); // id -> {lu, fr, status} — mots ratés ou "presque" cette session
let currentItem = null;
let currentMode = 'type';
let sessionKind = 'normal'; // 'normal' | 'mastery' | 'difficult' | 'confidence' (v1.16.3)
let difficultRepCount = new Map(); // id -> nb de réussites CETTE session, mode "mots difficiles" (v1.16.3)

function startVocabSession(){
  ensureDailyState();
  sessionKind = 'normal';
  sessionStats.totalSessions = (sessionStats.totalSessions || 0) + 1;
  saveStats();
  const minutes = userProfile.sessionMinutes || DEFAULT_SESSION_MINUTES;
  sessionQueue = isGoalReached() ? buildReinforcementQueue(minutes) : buildSessionQueue(minutes);
  if(sessionQueue.length === 0){
    sessionQueue = [...VOCAB].sort(()=>Math.random()-0.5).slice(0, 15);
  }
  sessionPlannedIds = new Set(sessionQueue.map(v => v.id));
  sessionSeenIds = new Set();
  sessionCredit = new Map();
  sessionAnswered = 0;
  sessionCorrect = 0;
  sessionDifficultWords = new Map();
  sessionIndex = 0;
  switchView('vocab');
  timerEnterExercise(); // après switchView, qui a éteint le chrono en traitant 'vocab' comme le hub
  nextCard();
}

// Session dédiée : ne tire que dans les mots déjà acquis (boîtes 4-5), pour les maintenir actifs
// en mémoire plutôt que de les laisser se faire évincer par le flot des révisions boîtes 1-3.
function startMasterySession(){
  ensureDailyState();
  sessionKind = 'mastery';
  sessionStats.totalSessions = (sessionStats.totalSessions || 0) + 1;
  saveStats();
  const minutes = userProfile.sessionMinutes || DEFAULT_SESSION_MINUTES;
  sessionQueue = buildMasteryQueue(minutes);
  if(sessionQueue.length === 0){
    // rien en boîte 4-5 encore : pas de session possible, pas de nouveaux mots introduits ici
    return { empty: true };
  }
  sessionPlannedIds = new Set(sessionQueue.map(v => v.id));
  sessionSeenIds = new Set();
  sessionCredit = new Map();
  sessionAnswered = 0;
  sessionCorrect = 0;
  sessionDifficultWords = new Map();
  sessionIndex = 0;
  switchView('vocab');
  timerEnterExercise();
  nextCard();
  return { empty: false };
}

function startDifficultWordsSession(){
  ensureDailyState();
  const pool = getDifficultPool().slice(0, DIFFICULT_SESSION_SIZE);
  if(pool.length === 0) return { empty: true };
  sessionKind = 'difficult';
  sessionStats.totalSessions = (sessionStats.totalSessions || 0) + 1;
  saveStats();
  difficultRepCount = new Map();
  sessionQueue = pool;
  sessionPlannedIds = new Set(sessionQueue.map(v => v.id));
  sessionSeenIds = new Set();
  sessionCredit = new Map();
  sessionAnswered = 0;
  sessionCorrect = 0;
  sessionDifficultWords = new Map();
  sessionIndex = 0;
  switchView('vocab');
  timerEnterExercise();
  nextCard();
  return { empty: false };
}

function startConfidenceSession(){
  ensureDailyState();
  const pool = getConfidencePool();
  if(pool.length === 0) return { empty: true };
  sessionKind = 'confidence';
  sessionStats.totalSessions = (sessionStats.totalSessions || 0) + 1;
  saveStats();
  sessionQueue = [...pool].sort(()=>Math.random()-0.5).slice(0, CONFIDENCE_SESSION_SIZE);
  sessionPlannedIds = new Set(sessionQueue.map(v => v.id));
  sessionSeenIds = new Set();
  sessionCredit = new Map();
  sessionAnswered = 0;
  sessionCorrect = 0;
  sessionDifficultWords = new Map();
  sessionIndex = 0;
  switchView('vocab');
  timerEnterExercise();
  nextCard();
  return { empty: false };
}

function normalize(s){
  return s.trim().toLowerCase()
    .replace(/ë/g,'e').replace(/é/g,'e').replace(/è/g,'e')
    .replace(/â/g,'a').replace(/ä/g,'a').replace(/ü/g,'u').replace(/ö/g,'o');
}

const ALMOST_XP_RATIO = 0.5; // XP réduit (moitié) quand seule l'orthographe exacte (accents/casse) diffère

// Compare une saisie à la réponse cible avec 3 niveaux :
// 'correct' = orthographe exacte, 'almost' = juste sur le fond (accents/casse/espaces près), 'wrong' = rien à voir
function matchStatus(input, target){
  const rawIn = (input || '').trim();
  const rawTarget = (target || '').trim();
  if(rawIn === rawTarget) return 'correct';
  if(normalize(rawIn) === normalize(rawTarget)) return 'almost';
  return 'wrong';
}

// Certains mots (verbes modaux : fr="je peux" mais lu="kann") acceptent plusieurs
// réponses valides en mode "sens inverse" (ex. "kann" ou "ech kann"). On retient
// le meilleur statut obtenu parmi la réponse principale et ses alternatives (altLu).
function bestMatchStatus(input, item){
  const candidates = [item.lu, ...(item.altLu || [])];
  let best = 'wrong';
  for(const candidate of candidates){
    const status = matchStatus(input, candidate);
    if(status === 'correct') return 'correct';
    if(status === 'almost') best = 'almost';
  }
  return best;
}

function showContinueButton(containerId, callback){
  const container = document.getElementById(containerId);
  if(!container) return;
  container.innerHTML = '<button class="btn btn-primary continue-btn">Continuer →</button>';
  let done = false;
  const onKeydown = (e) => {
    if(e.key === 'Enter'){ e.preventDefault(); fire(); }
  };
  function fire(){
    if(done) return;
    done = true;
    document.removeEventListener('keydown', onKeydown);
    callback();
  }
  container.querySelector('.continue-btn').addEventListener('click', fire, { once:true });
  // attache l'écouteur au tick suivant : sinon, la même frappe Entrée qui vient de déclencher
  // la soumission de la réponse (encore en train de remonter dans le DOM) déclencherait aussi
  // "Continuer" instantanément, escamotant le feedback avant que la personne ait pu le voir.
  setTimeout(() => { if(!done) document.addEventListener('keydown', onKeydown); }, 0);
}

function pickCardMode(item){
  const modes = ['type','type','qcm','reverse']; // "type" pondéré plus lourd (mode principal)
  if(item.g) modes.push('genre');
  return modes[Math.floor(Math.random()*modes.length)];
}

function indefiniteArticleFor(item){
  if(item.g === 'f') return 'eng';
  // n-Regel : le n final reste devant une voyelle ou d, h, n, t, z.
  return /^[aeiouäëéöüdhntz]/i.test((item.lu || '').trim()) ? 'en' : 'e';
}

function randomDistractors(exclude, n){
  const pool = VOCAB.filter(v => v.id !== exclude.id && v.cat === exclude.cat);
  const fallback = VOCAB.filter(v => v.id !== exclude.id);
  const source = pool.length >= n ? pool : fallback;
  const shuffled = [...source].sort(()=>Math.random()-0.5);
  return shuffled.slice(0, n);
}

function nextCard(){
  const container = document.getElementById('vocab-session-container');
  if(sessionIndex >= sessionQueue.length){
    const doneCount = sessionSeenIds.size;
    const pct = sessionAnswered ? Math.round(sessionCorrect / sessionAnswered * 100) : null;
    const difficultList = [...sessionDifficultWords.values()];
    const difficultHtml = difficultList.length ? `
      <div class="result-review">
        <div class="result-review-title">Mots à retravailler</div>
        ${difficultList.map(w => `<div class="result-review-row"><span>${w.lu}</span><span><strong>${w.fr}</strong>${w.status==='almost' ? ' <span style="opacity:0.7;">(presque)</span>' : ''}</span></div>`).join('')}
      </div>` : '';
    container.innerHTML = `
      <div class="result-card">
        <svg class="result-contour" viewBox="0 0 400 160" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0,120 Q100,90 200,110 T400,95" fill="none" stroke="#fff" stroke-width="1"/>
          <path d="M0,140 Q100,110 200,130 T400,118" fill="none" stroke="#fff" stroke-width="1"/>
        </svg>
        <div class="result-coin">${pct !== null && pct >= 80 ? '🏆' : '✓'}</div>
        <p class="result-score">${sessionAnswered ? `${sessionCorrect}/${sessionAnswered}` : doneCount}</p>
        <p class="result-sub">${sessionAnswered ? `réponses justes · ${pct}% de réussite` : `mot${doneCount>1?'s':''} révisé${doneCount>1?'s':''}`}</p>
        <div class="result-stats">
          <div class="result-stat"><div class="n">${doneCount}</div><div class="l">mots vus</div></div>
          <div class="result-stat"><div class="n">${dailyState.xpToday}</div><div class="l">XP du jour</div></div>
          <div class="result-stat"><div class="n">${difficultList.length}</div><div class="l">à revoir</div></div>
        </div>
        ${difficultHtml}
        <div class="result-cta">
          <button class="btn-result-secondary" onclick="switchView('home')">Accueil</button>
          <button class="btn-result-primary" onclick="switchView('vocab')">Encore une session</button>
        </div>
      </div>`;
    return;
  }
  currentItem = sessionQueue[sessionIndex];
  currentMode = pickCardMode(currentItem);
  sessionSeenIds.add(currentItem.id);
  if(!vocabProgress[currentItem.id]){
    markWordIntroduced();
  }
  const entry = getEntry(currentItem.id);
  const box = entry.box;
  const learningStep = entry.learningStep;
  const stillLearning = learningStep !== undefined && learningStep < 3;
  const boxColors = {1:'var(--box1)',2:'var(--box2)',3:'var(--box3)',4:'var(--box4)',5:'var(--box5)'};
  const pillLabel = stillLearning ? `${currentItem.cat} · Apprentissage ${learningStep+1}/3` : `${currentItem.cat} · Boîte ${box}`;
  const plannedCount = sessionPlannedIds.size || 1;
  const creditSum = [...sessionCredit.values()].reduce((a,b)=>a+b, 0);
  const progressPct = Math.min(100, Math.round((creditSum / plannedCount) * 100));
  const modeLabels = {type:'À compléter', qcm:'QCM', reverse:'Sens inverse', genre:'Genre du mot'};

  let bodyHtml = '';
  if(currentMode === 'type'){
    const sentenceHtml = currentItem.sentence.replace('___', '<span class="blank" id="blank-slot">?</span>');
    bodyHtml = `
      <div class="sentence">${sentenceHtml}</div>
      <div class="sentence-fr">${currentItem.sentenceFr}</div>
      <div class="answer-row">
        <input type="text" class="answer-input" id="answer-input" placeholder="tape le mot manquant" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="go">
        <button class="btn btn-primary" onclick="submitTypeAnswer()">Valider</button>
      </div>
      <div class="feedback" id="feedback"></div>`;
  } else if(currentMode === 'qcm'){
    const distractors = randomDistractors(currentItem, 3).map(d=>d.fr);
    const options = [...distractors, currentItem.fr].sort(()=>Math.random()-0.5);
    bodyHtml = `
      <div class="sentence">${currentItem.lu}</div>
      <div class="sentence-fr">Choisis la bonne traduction</div>
      <div class="qcm-options" id="qcm-options">
        ${options.map(opt => `<button class="qcm-opt" onclick="submitQcmAnswer(this, '${opt.replace(/'/g,"\\'")}')">${opt}</button>`).join('')}
      </div>
      <div class="feedback" id="feedback"></div>`;
  } else if(currentMode === 'reverse'){
    bodyHtml = `
      <div class="sentence">${currentItem.fr}</div>
      <div class="sentence-fr">Traduis en luxembourgeois</div>
      <div class="answer-row">
        <input type="text" class="answer-input" id="answer-input" placeholder="tape le mot en lëtzebuergesch" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="go">
        <button class="btn btn-primary" onclick="submitTypeAnswer()">Valider</button>
      </div>
      <div class="feedback" id="feedback"></div>`;
  } else if(currentMode === 'genre'){
    const rightArticle = indefiniteArticleFor(currentItem);
    bodyHtml = `
      <div class="sentence">${currentItem.lu}</div>
      <div class="sentence-fr">« un/une » ${currentItem.fr} — e, en ou eng ?</div>
      <div class="qcm-options" id="qcm-options" style="flex-direction:row; justify-content:center;">
        <button class="qcm-opt" style="width:90px; text-align:center;" onclick="submitGenreAnswer(this, 'e', '${rightArticle}')">e</button>
        <button class="qcm-opt" style="width:90px; text-align:center;" onclick="submitGenreAnswer(this, 'en', '${rightArticle}')">en</button>
        <button class="qcm-opt" style="width:90px; text-align:center;" onclick="submitGenreAnswer(this, 'eng', '${rightArticle}')">eng</button>
      </div>
      <div class="feedback" id="feedback"></div>`;
  }

  container.innerHTML = `
    <div class="session-card">
      <div class="session-progress"><div class="session-progress-bar" style="width:${progressPct}%;"></div></div>
      <span class="box-pill" style="background:${boxColors[box]};">${pillLabel}</span>
      <div class="mode-tag">${modeLabels[currentMode]}</div>
      ${bodyHtml}
      <div class="continue-wrap" id="continue-wrap-vocab"></div>
      <div class="hint">${sessionSeenIds.size} / ${sessionPlannedIds.size} mots vus</div>
    </div>
  `;
  const input = document.getElementById('answer-input');
  if(input){
    input.focus();
    input.addEventListener('keydown', (e)=>{ if(e.key === 'Enter') submitTypeAnswer(); });
  }
}

// requeueGap : null si la carte est réglée pour cette session (review classique, ou mot qui vient
// de diplômer) — sinon [min,max], intervalle de cartes avant la prochaine réapparition.
function advanceAfter(correct, requeueGap){
  showContinueButton('continue-wrap-vocab', () => {
    const id = currentItem.id;
    if(requeueGap){
      const gap = randomInRange(requeueGap);
      const pos = Math.min(sessionQueue.length, sessionIndex + 1 + gap);
      sessionQueue.splice(pos, 0, currentItem);
      // progression fractionnelle : étape 0/1/2 encore en apprentissage → 0.25/0.5/0.75
      const step = getEntry(id).learningStep || 0;
      const credit = (step + 1) / 4;
      if(credit > (sessionCredit.get(id) || 0)) sessionCredit.set(id, credit);
    } else {
      sessionCredit.set(id, 1); // review réglée, ou mot qui vient de diplômer
    }
    sessionIndex++;
    nextCard();
  });
}

// Alimente le résumé de fin de session (stats + mots à retravailler). Séparé de recordAnswer()
// qui ne reçoit qu'un booléen correct/faux — ici on veut aussi distinguer 'almost' des deux
// autres statuts, uniquement disponible au niveau des fonctions submit*Answer.
function trackSessionAnswer(item, status){
  sessionAnswered++;
  if(status !== 'wrong') sessionCorrect++;
  if(status === 'correct'){
    // repassé et enfin réussi dans cette même session (Leitner requeue) : ne compte plus comme "à retravailler"
    sessionDifficultWords.delete(item.id);
  } else {
    sessionDifficultWords.set(item.id, { lu:item.lu, fr:item.fr, status });
  }
}

function submitTypeAnswer(){
  const input = document.getElementById('answer-input');
  if(!input || input.disabled) return;
  const val = input.value;
  const target = currentItem.lu;
  const status = currentMode === 'reverse' ? bestMatchStatus(val, currentItem) : matchStatus(val, target);
  const correct = status !== 'wrong'; // 'almost' compte comme correct pour la progression
  const feedback = document.getElementById('feedback');
  input.disabled = true;

  if(status === 'correct'){
    input.classList.add('correct');
    const xpType = currentMode === 'reverse' ? 'reverse' : 'type';
    const { amount, overtime } = addEnduranceXP(XP_VALUES[xpType]);
    feedback.className = 'feedback correct';
    feedback.textContent = `Richteg — correct. +${amount} XP${overtime ? ' (bonus renforcement)' : ''}`;
  } else if(status === 'almost'){
    input.classList.add('almost');
    const xpType = currentMode === 'reverse' ? 'reverse' : 'type';
    const { amount, overtime } = addEnduranceXP(XP_VALUES[xpType], ALMOST_XP_RATIO);
    feedback.className = 'feedback almost';
    feedback.textContent = `Presque ! La forme exacte : "${currentItem.lu}" (accents/majuscules). +${amount} XP${overtime ? ' (bonus renforcement)' : ''}`;
  } else {
    input.classList.add('wrong');
    feedback.className = 'feedback wrong';
    feedback.textContent = `Faux. La bonne réponse : "${currentItem.lu}"`;
  }
  const requeueGap = recordAnswer(currentItem.id, correct);
  trackSessionAnswer(currentItem, status);
  advanceAfter(correct, requeueGap);
}

function submitQcmAnswer(btn, chosen){
  const wrapper = document.getElementById('qcm-options');
  const buttons = wrapper.querySelectorAll('.qcm-opt');
  buttons.forEach(b => b.disabled = true);
  const correct = chosen === currentItem.fr;
  const feedback = document.getElementById('feedback');
  if(correct){
    btn.classList.add('correct');
    const { amount, overtime } = addEnduranceXP(XP_VALUES.qcm);
    feedback.className = 'feedback correct';
    feedback.textContent = `Richteg — correct. +${amount} XP${overtime ? ' (bonus renforcement)' : ''}`;
  } else {
    btn.classList.add('wrong');
    buttons.forEach(b => { if(b.textContent === currentItem.fr) b.classList.add('correct'); });
    feedback.className = 'feedback wrong';
    feedback.textContent = `La bonne réponse : "${currentItem.fr}"`;
  }
  const requeueGap = recordAnswer(currentItem.id, correct);
  trackSessionAnswer(currentItem, correct ? 'correct' : 'wrong');
  advanceAfter(correct, requeueGap);
}

function submitGenreAnswer(btn, chosen, rightAnswer){
  const wrapper = document.getElementById('qcm-options');
  const buttons = wrapper.querySelectorAll('.qcm-opt');
  buttons.forEach(b => b.disabled = true);
  const correct = chosen === rightAnswer;
  const feedback = document.getElementById('feedback');
  if(correct){
    btn.classList.add('correct');
    const { amount, overtime } = addEnduranceXP(XP_VALUES.genre);
    feedback.className = 'feedback correct';
    feedback.textContent = `Richteg — correct. +${amount} XP${overtime ? ' (bonus renforcement)' : ''}`;
  } else {
    btn.classList.add('wrong');
    buttons.forEach(b => { if(b.textContent === rightAnswer) b.classList.add('correct'); });
    feedback.className = 'feedback wrong';
    feedback.textContent = `La bonne réponse : "${rightAnswer}"`;
  }
  const requeueGap = recordAnswer(currentItem.id, correct);
  trackSessionAnswer(currentItem, correct ? 'correct' : 'wrong');
  advanceAfter(correct, requeueGap);
}
