/* ============================================================
   SMALL TALK — liste des thèmes
   ============================================================ */
function renderThemeList(){
  const grid = document.getElementById('theme-grid');
  grid.innerHTML = SMALLTALK.map(t => {
    const known = t.phrases.filter((p,i) => smalltalkProgress[`${t.id}-${i}`]).length;
    const unlocked = isThemeUnlocked(t.id);
    if(unlocked){
      return `
        <button class="theme-card-v2" onclick="openTheme('${t.id}')">
          <div class="theme-icon-v2">${t.icon}</div>
          <div class="theme-name-v2">${t.theme}</div>
          <div class="theme-progress-v2">${known}/${t.phrases.length} connues</div>
        </button>`;
    }
    return `
      <div class="theme-card-v2 locked">
        <div class="theme-icon-v2">${t.icon}</div>
        <div class="theme-name-v2">${t.theme}</div>
        <div class="lock-tag">Niveau ${THEME_UNLOCK_LEVELS[t.id]} requis</div>
      </div>`;
  }).join('');
}

/* ============================================================
   MOTEUR PHRASE-DRILL — fusion Small Talk + Remise en ordre
   3 niveaux façon pari : 1 = clic-ordre (3 pts) / 2 = amorces (5 pts) / 3 = traduction libre (10 pts)
   ============================================================ */
function tokenize(sentence){
  return sentence.replace(/[.?!]/g,'').trim().split(/\s+/);
}

const LEVEL_POINTS = { 1:3, 2:5, 3:10 };
let pdQueue = [];
let pdSourceItems = [];
let pdIndex = 0;
let pdTotal = 0;
let pdCorrect = 0;
let pdPointsEarned = 0;
let pdContextLabel = '';
let pdCurrency = 'endurance';
let pdReturnView = 'home';
let pdTrackRecord = false;
let pdOriginalLimit = 10;
let pdCurrentLevel = null;
let pdTarget = [];
let pdPlaced = [];

function initialsHint(tokens){
  return tokens.map(w => w[0] + '_'.repeat(Math.max(1, w.length - 1))).join(' ');
}

function getVocabPhrasePool(){
  const eligible = v => tokenize(v.sentence.replace('___', v.lu)).length >= 4;
  const unlocked = VOCAB.filter(v => vocabProgress[v.id] && eligible(v));
  const pool = unlocked.length >= 5 ? unlocked : VOCAB.filter(eligible);
  return pool.map(v => ({ lu: v.sentence.replace('___', v.lu), fr: v.sentenceFr, key:`vocab-${v.id}` }));
}

function openTheme(id){
  const theme = SMALLTALK.find(t => t.id === id);
  const items = theme.phrases.map((p,i) => ({ ...p, key:`${id}-${i}` }));
  startPhraseDrill(items, { label: theme.theme, currency:'endurance', returnView:'smalltalk-list', limit: items.length });
}

function startVocabPhraseDrill(){
  startPhraseDrill(getVocabPhrasePool(), { label:'Vocabulaire', currency:'arcade', returnView:'home', limit:10, trackRecord:true });
}

function startPhraseDrill(items, opts){
  pdSourceItems = items;
  pdOriginalLimit = opts.limit || 10;
  pdQueue = [...items].sort(()=>Math.random()-0.5).slice(0, pdOriginalLimit);
  pdTotal = pdQueue.length;
  pdIndex = 0;
  pdCorrect = 0;
  pdPointsEarned = 0;
  pdContextLabel = opts.label || '';
  pdCurrency = opts.currency || 'endurance';
  pdReturnView = opts.returnView || 'home';
  pdTrackRecord = !!opts.trackRecord;
  const backLink = document.getElementById('pd-back-link');
  backLink.onclick = () => switchView(pdReturnView);
  backLink.innerHTML = pdReturnView === 'smalltalk-list' ? '&larr; Tous les thèmes' : '&larr; Accueil';
  switchView('phrase-drill');
  nextPdPhrase();
}

function nextPdPhrase(){
  const container = document.getElementById('phrase-drill-container');
  if(pdIndex >= pdQueue.length){
    const isRecord = pdTrackRecord ? recordGameScoreHigh('phrasedrill', pdPointsEarned) : false;
    // Ne compte pour le défi quotidien que l'entrée "mini-jeu" du hub (pdTrackRecord), pas les
    // sessions Small Talk qui utilisent aussi startPhraseDrill() en interne.
    if(pdTrackRecord) markMiniGameCompleted('phrasedrill');
    const recordLine = pdTrackRecord
      ? `<p style="color:var(--success); font-weight:600;">${isRecord ? 'Nouveau record !' : `Record personnel : ${gameRecords.phrasedrill} pts`}</p>`
      : '';
    container.innerHTML = `
      <div class="end-screen">
        <div class="num">${pdPointsEarned} pts</div>
        <p>${pdCorrect}/${pdTotal} phrases réussies · ${pdContextLabel}</p>
        ${recordLine}
        <div class="cta-row" style="justify-content:center;">
          <button class="btn btn-primary" onclick="switchView('${pdReturnView}')">Retour</button>
          <button class="btn btn-secondary" onclick="startPhraseDrill(pdSourceItems, {label: pdContextLabel, currency: pdCurrency, returnView: pdReturnView, limit: pdOriginalLimit, trackRecord: pdTrackRecord})">Rejouer</button>
        </div>
      </div>`;
    return;
  }
  const p = pdQueue[pdIndex];
  pdCurrentLevel = null;
  container.innerHTML = `
    <div class="phrase-card">
      <div class="hint" style="margin-bottom:14px;">${pdContextLabel} · ${pdIndex+1}/${pdTotal}</div>
      <div class="phrase-fr">${p.fr}</div>
      <div style="display:flex; flex-direction:column; gap:10px; width:100%; max-width:340px; margin-top:16px;">
        <button class="btn btn-secondary" onclick="choosePdLevel(1)">Niveau 1 · Remise en ordre · 3 pts</button>
        <button class="btn btn-secondary" onclick="choosePdLevel(2)">Niveau 2 · Amorces · 5 pts</button>
        <button class="btn btn-secondary" onclick="choosePdLevel(3)">Niveau 3 · Traduction libre · 10 pts</button>
      </div>
    </div>`;
}

