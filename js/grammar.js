/* ============================================================
   RENDU — GRAMMAIRE
   ============================================================ */
function renderGrammarList(){
  const grid = document.getElementById('lesson-grid');
  grid.innerHTML = GRAMMAR.map(g => `
    <button class="lesson-card-v2" onclick="openLesson('${g.id}')">
      <div class="lesson-eyebrow-v2">${g.eyebrow}</div>
      <div class="lesson-title-v2">${g.title}</div>
      <div class="lesson-summary-v2">${g.summary}</div>
      ${grammarProgress[g.id] ? '<div class="lesson-check-v2">✓</div>' : ''}
    </button>
  `).join('');
}

function openLesson(id){
  const lesson = GRAMMAR.find(g => g.id === id);
  const container = document.getElementById('grammar-detail-container');
  container.innerHTML = `
    <div class="lesson-detail">
      <div class="eyebrow" style="color:var(--muted); font-family:'IBM Plex Mono',monospace; font-size:12px; text-transform:uppercase; letter-spacing:0.05em;">${lesson.eyebrow}</div>
      <h2 style="margin:6px 0 14px;">${lesson.title}</h2>
      <div class="rule-block">${lesson.rule}</div>
      <div class="section-title" style="margin-top:24px;">Exercices</div>
      <div id="exo-container"></div>
      <div class="cta-row">
        <button class="btn btn-secondary" onclick="renderExercises('${lesson.id}')">Refaire les exercices</button>
        <button class="btn btn-primary" onclick="markLessonDone('${lesson.id}')">Marquer comme terminé</button>
      </div>
    </div>
  `;
  renderExercises(id);
  switchView('grammar-detail');
}

function renderExercises(id){
  const lesson = GRAMMAR.find(g => g.id === id);
  const exoContainer = document.getElementById('exo-container');
  exoContainer.innerHTML = '';
  const shuffledExercises = [...lesson.exercises].sort(()=>Math.random()-0.5);
  shuffledExercises.forEach((exo, i) => {
    const exoId = `${lesson.id}-exo-${i}`;
    const shuffledOptions = [...exo.options].sort(()=>Math.random()-0.5);
    const optionsHtml = shuffledOptions.map(opt => `<button class="opt-btn" onclick="checkExo('${exoId}', this, '${opt.replace(/'/g,"\\'")}', '${exo.answer.replace(/'/g,"\\'")}')">${opt}</button>`).join('');
    const div = document.createElement('div');
    div.className = 'exo';
    div.innerHTML = `<div class="exo-sentence">${exo.q}</div><div class="options" id="${exoId}">${optionsHtml}</div>`;
    exoContainer.appendChild(div);
  });
}

function checkExo(exoId, btn, chosen, answer){
  const wrapper = document.getElementById(exoId);
  const buttons = wrapper.querySelectorAll('.opt-btn');
  buttons.forEach(b => b.disabled = true);
  if(chosen === answer){
    btn.classList.add('correct');
    addEnduranceXP(XP_VALUES.grammar);
  } else {
    btn.classList.add('wrong');
    buttons.forEach(b => { if(b.textContent === answer) b.classList.add('correct'); });
  }
}

function markLessonDone(id){
  grammarProgress[id] = true;
  saveGrammarProgress();
  switchView('grammar-list');
}
