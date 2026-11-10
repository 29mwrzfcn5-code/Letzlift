/* ============================================================
   MINI-JEU — LE BON ARTICLE (genre des noms et règle du n, à la chaîne, chrono)
   Questions : en/e/eng, keen/kee/keng, den/de/d', et « Ech hunn / hu … ».
   Chaque réponse est expliquée ; les erreurs sont classées « genre » ou « n » (voir js/genre.js).
   ============================================================ */
let artIndex = 0;
let artTotal = 15;
let artScore = 0;
let artStartTime = 0;
let artPausedMs = 0;    // temps passé à lire les corrections : il ne compte pas dans le chrono
let artAnswerAt = 0;    // instant de la réponse en cours (0 : aucune correction affichée)
let artTimerInterval = null;
let artCurrent = null;   // question en cours
let artWrongList = [];
let artGenreErrors = 0;
let artNErrors = 0;

// Temps de jeu écoulé, corrections exclues (le chrono est figé tant que la correction est à l'écran).
function artElapsedMs(){
  const now = Date.now();
  return now - artStartTime - artPausedMs - (artAnswerAt ? now - artAnswerAt : 0);
}

function startArticleGame(){
  artPausedMs = 0;
  artAnswerAt = 0;
  artIndex = 0;
  artScore = 0;
  artGenreErrors = 0;
  artNErrors = 0;
  artStartTime = Date.now();
  artWrongList = [];
  switchView('article');
  clearInterval(artTimerInterval);
  artTimerInterval = setInterval(()=>{
    const el = document.getElementById('art-timer');
    if(!el){ clearInterval(artTimerInterval); return; }
    el.textContent = `${Math.floor(artElapsedMs()/1000)}s`;
  }, 1000);
  nextArticle();
}

function nextArticle(){
  const container = document.getElementById('article-container');
  if(artIndex >= artTotal){
    clearInterval(artTimerInterval);
    const rawSecs = Math.floor(artElapsedMs()/1000);
    const penalty = (artTotal - artScore) * 10;
    const finalScore = rawSecs + penalty;
    const isRecord = recordGameScore('article', finalScore);
    addArcadeXP(artScore);
    markMiniGameCompleted('article');
    const reviewHtml = artWrongList.length ? `
      <div class="section-title" style="margin-top:20px;">À revoir</div>
      <div class="art-review">
        ${artWrongList.map(w => `<div class="art-review-row"><strong>${escapeHtml(w.phrase)}</strong><span>${escapeHtml(w.why)}</span></div>`).join('')}
      </div>` : '';
    const splitHtml = (artGenreErrors || artNErrors) ? `<p class="art-split">Erreurs de genre : <strong>${artGenreErrors}</strong> · erreurs de n : <strong>${artNErrors}</strong></p>` : '';
    container.innerHTML = `
      <div class="end-screen">
        <div class="num">${artScore}/${artTotal}</div>
        <p>bonnes réponses en ${rawSecs}s (+${penalty}s de pénalité) = <strong>${finalScore}s</strong></p>
        <p style="color:var(--success); font-weight:600;">${isRecord ? 'Nouveau record !' : `Record : ${gameRecords.article}s`}</p>
        ${splitHtml}
        ${reviewHtml}
        <div class="cta-row" style="justify-content:center;">
          <button class="btn btn-primary" onclick="switchView('home')">Accueil</button>
          <button class="btn btn-secondary" onclick="startArticleGame()">Rejouer</button>
        </div>
      </div>`;
    feedbackSessionEnd(Math.round(artScore / artTotal * 100));
    return;
  }
  const withKinds = v => LetzGenre.kindsFor(v).length > 0;
  const seenPool = getUnlockedVocab().filter(withKinds);
  const pool = seenPool.length >= 10 ? seenPool : VOCAB.filter(withKinds);
  const item = pool[Math.floor(Math.random()*pool.length)];
  artCurrent = genreQuestionForItem(item);
  container.innerHTML = `
    <div class="session-card">
      <div class="game-header" style="width:100%;"><span>${artIndex+1}/${artTotal}</span><span class="streak">${artScore} justes · <span id="art-timer">${Math.floor(artElapsedMs()/1000)}s</span></span></div>
      ${genreQuestionHTML(artCurrent, 'answerArticleChoice')}
      <div class="feedback genre-feedback" id="art-feedback" aria-live="polite"></div>
      <div class="continue-wrap" id="continue-wrap-art"></div>
      <div class="hint">Le chrono s'arrête pendant que tu lis la correction.</div>
    </div>`;
}

function answerArticleChoice(btn, index){
  const q = artCurrent;
  if(!q || btn.disabled) return;
  const chosen = q.options[index];
  const correct = chosen === q.answer;
  const buttons = document.getElementById('article-container').querySelectorAll('.genre-opt');
  const feedback = document.getElementById('art-feedback');
  const html = genreCorrectionHTML(q, chosen, buttons, btn);
  const type = recordRuleResult(q, chosen);
  feedback.innerHTML = html;
  if(correct){
    artScore++;
    feedback.className = 'feedback genre-feedback correct';
    feedbackCorrect();
  } else {
    feedback.className = 'feedback genre-feedback wrong';
    feedbackWrong();
    if(type === 'genre') artGenreErrors++; else artNErrors++;
    artWrongList.push({ phrase: q.phrase, why: LetzGenre.why(q) });
  }
  // Pas d'avancée automatique : on lit la correction à son rythme, le chrono est figé, Entrée ou le bouton continue.
  artAnswerAt = Date.now();
  showContinueButton('continue-wrap-art', () => {
    artPausedMs += Date.now() - artAnswerAt;
    artAnswerAt = 0;
    artIndex++;
    nextArticle();
  });
}
