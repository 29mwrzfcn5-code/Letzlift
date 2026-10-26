/* ============================================================
   MODULE COURS — révision du cours de luxembourgeois de l'ACD (A1.1 – A1.2)
   Écran indépendant du vocabulaire : ses propres cartes (data/course/), sa propre progression
   (courseProgress, clé letzlift:course-progress) et aucun effet sur les XP, séries ou statistiques
   du vocabulaire. La logique (cartes, notation, file de révision, règle du n) est dans
   js/lib/course.js ; ce fichier ne fait que l'affichage.
   Tout texte affiché passe par escapeHtml(), y compris les données des leçons.
   ============================================================ */
let courseModel = null;
let courseUI = { screen:'list', lessonId:null };
let courseSession = null;   // { queue, index, answered, correct, misses, mode, card, locked, kind }
let courseNRule = null;     // { questions, index, correct, locked }

function getCourse(){
  if(!courseModel) courseModel = LetzCourse.buildCourse(COURSE_LESSONS);
  return courseModel;
}

function courseDate(iso){
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('fr-LU', { day:'numeric', month:'long', year:'numeric' });
}

// Balises des fiches : {m|texte} masculin, {f|…} féminin, {n|…} neutre, {r|…} irrégulier,
// {g|…} régulier, {u|…} souligné, {s|…} lettre barrée. Le texte est échappé AVANT l'analyse.
function courseMarkup(text){
  return escapeHtml(text).replace(/\{([a-z]+)\|([^{}]*)\}/g, (_, flags, inner) =>
    `<span class="${flags.split('').map(f => 'cm-' + f).join(' ')}">${inner}</span>`);
}

function courseArticleHtml(card){
  // L'article (en/e/eng) prend la couleur du genre ; le nom reste neutre.
  if(card.g === 'm' || card.g === 'f' || card.g === 'n'){
    const parts = card.answer.split(' ');
    const art = parts.shift();
    return `<span class="cm-${card.g}">${escapeHtml(art)}</span> ${escapeHtml(parts.join(' '))}`;
  }
  return escapeHtml(card.lu);
}

// ---------- liste des leçons ----------
function renderCourse(){
  courseUI = { screen:'list', lessonId:null };
  courseSession = null; courseNRule = null;
  const course = getCourse();
  const stats = LetzCourse.lessonStats(course, courseProgress, Date.now());
  const totals = Object.values(stats).reduce((t, s) => ({ total:t.total + s.total, seen:t.seen + s.seen, mastered:t.mastered + s.mastered, due:t.due + s.due }), { total:0, seen:0, mastered:0, due:0 });
  const pct = totals.total ? Math.round(100 * totals.mastered / totals.total) : 0;
  const root = document.getElementById('course-root');
  root.innerHTML = `
    <button class="back-link" onclick="switchView('home')">&larr; Accueil</button>
    <h2 class="course-h">📚 Cours de luxembourgeois</h2>
    <p class="course-sub">Révisions du cours de l'ACD (A1.1 – A1.2). Écrit seulement : l'oral se travaille en classe.</p>
    <div class="course-overview">
      <div><strong>${totals.due}</strong> à revoir</div>
      <div><strong>${totals.seen}</strong> / ${totals.total} vues</div>
      <div><strong>${pct} %</strong> acquises</div>
    </div>
    <div class="cta-row">
      <button class="btn btn-primary" onclick="courseStartSession(null)">${totals.due ? 'Réviser ce qui est dû' : 'Réviser'}</button>
      <button class="btn btn-secondary" onclick="courseStartNRule()">Exercices sur la règle du n</button>
    </div>
    <div class="course-lessons">
      ${course.lessons.map(L => {
        const s = stats[L.id];
        const p = s.total ? Math.round(100 * s.mastered / s.total) : 0;
        return `<button class="course-lesson" onclick="courseOpenLesson('${L.id}')">
          <span class="course-lesson-n">${L.n}</span>
          <span class="course-lesson-body">
            <span class="course-lesson-title">${escapeHtml(L.title)}</span>
            <span class="course-lesson-meta">${escapeHtml(courseDate(L.date))} · ${s.seen}/${s.total} vues${s.due ? ` · <b>${s.due} à revoir</b>` : ''}</span>
            <span class="course-lesson-bar"><span style="width:${p}%"></span></span>
          </span>
        </button>`;
      }).join('')}
    </div>
    <p class="course-foot">Les traductions françaises sont des propositions : signale-moi toute erreur. Voir docs/course/VALIDATION.md.</p>`;
}