function choosePdLevel(level){
  pdCurrentLevel = level;
  const p = pdQueue[pdIndex];
  pdTarget = tokenize(p.lu);
  const container = document.getElementById('phrase-drill-container');
  const header = `<div class="hint" style="margin-bottom:10px;">${pdContextLabel} · ${pdIndex+1}/${pdTotal} · Niveau ${level} (${LEVEL_POINTS[level]} pts)</div><div class="phrase-fr" style="margin-bottom:14px;">${p.fr}</div>`;

  if(level === 1){
    pdPlaced = [];
    const shuffled = pdTarget.map((w,i)=>({w,i})).sort(()=>Math.random()-0.5);
    container.innerHTML = `<div class="phrase-card">${header}
        <div class="scramble-answer" id="scramble-answer"></div>
        <div class="scramble-chips" id="scramble-chips">
          ${shuffled.map(t => `<button class="scramble-chip" id="chip-${t.i}" onclick="placePdChip(${t.i}, '${t.w.replace(/'/g,"\\'")}')">${t.w}</button>`).join('')}
        </div>
        <div class="feedback" id="pd-feedback"></div>
        <div class="continue-wrap" id="continue-wrap-pd"></div>
      </div>`;
  } else {
    const hintLine = level === 2 ? `<div class="sentence" style="font-size:18px; color:var(--muted); margin-bottom:16px;">${initialsHint(pdTarget)}</div>` : '';
    const placeholder = level === 2 ? 'tape la phrase complète' : 'traduis entièrement en lëtzebuergesch';
    container.innerHTML = `<div class="phrase-card">${header}
        ${hintLine}
        <div class="answer-row">
          <input type="text" class="answer-input" id="pd-input" placeholder="${placeholder}" autocomplete="off">
          <button class="btn btn-primary" onclick="submitPdTyped()">Valider</button>
        </div>
        <div class="feedback" id="pd-feedback"></div>
        <div class="continue-wrap" id="continue-wrap-pd"></div>
      </div>`;
    const input = document.getElementById('pd-input');
    input.focus();
    input.addEventListener('keydown', (e)=>{ if(e.key === 'Enter') submitPdTyped(); });
  }
}

function placePdChip(idx, word){
  const chip = document.getElementById(`chip-${idx}`);
  if(chip.classList.contains('used')) return;
  chip.classList.add('used');
  pdPlaced.push({idx, word});
  const answerZone = document.getElementById('scramble-answer');
  const span = document.createElement('button');
  span.className = 'placed';
  span.textContent = word;
  span.onclick = () => unplacePdChip(idx);
  span.id = `placed-${idx}`;
  answerZone.appendChild(span);
  if(pdPlaced.length === pdTarget.length){
    const built = pdPlaced.map(p=>p.word).join(' ');
    // chips déjà bien orthographiés : seul l'ordre peut différer, pas d'état "almost" ici
    resolvePdAnswer(normalize(built) === normalize(pdTarget.join(' ')) ? 'correct' : 'wrong');
  }
}

function unplacePdChip(idx){
  pdPlaced = pdPlaced.filter(p => p.idx !== idx);
  document.getElementById(`placed-${idx}`).remove();
  document.getElementById(`chip-${idx}`).classList.remove('used');
}

function submitPdTyped(){
  const input = document.getElementById('pd-input');
  if(input.disabled) return;
  input.disabled = true;
  const status = matchStatus(input.value, pdTarget.join(' '));
  input.classList.add(status === 'wrong' ? 'wrong' : status);
  resolvePdAnswer(status);
}

function resolvePdAnswer(status){
  const correct = status !== 'wrong';
  const feedback = document.getElementById('pd-feedback');
  const points = LEVEL_POINTS[pdCurrentLevel];
  const target = pdTarget.join(' ');
  if(status === 'correct'){
    pdCorrect++;
    pdPointsEarned += points;
    if(pdCurrency === 'arcade') addArcadeXP(points); else addEnduranceXP(points);
    feedback.className = 'feedback correct';
    feedback.textContent = `Richteg — +${points} pts.`;
  } else if(status === 'almost'){
    pdCorrect++;
    const reduced = Math.max(1, Math.round(points * ALMOST_XP_RATIO));
    pdPointsEarned += reduced;
    if(pdCurrency === 'arcade') addArcadeXP(reduced); else addEnduranceXP(reduced);
    feedback.className = 'feedback almost';
    feedback.textContent = `Presque ! Forme exacte : "${target}" — +${reduced} pt(s).`;
  } else {
    feedback.className = 'feedback wrong';
    feedback.textContent = `Faux : "${target}" — 0 pt.`;
  }
  const p = pdQueue[pdIndex];
  if(p.key && p.key.indexOf('vocab-') !== 0){
    smalltalkProgress[p.key] = correct;
    saveSmalltalkProgress();
  }
  showContinueButton('continue-wrap-pd', () => { pdIndex++; nextPdPhrase(); });
}
