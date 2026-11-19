/* ============================================================
   RENDU — GRAMMAIRE
   ============================================================ */
const GRAMMAR_CAT = { 'Conjugaison':'#2E6DB4', 'Articles':'#3F7A38', 'Syntaxe':'#8A5A9E', 'Usage':'#C98A12', 'Cas':'#B5382A', 'Pronoms':'#17808A', 'Négation':'#D9342B' };
function grammarCatColor(e){ return GRAMMAR_CAT[e] || '#D9342B'; }
const GRAMMAR_BACK = '<svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true"><path d="M12 4 L6 10 L12 16" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function renderGrammarList(){
  const grid = document.getElementById('lesson-grid');
  const sub = document.getElementById('grammar-sub');
  const done = GRAMMAR.filter(g => grammarProgress[g.id]).length;
  if(sub) sub.textContent = `${GRAMMAR.length} fiches · ${done} terminée${done > 1 ? 's' : ''}`;
  grid.innerHTML = GRAMMAR.map(g => `
    <button class="gcard${grammarProgress[g.id] ? ' done' : ''}" style="--cat:${grammarCatColor(g.eyebrow)}" onclick="openLesson('${g.id}')">
      <span class="gcard-t"><span class="gcard-eyebrow">${g.eyebrow}</span><b>${g.title}</b><small>${g.summary}</small></span>
      ${grammarProgress[g.id] ? '<span class="gcard-check" aria-label="Terminée">✓</span>' : '<i class="chev" aria-hidden="true"></i>'}
    </button>
  `).join('');
}

function openLesson(id){
  const lesson = GRAMMAR.find(g => g.id === id);
  const n = GRAMMAR.indexOf(lesson) + 1;
  const container = document.getElementById('grammar-detail-container');
  container.innerHTML = `
    <div class="screen-hdr">
      <button class="hdr-back" onclick="switchView('grammar-list')" aria-label="Toutes les fiches">${GRAMMAR_BACK}</button>
      <div class="screen-hdr-t"><span class="sub" style="margin:0 0 2px;">Fiche ${n} sur ${GRAMMAR.length}</span><h2 class="d">${lesson.title}</h2></div>
    </div>
    <div class="lesson-detail" style="--cat:${grammarCatColor(lesson.eyebrow)}">
      <span class="gcard-eyebrow gfiche-tag">${lesson.eyebrow}</span>
      <div class="rule-block">${lesson.rule}</div>
      <div class="set-sect">Exercices</div>
      <div id="exo-container"></div>
      <div class="sess-end-cta">
        <button class="btn-big" onclick="markLessonDone('${lesson.id}')">Marquer comme terminé</button>
        <button class="btn-soft" onclick="renderExercises('${lesson.id}')">Refaire les exercices</button>
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