// ---------- fiche d'une leçon ----------
function courseOpenLesson(id){
  const course = getCourse();
  const L = course.lessonById[id];
  if(!L) return renderCourse();
  courseUI = { screen:'lesson', lessonId:id };
  const stats = LetzCourse.lessonStats(course, courseProgress, Date.now())[id];
  const root = document.getElementById('course-root');
  root.innerHTML = `
    <button class="back-link" onclick="renderCourse()">&larr; Les leçons</button>
    <h2 class="course-h">Leçon ${L.n} · ${escapeHtml(L.title)}</h2>
    <p class="course-sub">${escapeHtml(courseDate(L.date))} — ${escapeHtml(L.summary)}</p>
    <div class="cta-row">
      <button class="btn btn-primary" onclick="courseStartSession(['${id}'])">Réviser cette leçon (${stats.total} cartes)</button>
      <button class="btn btn-secondary" onclick="courseStartNRule(['${id}'])">Règle du n</button>
    </div>
    ${L.sections.map(sec => courseSectionHtml(L, sec)).join('')}
    ${courseWordsHtml(L)}
    ${courseWordsPhrasesHtml(L)}`;
  window.scrollTo(0, 0);
}

function courseSectionHtml(L, sec){
  const title = `<h3 class="course-sec-title">${courseMarkup(sec.title || '')}</h3>`;
  const note = sec.note ? `<p class="course-note">${courseMarkup(sec.note)}</p>` : '';
  let body = '';
  switch(sec.type){
    case 'letters':
      body = `<div class="course-grid">${L.letters.map(l => `<div class="course-tile"><b>${escapeHtml(l.letter)}</b><span>${escapeHtml(l.name)}</span></div>`).join('')}</div>`;
      break;
    case 'numbers':
      body = `<div class="course-grid">${L.numbers.map(x => `<div class="course-tile"><b>${x.n}</b><span>${escapeHtml(x.lu)}</span></div>`).join('')}</div>`;
      break;
    case 'colors':
      body = `<div class="course-grid">${L.colors.map(c => `<div class="course-tile"><i class="course-swatch" style="background:#${escapeHtml(c.hex)}"></i><b>${escapeHtml(c.lu)}</b><span>${escapeHtml(c.fr)}</span></div>`).join('')}</div>`;
      break;
    case 'pairs':
      body = `<div class="course-pairs">${L.pairs.map(p => `<div><b>${escapeHtml(p.a)}</b> ↔ <b>${escapeHtml(p.b)}</b><span>${escapeHtml(p.frA)} / ${escapeHtml(p.frB)}</span></div>`).join('')}</div>`;
      break;
    case 'table':
      body = `<div class="course-scroll"><table class="course-table"><thead><tr>${(sec.head || []).map(h => `<th>${courseMarkup(h)}</th>`).join('')}</tr></thead><tbody>${(sec.rows || []).map(r => `<tr>${r.map(c => `<td>${courseMarkup(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
      break;
    case 'conj':
      body = `<div class="course-scroll"><table class="course-table"><tbody>${(sec.rows || []).map(r => `<tr>${r.map(c => `<td>${courseMarkup(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` +
        `<ul class="course-examples">${(sec.examples || []).map(e => `<li>${courseMarkup(e)}</li>`).join('')}</ul>`;
      break;
    case 'rule':
      body = `<p class="course-rule">${courseMarkup(sec.body || '')}</p><ul class="course-examples">${(sec.examples || []).map(e => `<li>${courseMarkup(e)}</li>`).join('')}</ul>`;
      break;
    case 'dialogue':
      body = `<div class="course-dialogue">${(sec.lines || []).map(l => `<p><b>${escapeHtml(l[0])}</b> ${courseMarkup(l[1])}</p>`).join('')}</div>`;
      break;
  }
  return `<section class="course-sec">${title}${note}${body}</section>`;
}

function courseWordsHtml(L){
  if(!L.words.length) return '';
  const cards = getCourse().cards.filter(c => c.lessonId === L.id && c.kind === 'word');
  const byCat = {};
  cards.forEach(c => { (byCat[c.cat || 'Autres'] = byCat[c.cat || 'Autres'] || []).push(c); });
  return `<details class="course-sec" open><summary class="course-sec-title">Vocabulaire (${cards.length})</summary>
    ${Object.keys(byCat).map(cat => `<div class="course-cat">${escapeHtml(cat)}</div>
      <ul class="course-words">${byCat[cat].map(c => `<li><span class="course-lu">${courseArticleHtml(c)}</span>${c.pron ? ` <span class="course-pron">[${escapeHtml(c.pron)}]</span>` : ''}<span class="course-fr">${escapeHtml(c.fr)}</span>${c.note ? `<span class="course-note-inline">${escapeHtml(c.note)}</span>` : ''}</li>`).join('')}</ul>`).join('')}
  </details>`;
}

function courseWordsPhrasesHtml(L){
  if(!L.phrases.length) return '';
  return `<details class="course-sec"><summary class="course-sec-title">Phrases (${L.phrases.length})</summary>
    <ul class="course-words">${L.phrases.map(p => `<li><span class="course-lu">${escapeHtml(p.lu)}</span>${p.ctx ? ` <span class="course-tag">${escapeHtml(p.ctx)}</span>` : ''}<span class="course-fr">${escapeHtml(p.fr)}</span>${p.note ? `<span class="course-note-inline">${escapeHtml(p.note)}</span>` : ''}</li>`).join('')}</ul>
  </details>`;
}

// ---------- session de révision ----------
function courseStartSession(lessonIds){
  const course = getCourse();
  const queue = LetzCourse.buildQueue(course, courseProgress, { lessons:lessonIds || undefined, now:Date.now(), size:20, newLimit:10 });
  const root = document.getElementById('course-root');
  if(!queue.length){
    root.innerHTML = `<button class="back-link" onclick="renderCourse()">&larr; Les leçons</button>
      <h2 class="course-h">Rien à réviser</h2>
      <p class="course-sub">Toutes les cartes de cette sélection sont à jour. Reviens plus tard, ou fais les exercices sur la règle du n.</p>
      <div class="cta-row"><button class="btn btn-secondary" onclick="courseStartNRule(${lessonIds ? `['${lessonIds.join("','")}']` : ''})">Règle du n</button></div>`;
    return;
  }
  courseSession = { queue, index:0, answered:0, correct:0, misses:[], lessonIds, locked:false, total:queue.length };
  courseShowCard();
}

function courseShowCard(){
  const S = courseSession;
  const root = document.getElementById('course-root');
  if(S.index >= S.queue.length) return courseSessionEnd();
  const card = S.queue[S.index];
  const entry = courseProgress[card.id];
  const mode = (entry && entry.box >= 2) || card.kind === 'pair' ? 'prod' : 'recog';
  const prompt = LetzCourse.promptFor(card, mode);
  S.card = card; S.mode = mode; S.locked = false; S.prompt = prompt;
  const pct = Math.round(100 * S.answered / S.total);
  let answerHtml;
  if(mode === 'recog'){
    S.options = LetzCourse.choicesFor(card, getCourse(), Math.random, 4);
    answerHtml = `<div class="course-choices">${S.options.map((o, i) => `<button class="btn btn-secondary course-choice" onclick="courseChoose(${i})">${escapeHtml(o)}</button>`).join('')}</div>`;
  } else {
    answerHtml = `<div class="answer-row"><input type="text" class="answer-input" id="course-input" placeholder="ta réponse" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="go">
      <button class="btn btn-primary" onclick="courseSubmitTyped()">Valider</button></div>`;
  }
  root.innerHTML = `
    <button class="back-link" onclick="courseQuit()">&larr; Arrêter</button>
    <div class="session-progress"><div class="session-progress-bar" style="width:${pct}%"></div></div>
    <div class="course-q">
      <div class="course-q-label">${escapeHtml(prompt.label)}</div>
      ${prompt.swatch ? `<i class="course-swatch course-swatch-big" style="background:#${escapeHtml(prompt.swatch)}"></i>` : ''}
      ${prompt.text ? `<div class="course-q-text">${escapeHtml(prompt.text)}</div>` : ''}
      ${prompt.hint ? `<div class="course-q-hint">${escapeHtml(prompt.hint)}</div>` : ''}
    </div>
    ${answerHtml}
    <div class="feedback" id="course-feedback" aria-live="polite"></div>
    <div id="course-next"></div>`;
  const input = document.getElementById('course-input');
  if(input){
    input.addEventListener('keydown', e => { if(e.key === 'Enter') courseSubmitTyped(); });
    input.focus();
  }
}

function courseQuit(){ if(courseSession && courseSession.answered) return courseSessionEnd(); renderCourse(); }

function courseSubmitTyped(){
  const S = courseSession;
  if(!S || S.locked) return;
  const input = document.getElementById('course-input');
  const res = LetzCourse.gradeTyped(S.card, input.value);
  if(res.hint === 'empty') { input.focus(); return; }
  input.classList.add(res.status);
  input.readOnly = true;
  let msg;
  if(res.status === 'correct') msg = '✓ Juste';
  else if(res.status === 'almost') msg = res.hint === 'article' ? `Presque : n'oublie pas l'article. Réponse : ${S.card.answer}` : `Presque : ${S.card.answer} (accents, majuscules ou ponctuation)`;
  else msg = `Réponse : ${S.card.answer}`;
  courseFinishAnswer(res.status !== 'wrong', res.status, msg);
}

function courseChoose(i){
  const S = courseSession;
  if(!S || S.locked) return;
  const ok = S.options[i] === LetzCourse.recogAnswer(S.card);
  document.querySelectorAll('.course-choice').forEach((b, j) => {
    b.disabled = true;
    if(S.options[j] === LetzCourse.recogAnswer(S.card)) b.classList.add('good');
    else if(j === i) b.classList.add('bad');
  });
  courseFinishAnswer(ok, ok ? 'correct' : 'wrong', ok ? '✓ Juste' : `Réponse : ${LetzCourse.recogAnswer(S.card)}`);
}

function courseFinishAnswer(correct, status, msg){
  const S = courseSession;
  S.locked = true;
  const card = S.card;
  const res = LetzCourse.answerCard(courseProgress, card.id, correct, Date.now());
  saveCourseProgress();
  if(res.requeueGap){
    const [lo, hi] = res.requeueGap;
    const at = Math.min(S.queue.length, S.index + 1 + lo + Math.floor(Math.random() * Math.max(1, hi - lo + 1)));
    S.queue.splice(at, 0, card);
  }
  if(S.firstTry === undefined) S.firstTry = new Set();
  if(!S.seenIds) S.seenIds = new Set();
  if(!S.seenIds.has(card.id)){
    S.seenIds.add(card.id);
    S.answered++;
    if(correct) S.correct++; else S.misses.push(card);
  }
  S.total = Math.max(S.total, S.queue.length);
  const detail = [];
  if(card.kind === 'word' || card.kind === 'phrase') detail.push(card.fr);
  if(card.pron) detail.push('Prononciation : ' + card.pron);
  if(card.note) detail.push(card.note);
  const fb = document.getElementById('course-feedback');
  fb.className = 'feedback ' + status;
  fb.innerHTML = `${escapeHtml(msg)}${detail.length ? `<div class="course-detail">${detail.map(escapeHtml).join('<br>')}</div>` : ''}`;
  const next = document.getElementById('course-next');
  next.innerHTML = `<button class="btn btn-primary" id="course-next-btn" onclick="courseNext()">Suivant</button>`;
  const btn = document.getElementById('course-next-btn');
  if(btn) btn.focus();
}

function courseNext(){
  if(!courseSession || !courseSession.locked) return;
  courseSession.index++;
  courseShowCard();
}

function courseSessionEnd(){
  const S = courseSession;
  const root = document.getElementById('course-root');
  const pct = S.answered ? Math.round(100 * S.correct / S.answered) : 0;
  root.innerHTML = `
    <h2 class="course-h">Session terminée</h2>
    <p class="course-sub">${S.correct} / ${S.answered} réussies du premier coup (${pct} %).</p>
    ${S.misses.length ? `<div class="course-sec"><h3 class="course-sec-title">À retravailler</h3><ul class="course-words">${S.misses.map(c => `<li><span class="course-lu">${escapeHtml(c.kind === 'letter' ? c.letter + ' → ' + c.name : c.kind === 'number' ? c.n + ' → ' + c.lu : c.answer)}</span>${c.fr ? `<span class="course-fr">${escapeHtml(c.fr)}</span>` : ''}</li>`).join('')}</ul></div>` : ''}
    <div class="cta-row">
      <button class="btn btn-primary" onclick="courseStartSession(${S.lessonIds ? `['${S.lessonIds.join("','")}']` : 'null'})">Encore une série</button>
      <button class="btn btn-secondary" onclick="renderCourse()">Retour</button>
    </div>`;
  courseSession = null;
}

// ---------- exercices sur la règle du n (sans suivi de progression) ----------
function courseStartNRule(lessonIds){
  const questions = LetzCourse.nruleQuestions(getCourse(), 10, Math.random, lessonIds || undefined);
  courseNRule = { questions, index:0, correct:0, locked:false, lessonIds };
  courseShowNRule();
}

function courseShowNRule(){
  const R = courseNRule;
  const root = document.getElementById('course-root');
  if(R.index >= R.questions.length){
    root.innerHTML = `<h2 class="course-h">Règle du n</h2>
      <p class="course-sub">${R.correct} / ${R.questions.length} justes.</p>
      <p class="course-note">Rappel : le n se garde devant a, e, i, o, u, d, h, n, t, z (UNITED ZOHA). Devant toute autre lettre, il tombe.</p>
      <div class="cta-row"><button class="btn btn-primary" onclick="courseStartNRule(${R.lessonIds ? `['${R.lessonIds.join("','")}']` : ''})">Encore</button><button class="btn btn-secondary" onclick="renderCourse()">Retour</button></div>`;
    courseNRule = null;
    return;
  }
  const q = R.questions[R.index];
  R.locked = false;
  root.innerHTML = `
    <button class="back-link" onclick="renderCourse()">&larr; Arrêter</button>
    <div class="session-progress"><div class="session-progress-bar" style="width:${Math.round(100 * R.index / R.questions.length)}%"></div></div>
    <div class="course-q"><div class="course-q-label">Complète (règle du n)</div><div class="course-q-text">${escapeHtml(q.prompt)}</div></div>
    <div class="course-choices">${q.options.map((o, i) => `<button class="btn btn-secondary course-choice" onclick="courseNRuleChoose(${i})">${escapeHtml(o)}</button>`).join('')}</div>
    <div class="feedback" id="course-feedback" aria-live="polite"></div><div id="course-next"></div>`;
}

function courseNRuleChoose(i){
  const R = courseNRule;
  if(!R || R.locked) return;
  R.locked = true;
  const q = R.questions[R.index];
  const ok = q.options[i] === q.answer;
  if(ok) R.correct++;
  document.querySelectorAll('.course-choice').forEach((b, j) => {
    b.disabled = true;
    if(q.options[j] === q.answer) b.classList.add('good'); else if(j === i) b.classList.add('bad');
  });
  const fb = document.getElementById('course-feedback');
  fb.className = 'feedback ' + (ok ? 'correct' : 'wrong');
  fb.innerHTML = `${ok ? '✓ Juste' : 'Réponse : ' + escapeHtml(q.answer)}<div class="course-detail">${escapeHtml(q.explanation)}</div>`;
  document.getElementById('course-next').innerHTML = `<button class="btn btn-primary" id="course-next-btn" onclick="courseNRuleNext()">Suivant</button>`;
  document.getElementById('course-next-btn').focus();
}
function courseNRuleNext(){ if(courseNRule && courseNRule.locked){ courseNRule.index++; courseShowNRule(); } }
