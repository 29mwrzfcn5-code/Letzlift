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
    const endLine = sessionLine(Math.round(artScore / artTotal * 100), artScore);
    container.innerHTML = `
      <div class="sess sess-end">
        <div class="screen-hdr"><div class="screen-hdr-t"><h2 class="d">Partie terminée</h2></div></div>
        <div class="sess-talk">${ROUDI_SVG('sess-roudi big')}<div class="sess-bubble">${escapeHtml(endLine)}</div></div>
        <div class="result-score-card">
          <div class="result-big d">${artScore}<small>/${artTotal}</small></div>
          <div class="result-cap">en ${rawSecs} s (+${penalty} s de pénalité) = <b>${finalScore} s</b></div>
          <div class="result-record">${isRecord ? 'Nouveau record !' : `Record : ${gameRecords.article} s`}</div>
        </div>
        ${splitHtml}
        ${reviewHtml}
        <div class="sess-end-cta">
          <button class="btn-big" onclick="startArticleGame()">Rejouer</button>
          <button class="btn-soft" onclick="switchView('home')">Retour à l'accueil</button>
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
  container.innerHTML = sessionShellHTML({
    quit: 'artQuit()', pct: 100 * artIndex / artTotal,
    pill: `<span class="pill-timer" aria-label="Chrono"><span id="art-timer">${Math.floor(artElapsedMs()/1000)}s</span></span>`,
    left: `Question <b>${artIndex + 1}</b> / ${artTotal} · ${artScore} juste${artScore > 1 ? 's' : ''}`, tag: 'Genre et n',
    hint: "Le chrono s'arrête pendant la correction.",
    body: genreQuestionHTML(artCurrent, 'answerArticleChoice'),
    panelId: 'art-panel', fbId: 'art-feedback', contId: 'continue-wrap-art'
  });
}

// Croix : on quitte la partie sans score.
function artQuit(){
  clearInterval(artTimerInterval);
  switchView('home');
}

function answerArticleChoice(btn, index){
  const q = artCurrent;
  if(!q || btn.disabled) return;
  const chosen = q.options[index];
  const correct = chosen === q.answer;
  const buttons = document.getElementById('article-container').querySelectorAll('.genre-opt');
  const html = genreCorrectionHTML(q, chosen, buttons, btn);
  const type = recordRuleResult(q, chosen);
  if(correct){
    artScore++;
    feedbackCorrect();
    sessionPanel('art-panel', 'art-feedback', 'correct', 'Richteg !', html);
  } else {
    feedbackWrong();
    if(type === 'genre') artGenreErrors++; else artNErrors++;
    artWrongList.push({ phrase: q.phrase, why: LetzGenre.why(q) });
    sessionPanel('art-panel', 'art-feedback', 'wrong', 'Presque !', html);
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
