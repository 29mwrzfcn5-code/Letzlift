/* ============================================================
   TEST DE PLACEMENT DU VOCABULAIRE
   Vrai test (à compléter / QCM mélangés, cf. v1.3.0) sur les mots jamais rencontrés — pensé au
   départ pour repartir vite après une perte de progression, mais utilisable à tout moment : ne
   porte que sur les mots absents de vocabProgress, sans effet sur ceux déjà en cours d'apprentissage.

   Les résultats ne sont PLUS committés mot par mot pendant le test (v1.4.0) : ils s'accumulent
   dans plResults, et un récapitulatif à la fin (renderPlacementRecap) laisse Maxime piloter où
   atterrissent les mots réussis (boîte 3/4/5, réglage groupé + ajustement mot par mot en option)
   et décider si les mots ratés doivent quand même être inclus — rien n'est écrit dans
   vocabProgress avant validation explicite (commitPlacementResults).

   Aucun XP, aucun impact sur le quota de nouveaux mots du jour : ce n'est pas de l'apprentissage,
   c'est un inventaire de calibration. Les stats de révision (totalReviews, taux de réussite)
   sont en revanche bien alimentées à chaque question — ce sont de vraies tentatives évaluées.

   Rythme par vagues (150 mots puis vagues de 20, avec un point d'étape "je continue" entre
   chaque) plutôt qu'une liste continue de 387 mots d'un coup — décision de Maxime.
   ============================================================ */
const PLACEMENT_FIRST_WAVE = 150;
const PLACEMENT_WAVE_SIZE = 20;

let plQueue = [];
let plIndex = 0;
let plWaveStart = 0;    // index où commence la vague en cours dans plQueue
let plWaveEnd = 0;      // index (exclusif) où s'arrête la vague en cours dans plQueue
let plKnownCount = 0;
let plSeenCount = 0;
let plResults = [];             // {id, lu, fr, correct} accumulés, committés seulement au récap
let plRecapKnownBox = 3;        // réglage groupé pour les mots réussis
let plRecapIncludeWrong = false; // réglage groupé pour les mots ratés
let plOverrides = new Map();    // id -> '3'|'4'|'5'|'skip', ajustement individuel (prime sur le réglage groupé)
let plCurrentMode = 'type';

function startPlacementTest(){
  plQueue = VOCAB.filter(v => !vocabProgress[v.id]);
  plIndex = 0;
  plWaveStart = 0;
  plKnownCount = 0;
  plSeenCount = 0;
  plResults = [];
  plRecapKnownBox = 3;
  plRecapIncludeWrong = false;
  plOverrides = new Map();
  plWaveEnd = Math.min(PLACEMENT_FIRST_WAVE, plQueue.length);
  switchView('placement');
  renderPlacementIntro();
}

function renderPlacementIntro(){
  const container = document.getElementById('placement-container');
  if(plQueue.length === 0){
    container.innerHTML = `
      <div class="session-empty">
        <h2 style="color:var(--ink);">Rien à tester</h2>
        <p>Tous les mots du dictionnaire sont déjà dans ton suivi — ce test ne porte que sur les mots jamais rencontrés.</p>
        <div class="cta-row" style="justify-content:center;">
          <button class="btn btn-primary" onclick="switchView('niveau')">Retour</button>
        </div>
      </div>`;
    return;
  }
  container.innerHTML = `
    <div class="session-card">
      <h2 style="margin-top:0;">Test de placement</h2>
      <p class="sentence-fr">${plQueue.length} mots jamais rencontrés, testés comme en session normale (à compléter ou QCM). Chaque réponse est enregistrée au fur et à mesure — tu peux t'arrêter à tout moment sans rien perdre. Première vague : ${plWaveEnd} mots, puis par 20 ensuite. Un récapitulatif à la fin te laissera ajuster où chaque mot a atterri si besoin.</p>
      <div class="cta-row" style="justify-content:center; margin-top:16px;">
        <button class="btn btn-primary" onclick="renderPlacementCard()">Commencer</button>
        <button class="btn btn-secondary" onclick="switchView('niveau')">Plus tard</button>
      </div>
    </div>`;
}

