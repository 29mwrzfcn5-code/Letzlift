/* ============================================================
   MINI-JEU — LE BON ARTICLE (en/eng à la chaîne, chrono)
   ============================================================ */
let artIndex = 0;
let artTotal = 15;
let artScore = 0;
let artStartTime = 0;
let artTimerInterval = null;
let artCurrent = null;
let artWrongList = [];

function startArticleGame(){
  artIndex = 0;
  artScore = 0;
  artStartTime = Date.now();
  artWrongList = [];
  switchView('article');
  clearInterval(artTimerInterval);
  artTimerInterval = setInterval(()=>{
    const el = document.getElementById('art-timer');
    if(!el){ clearInterval(artTimerInterval); return; }
    el.textContent = `${Math.floor((Date.now()-artStartTime)/1000)}s`;
  }, 1000);
  nextArticle();
}

function nextArticle(){
  const container = document.getElementById('article-container');
  if(artIndex >= artTotal){
    clearInterval(artTimerInterval);
    const rawSecs = Math.floor((Date.now()-artStartTime)/1000);
    const penalty = (artTotal - artScore) * 10;
    const finalScore = rawSecs + penalty;
    const isRecord = recordGameScore('article', finalScore);
    addArcadeXP(artScore);
    markMiniGameCompleted('article');
    const reviewHtml = artWrongList.length ? `
      <div class="section-title" style="margin-top:20px;">À revoir</div>
      <div style="text-align:left; max-width:340px; margin:0 auto;">
        ${artWrongList.map(w => `<div style="font-size:13.5px; padding:6px 0; border-bottom:1px solid var(--line);">${w.right} <strong style="color:var(--accent-deep);">${w.lu}</strong> (${w.fr})</div>`).join('')}
      </div>` : '';
    container.innerHTML = `
      <div class="end-screen">
        <div class="num">${artScore}/${artTotal}</div>
        <p>bons articles en ${rawSecs}s (+${penalty}s de pénalité) = <strong>${finalScore}s</strong></p>
        <p style="color:var(--success); font-weight:600;">${isRecord ? 'Nouveau record !' : `Record : ${gameRecords.article}s`}</p>
        ${reviewHtml}
        <div class="cta-row" style="justify-content:center;">
          <button class="btn btn-primary" onclick="switchView('home')">Accueil</button>
          <button class="btn btn-secondary" onclick="startArticleGame()">Rejouer</button>
        </div>
      </div>`;
    return;
  }
  const genderPool = getUnlockedVocab().filter(v => v.g === 'f' || v.g === 'c');
  const pool = genderPool.length >= 10 ? genderPool : VOCAB.filter(v => v.g === 'f' || v.g === 'c');
  const item = pool[Math.floor(Math.random()*pool.length)];
  artCurrent = item;
  container.innerHTML = `
    <div class="session-card">
      <div class="game-header" style="width:100%;"><span>${artIndex+1}/${artTotal}</span><span class="streak">${artScore} justes · <span id="art-timer">0s</span></span></div>
      <div class="tf-word">${item.lu}</div>
      <div class="tf-translation">${item.fr} — e, en ou eng ?</div>
      <div class="tf-btn-row">
        <button class="tf-btn tf-true" onclick="answerArticle('e')">e</button>
        <button class="tf-btn tf-true" onclick="answerArticle('en')">en</button>
        <button class="tf-btn tf-false" onclick="answerArticle('eng')">eng</button>
      </div>
      <div class="feedback" id="art-feedback"></div>
    </div>`;
}

function answerArticle(chosen){
  const rightAnswer = indefiniteArticleFor(artCurrent);
  const correct = chosen === rightAnswer;
  const feedback = document.getElementById('art-feedback');
  if(correct){
    artScore++;
    feedback.className = 'feedback correct';
    feedback.textContent = 'Richteg.';
  } else {
    feedback.className = 'feedback wrong';
    feedback.textContent = `Non : ${rightAnswer} ${artCurrent.lu}.`;
    artWrongList.push({ lu: artCurrent.lu, fr: artCurrent.fr, right: rightAnswer });
  }
  setTimeout(()=>{ artIndex++; nextArticle(); }, correct ? 450 : 1400);
}