function renderPlacementCard(){
  const container = document.getElementById('placement-container');
  if(plIndex >= plWaveEnd){ renderPlacementCheckpoint(); return; }
  const item = plQueue[plIndex];
  const waveTotal = plWaveEnd - plWaveStart;
  const positionInWave = plIndex - plWaveStart;
  const progressPct = Math.round(positionInWave / waveTotal * 100);
  plCurrentMode = Math.random() < 0.5 ? 'type' : 'qcm';
  const modeLabels = { type:'À compléter', qcm:'QCM' };

  let bodyHtml = '';
  if(plCurrentMode === 'type'){
    const sentenceHtml = item.sentence.replace('___', '<span class="blank" id="blank-slot">?</span>');
    bodyHtml = `
      <div class="sentence">${sentenceHtml}</div>
      <div class="sentence-fr">${item.sentenceFr}</div>
      <div class="answer-row">
        <input type="text" class="answer-input" id="placement-input" placeholder="tape le mot manquant" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="go">
        <button class="btn btn-primary" onclick="submitPlacementType()">Valider</button>
      </div>
      <div class="feedback" id="placement-feedback"></div>`;
  } else {
    const distractors = randomDistractors(item, 3).map(d=>d.fr);
    const options = [...distractors, item.fr].sort(()=>Math.random()-0.5);
    bodyHtml = `
      <div class="sentence">${item.lu}</div>
      <div class="sentence-fr">Choisis la bonne traduction</div>
      <div class="qcm-options" id="placement-options">
        ${options.map(opt => `<button class="qcm-opt" onclick="submitPlacementQcm(this, '${opt.replace(/'/g,"\\'")}')">${opt}</button>`).join('')}
      </div>
      <div class="feedback" id="placement-feedback"></div>`;
  }

  container.innerHTML = `
    <div class="session-card">
      <div class="session-progress"><div class="session-progress-bar" style="width:${progressPct}%;"></div></div>
      <div class="mode-tag">Test de placement · ${modeLabels[plCurrentMode]} · ${plKnownCount} connu${plKnownCount>1?'s':''} jusqu'ici</div>
      ${bodyHtml}
      <div class="continue-wrap" id="continue-wrap-placement"></div>
      <div class="hint">${plSeenCount + 1} / ${plQueue.length} au total</div>
    </div>`;
  const input = document.getElementById('placement-input');
  if(input){
    input.focus();
    input.addEventListener('keydown', (e)=>{ if(e.key === 'Enter') submitPlacementType(); });
  }
}

function submitPlacementType(){
  const input = document.getElementById('placement-input');
  if(!input || input.disabled) return;
  const item = plQueue[plIndex];
  const status = matchStatus(input.value, item.lu);
  input.disabled = true;
  const feedback = document.getElementById('placement-feedback');
  if(status === 'correct'){
    input.classList.add('correct');
    feedback.className = 'feedback correct'; feedback.textContent = 'Richteg — correct.';
  } else if(status === 'almost'){
    input.classList.add('almost');
    feedback.className = 'feedback almost'; feedback.textContent = `Presque ! La forme exacte : "${item.lu}" (accents/majuscules).`;
  } else {
    input.classList.add('wrong');
    feedback.className = 'feedback wrong'; feedback.textContent = `Pas encore : "${item.lu}"`;
  }
  resolvePlacementAnswer(status !== 'wrong');
}

function submitPlacementQcm(btn, chosen){
  const item = plQueue[plIndex];
  document.querySelectorAll('#placement-options .qcm-opt').forEach(b => b.disabled = true);
  const correct = chosen === item.fr;
  const feedback = document.getElementById('placement-feedback');
  if(correct){
    btn.classList.add('correct');
    feedback.className = 'feedback correct'; feedback.textContent = 'Richteg — correct.';
  } else {
    btn.classList.add('wrong');
    document.querySelectorAll('#placement-options .qcm-opt').forEach(b => { if(b.textContent === item.fr) b.classList.add('correct'); });
    feedback.className = 'feedback wrong'; feedback.textContent = `La bonne réponse : "${item.fr}"`;
  }
  resolvePlacementAnswer(correct);
}

// Décide où (ou si) un résultat atterrit dans vocabProgress, selon les réglages groupés actuels
// et un éventuel ajustement individuel (plOverrides prime toujours). Utilisée à la fois en direct
// pendant le test (sécurité) et en masse depuis le récap (ajustement) — une seule logique, jamais
// deux versions qui pourraient diverger.
function computeBoxForResult(r){
  const override = plOverrides.get(r.id);
  if(override !== undefined) return override;
  return r.correct ? String(plRecapKnownBox) : (plRecapIncludeWrong ? '3' : 'skip');
}

function applyPlacementDecision(r, box){
  if(box === 'skip'){
    delete vocabProgress[r.id];
  } else {
    const b = Number(box);
    vocabProgress[r.id] = { box: b, dueAt: Date.now() + BOX_INTERVALS_MS[b] };
  }
}

// Enregistre CHAQUE réponse immédiatement, avec le réglage par défaut du moment — la progression
// n'est plus jamais perdue si le récap final n'est jamais atteint (bug réel vécu : un test de
// ~175 mots entièrement perdu faute d'avoir cliqué "Valider mes choix"). Le récap ne conditionne
// plus l'enregistrement : il permet seulement de RÉAJUSTER ce qui est déjà sauvegardé.
async function resolvePlacementAnswer(correct){
  const item = plQueue[plIndex];
  sessionStats.totalReviews += 1;
  saveStats();
  recordVocabAttempt(correct);
  const result = { id:item.id, lu:item.lu, fr:item.fr, correct };
  plResults.push(result);
  if(correct) plKnownCount++;
  applyPlacementDecision(result, computeBoxForResult(result));
  await saveVocabProgress();
  showContinueButton('continue-wrap-placement', () => {
    plIndex++;
    plSeenCount++;
    renderPlacementCard();
  });
}

function renderPlacementCheckpoint(){
  const container = document.getElementById('placement-container');
  const remaining = plQueue.length - plIndex;
  if(remaining === 0){ renderPlacementRecap(); return; }
  container.innerHTML = `
    <div class="session-card">
      <h2 style="margin-top:0;">Étape</h2>
      <p class="sentence-fr">${plSeenCount}/${plQueue.length} mots vus, ${plKnownCount} connus — déjà enregistrés. Il en reste ${remaining}. Continuer avec ${Math.min(PLACEMENT_WAVE_SIZE, remaining)} de plus ?</p>
      <div class="cta-row" style="justify-content:center; margin-top:16px;">
        <button class="btn btn-primary" onclick="continuePlacementWave()">Je continue</button>
        <button class="btn btn-secondary" onclick="renderPlacementRecap()">Voir le récapitulatif et ajuster</button>
        <button class="btn btn-ghost" onclick="switchView('niveau')">Terminer sans ajuster</button>
      </div>
    </div>`;
}

function continuePlacementWave(){
  plWaveStart = plWaveEnd;
  plWaveEnd = Math.min(plWaveEnd + PLACEMENT_WAVE_SIZE, plQueue.length);
  renderPlacementCard();
}

/* ---- Récapitulatif : les résultats sont déjà enregistrés au fil du test (v1.4.1) — ce
   récap sert à les ajuster, pas à les valider une première fois. ---- */

function boxConsequenceLabel(box){
  const map = {
    3: "Prochaine révision dans 3 jours. Une erreur plus tard te fait redescendre en boîte 1.",
    4: "Prochaine révision dans 7 jours, pour les mots dont tu es sûr. Une erreur plus tard te fait aussi redescendre en boîte 1.",
    5: "Prochaine révision dans 14 jours, marqué comme pleinement maîtrisé. Attention : contrairement à la Révision des acquis (qui amortit une erreur en boîte 3), une erreur en session normale te fait retomber directement en boîte 1. À réserver aux mots vraiment sûrs.",
  };
  return map[box];
}

function renderPlacementRecap(){
  const container = document.getElementById('placement-container');
  if(plResults.length === 0){
    container.innerHTML = `
      <div class="session-empty">
        <h2 style="color:var(--ink);">Rien à afficher</h2>
        <p>Tu n'as répondu à aucune question pour l'instant.</p>
        <div class="cta-row" style="justify-content:center;">
          <button class="btn btn-primary" onclick="switchView('niveau')">Retour</button>
        </div>
      </div>`;
    return;
  }
  const known = plResults.filter(r => r.correct);
  const wrong = plResults.filter(r => !r.correct);

  const renderOverrideRow = (r, isKnownGroup) => {
    const current = plOverrides.get(r.id) || 'group';
    const options = [
      ['group', 'Suivre le réglage du groupe'],
      ['3','Boîte 3'], ['4','Boîte 4'], ['5','Boîte 5'],
      ['skip', isKnownGroup ? 'Ne pas inclure' : 'Laisser non vu'],
    ];
    return `
      <div class="placement-recap-row">
        <span>${r.lu} <span class="timeline-fr">= ${r.fr}</span></span>
        <select onchange="setPlacementOverride('${r.id}', this.value)">
          ${options.map(([v,l]) => `<option value="${v}" ${v===current?'selected':''}>${l}</option>`).join('')}
        </select>
      </div>`;
  };

  container.innerHTML = `
    <div class="session-card" style="text-align:left;">
      <h2 style="margin-top:0; text-align:center;">Récapitulatif du test</h2>
      <p class="sentence-fr" style="text-align:center;">${plResults.length} mots testés cette session, déjà enregistrés en boîte 3 par défaut. Ajuste ci-dessous si besoin.</p>

      <div class="section-title">Mots maîtrisés (${known.length})</div>
      ${known.length ? `
        <div class="placement-recap-controls">
          <label>Les placer en :
            <select onchange="setPlacementKnownBox(this.value)">
              <option value="3" ${plRecapKnownBox===3?'selected':''}>Boîte 3 (3 jours)</option>
              <option value="4" ${plRecapKnownBox===4?'selected':''}>Boîte 4 (7 jours)</option>
              <option value="5" ${plRecapKnownBox===5?'selected':''}>Boîte 5 (14 jours, maîtrisé)</option>
            </select>
          </label>
          <p class="timeline-fr">${boxConsequenceLabel(plRecapKnownBox)}</p>
        </div>
        <details><summary>Ajuster un mot en particulier (${known.length})</summary>${known.map(r=>renderOverrideRow(r,true)).join('')}</details>
      ` : `<p class="timeline-fr">Aucun.</p>`}

      <div class="section-title" style="margin-top:24px;">Mots à retravailler (${wrong.length})</div>
      ${wrong.length ? `
        <div class="placement-recap-controls">
          <label><input type="checkbox" ${plRecapIncludeWrong?'checked':''} onchange="setPlacementIncludeWrong(this.checked)"> Les inclure quand même en boîte 3 (si c'était une étourderie)</label>
          <p class="timeline-fr">Par défaut, ces mots restent non vus et seront introduits normalement plus tard, à leur tour.</p>
        </div>
        <details><summary>Ajuster un mot en particulier (${wrong.length})</summary>${wrong.map(r=>renderOverrideRow(r,false)).join('')}</details>
      ` : `<p class="timeline-fr">Aucun.</p>`}

      <div class="cta-row" style="justify-content:center; margin-top:24px;">
        <button class="btn btn-primary" onclick="commitPlacementResults()">Appliquer mes ajustements</button>
      </div>
    </div>`;
}

function setPlacementKnownBox(v){ plRecapKnownBox = Number(v); renderPlacementRecap(); }
function setPlacementIncludeWrong(v){ plRecapIncludeWrong = v; renderPlacementRecap(); }
function setPlacementOverride(id, v){
  if(v === 'group') plOverrides.delete(id); else plOverrides.set(id, v);
}

// Réapplique les décisions à tous les résultats — que la plupart soient déjà enregistrés
// (via resolvePlacementAnswer, au fil du test) n'a pas d'importance : réappliquer est sans
// risque (idempotent) et gère aussi bien les changements de réglage (ex. boîte 3 -> 5) que
// les retraits (ex. un mot connu explicitement exclu par ajustement individuel).
function commitPlacementResults(){
  plResults.forEach(r => applyPlacementDecision(r, computeBoxForResult(r)));
  saveVocabProgress();
  switchView('niveau');
}
