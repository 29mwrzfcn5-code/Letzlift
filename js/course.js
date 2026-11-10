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
  if(!hasEntitlement('course')){
    document.getElementById('course-root').innerHTML = `<button class="back-link" onclick="switchView('home')">&larr; Accueil</button>
      <h2 class="course-h">📚 Cours de luxembourgeois</h2>
      <p class="course-sub">Ce module n'est pas activé sur ton compte.</p>`;
    return;
  }
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
      <button class="btn btn-primary" onclick="courseStartSession(null)">Révision générale${totals.due ? ` (${totals.due} à revoir)` : ''}</button>
      <button class="btn btn-secondary" onclick="courseStartFree(null)">Entraînement libre</button>
      <button class="btn btn-secondary" onclick="courseStartNRule()">Exercices sur la règle du n</button>
    </div>
    <p class="course-note">Révision générale : toutes les leçons, d'abord ce qui est à revoir, puis la suite dans l'ordre du cours. Pour travailler une seule leçon, ouvre-la ci-dessous.</p>
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
      <button class="btn btn-secondary" onclick="courseStartFree(['${id}'])">Entraînement libre</button>
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
function courseLessonArg(lessonIds){ return lessonIds ? `['${lessonIds.join("','")}']` : 'null'; }

// Révision : cartes dues d'abord, puis les nouvelles dans l'ordre du professeur (leçon après leçon), avec quelques
// répliques de mini-dialogue glissées au hasard quand les leçons choisies en contiennent.
function courseStartSession(lessonIds){
  const course = getCourse();
  const cards = LetzCourse.buildQueue(course, courseProgress, { lessons:lessonIds || undefined, now:Date.now(), size:20, newLimit:10 });
  const root = document.getElementById('course-root');
  if(!cards.length){
    root.innerHTML = `<button class="back-link" onclick="renderCourse()">&larr; Les leçons</button>
      <h2 class="course-h">Tout est à jour</h2>
      <p class="course-sub">Aucune carte n'est à revoir pour le moment${lessonIds ? ' dans cette leçon' : ''}. Tu peux quand même t'entraîner : l'entraînement libre tire des cartes déjà vues, sans changer ton calendrier de révision.</p>
      <div class="cta-row"><button class="btn btn-primary" onclick="courseStartFree(${courseLessonArg(lessonIds)})">Entraînement libre</button>
      <button class="btn btn-secondary" onclick="courseStartNRule(${lessonIds ? `['${lessonIds.join("','")}']` : ''})">Règle du n</button></div>`;
    return;
  }
  const queue = cards.slice();
  const replies = LetzCourseEx.dialogueQuestions(course, lessonIds, Math.random);
  if(queue.length >= 6){
    replies.sort(() => Math.random() - 0.5).slice(0, 3).forEach(r => {
      queue.splice(1 + Math.floor(Math.random() * queue.length), 0, { extra:r });
    });
  }
  courseBeginSession(queue, lessonIds, 'review');
}

// Entraînement libre : cartes déjà vues tirées au hasard (toutes les cartes si rien n'est encore vu). Le calendrier de
// révision n'est pas modifié : on ne note pas les réponses.
function courseStartFree(lessonIds){
  const course = getCourse();
  const allowed = lessonIds ? new Set(lessonIds) : null;
  let pool = course.cards.filter(c => (!allowed || allowed.has(c.lessonId)) && courseProgress[c.id]);
  if(pool.length < 8) pool = course.cards.filter(c => !allowed || allowed.has(c.lessonId));
  const queue = pool.slice().sort(() => Math.random() - 0.5).slice(0, 20);
  const replies = LetzCourseEx.dialogueQuestions(course, lessonIds, Math.random);
  replies.sort(() => Math.random() - 0.5).slice(0, 3).forEach(r => queue.splice(1 + Math.floor(Math.random() * queue.length), 0, { extra:r }));
  courseBeginSession(queue, lessonIds, 'free');
}

function courseBeginSession(queue, lessonIds, kind){
  courseSession = { queue, index:0, answered:0, correct:0, misses:[], lessonIds, kind, locked:false, total:queue.length, startedAt:Date.now(),
                    lastType:null, streak:0, bestStreak:0, seenIds:new Set(), picked:[] };
  courseShowCard();
}

const COURSE_TYPE_LABELS = { recog:'Sens du mot', reverse:'Sens inverse', typed:'À écrire', cloze:'Phrase à trous', order:'Mots dans l\'ordre', reply:'Mini-dialogue' };

function courseShowCard(){
  const S = courseSession;
  const root = document.getElementById('course-root');
  if(S.index >= S.queue.length) return courseSessionEnd();
  const item = S.queue[S.index];
  const course = getCourse();
  const card = item.extra ? null : item;
  const ex = item.extra ? item.extra : LetzCourseEx.exerciseFor(card, course, courseProgress, Math.random, S.lastType);
  S.card = card; S.ex = ex; S.locked = false; S.picked = []; S.lastType = ex.type;
  const prompt = ex.prompt;
  const pct = Math.round(100 * S.index / Math.max(1, S.queue.length));
  const entry = card && courseProgress[card.id];
  const tag = !card ? 'Dialogue' : S.kind === 'free' ? 'Entraînement' : !entry ? 'Nouveau' : 'À revoir';
  let answerHtml;
  if(ex.type === 'typed'){
    answerHtml = `<div class="answer-row"><input type="text" class="answer-input" id="course-input" placeholder="ta réponse" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="go">
      <button class="btn btn-primary" onclick="courseSubmitTyped()">Valider</button></div>`;
  } else if(ex.type === 'order'){
    answerHtml = `<div class="course-order-line" id="course-order-line" aria-live="polite"><span class="course-order-empty">Touche les mots dans l'ordre</span></div>
      <div class="course-choices" id="course-tokens">${ex.tokens.map((t, i) => `<button class="btn btn-secondary course-choice" onclick="courseOrderPick(${i})">${escapeHtml(t)}</button>`).join('')}</div>
      <div class="cta-row"><button class="btn btn-secondary" id="course-order-undo" onclick="courseOrderUndo()" disabled>Annuler le dernier</button>
      <button class="btn btn-primary" id="course-order-submit" onclick="courseOrderSubmit()" disabled>Valider</button></div>`;
  } else {
    answerHtml = `<div class="course-choices">${ex.options.map((o, i) => `<button class="btn btn-secondary course-choice" onclick="courseChoose(${i})">${escapeHtml(o)}</button>`).join('')}</div>`;
  }
  const textHtml = prompt.text ? `<div class="course-q-text">${escapeHtml(prompt.text).replace(/___/g, '<span class="blank">?</span>')}</div>` : '';
  root.innerHTML = `
    <button class="back-link" onclick="courseQuit()">&larr; Arrêter</button>
    <div class="session-progress"><div class="session-progress-bar" style="width:${pct}%"></div></div>
    <div class="course-counter"><span>Question <b>${S.index + 1}</b> / ${S.queue.length}</span><span class="course-tag-pill">${escapeHtml(tag)}</span><span>${S.correct} ✓${S.streak >= 3 ? ` · série de ${S.streak}` : ''}</span></div>
    <div class="course-q">
      <div class="course-q-label">${escapeHtml(prompt.label)} <span class="course-type-tag">${escapeHtml(COURSE_TYPE_LABELS[ex.type] || '')}</span></div>
      ${prompt.swatch ? `<i class="course-swatch course-swatch-big" style="background:#${escapeHtml(prompt.swatch)}"></i>` : ''}
      ${textHtml}
      ${prompt.hint ? `<div class="course-q-hint">${escapeHtml(prompt.hint)}</div>` : ''}
    </div>
    ${answerHtml}
    <div class="feedback" id="course-feedback" aria-live="polite"></div>
    <div id="course-next"></div>`;
  const input = document.getElementById('course-input');
  if(input){
    // preventDefault : sans lui, le même Entrée active aussitôt le bouton « Suivant » qui vient de prendre le focus.
    input.addEventListener('keydown', e => { if(e.key === 'Enter'){ e.preventDefault(); courseSubmitTyped(); } });
    input.focus();
  }
}

function courseQuit(){ if(courseSession && courseSession.answered) return courseSessionEnd(); courseSession = null; renderCourse(); }

function courseSubmitTyped(){
  const S = courseSession;
  if(!S || S.locked || S.ex.type !== 'typed') return;
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

// Choix multiple : sens du mot, sens inverse, phrase à trous, mini-dialogue.
function courseChoose(i){
  const S = courseSession;
  if(!S || S.locked) return;
  const ex = S.ex;
  const ok = ex.options[i] === ex.answer;
  document.querySelectorAll('#course-root .course-choice').forEach((b, j) => {
    b.disabled = true;
    if(ex.options[j] === ex.answer) b.classList.add('good');
    else if(j === i) b.classList.add('bad');
  });
  let extra = '';
  if(ex.type === 'cloze'){
    extra = ex.why ? `<div class="course-detail">${escapeHtml(ex.why)}</div>` : '';
  }
  courseFinishAnswer(ok, ok ? 'correct' : 'wrong', ok ? '✓ Juste' : `Réponse : ${ex.full}`, extra);
}

// Mots à remettre dans l'ordre.
function courseOrderRefresh(){
  const S = courseSession;
  const line = document.getElementById('course-order-line');
  line.innerHTML = S.picked.length ? S.picked.map(i => `<span class="course-chip">${escapeHtml(S.ex.tokens[i])}</span>`).join(' ') : `<span class="course-order-empty">Touche les mots dans l'ordre</span>`;
  const undo = document.getElementById('course-order-undo'), submit = document.getElementById('course-order-submit');
  undo.disabled = S.picked.length === 0;
  submit.disabled = S.picked.length !== S.ex.tokens.length;
}
function courseOrderPick(i){
  const S = courseSession;
  if(!S || S.locked || S.picked.indexOf(i) !== -1) return;
  S.picked.push(i);
  const btns = document.querySelectorAll('#course-tokens .course-choice');
  btns[i].disabled = true;
  courseOrderRefresh();
  if(S.picked.length === S.ex.tokens.length) document.getElementById('course-order-submit').focus();
}
function courseOrderUndo(){
  const S = courseSession;
  if(!S || S.locked || !S.picked.length) return;
  const i = S.picked.pop();
  document.querySelectorAll('#course-tokens .course-choice')[i].disabled = false;
  courseOrderRefresh();
}
function courseOrderSubmit(){
  const S = courseSession;
  if(!S || S.locked || S.picked.length !== S.ex.tokens.length) return;
  const status = LetzCourseEx.gradeOrder(S.ex, S.picked.map(i => S.ex.tokens[i]));
  document.querySelectorAll('#course-tokens .course-choice').forEach(b => { b.disabled = true; });
  document.getElementById('course-order-undo').disabled = true;
  document.getElementById('course-order-submit').disabled = true;
  courseFinishAnswer(status === 'correct', status, status === 'correct' ? '✓ Juste' : `Phrase correcte : ${S.ex.full}`);
}

function courseFinishAnswer(correct, status, msg, extraHtml){
  const S = courseSession;
  S.locked = true;
  const card = S.card;
  // Révision espacée : seulement pour les cartes, et pas en entraînement libre.
  if(card && S.kind !== 'free'){
    const res = LetzCourse.answerCard(courseProgress, card.id, correct, Date.now());
    saveCourseProgress();
    if(res.requeueGap){
      const [lo, hi] = res.requeueGap;
      const at = Math.min(S.queue.length, S.index + 1 + lo + Math.floor(Math.random() * Math.max(1, hi - lo + 1)));
      S.queue.splice(at, 0, card);
    }
  }
  const key = card ? card.id : 'extra:' + S.index;
  if(!S.seenIds.has(key)){
    S.seenIds.add(key);
    S.answered++;
    if(correct) S.correct++; else if(card) S.misses.push(card);
  }
  S.streak = correct ? S.streak + 1 : 0;
  S.bestStreak = Math.max(S.bestStreak, S.streak);
  S.total = Math.max(S.total, S.queue.length);
  const detail = [];
  if(card && (card.kind === 'word' || card.kind === 'phrase')) detail.push(card.fr);
  if(card && card.pron) detail.push('Prononciation : ' + card.pron);
  if(card && card.note) detail.push(card.note);
  const fb = document.getElementById('course-feedback');
  fb.className = 'feedback ' + status;
  fb.innerHTML = `${escapeHtml(msg)}${extraHtml || ''}${detail.length ? `<div class="course-detail">${detail.map(escapeHtml).join('<br>')}</div>` : ''}`;
  if(typeof feedbackCorrect === 'function'){ if(correct) feedbackCorrect(); else feedbackWrong(); }
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
  if(typeof telemetrySessionEnd === 'function' && S.answered > 0) telemetrySessionEnd('course', S.startedAt, S.answered, S.correct, S.misses.map(c => c.id));
  const root = document.getElementById('course-root');
  const course = getCourse();
  const pct = S.answered ? Math.round(100 * S.correct / S.answered) : 0;
  const stats = LetzCourse.lessonStats(course, courseProgress, Date.now());
  const ids = S.lessonIds || course.lessons.map(L => L.id);
  const lessonRows = ids.map(id => {
    const L = course.lessonById[id], st = stats[id];
    return `<li><span class="course-lu">Leçon ${L.n}</span><span class="course-fr">${st.seen} / ${st.total} cartes vues · ${st.mastered} acquises${st.due ? ` · ${st.due} à revoir` : ''}</span></li>`;
  }).join('');
  if(typeof feedbackSessionEnd === 'function') feedbackSessionEnd(S.answered ? pct : null);
  root.innerHTML = `
    <h2 class="course-h">Session terminée</h2>
    <p class="course-sub">${S.correct} / ${S.answered} réussies (${pct} %)${S.bestStreak >= 3 ? ` · meilleure série : ${S.bestStreak}` : ''}.${S.kind === 'free' ? ' Entraînement libre : ton calendrier de révision n\'a pas changé.' : ''}</p>
    ${S.misses.length ? `<div class="course-sec"><h3 class="course-sec-title">À retravailler</h3><ul class="course-words">${S.misses.map(c => `<li><span class="course-lu">${escapeHtml(c.kind === 'letter' ? c.letter + ' → ' + c.name : c.kind === 'number' ? c.n + ' → ' + c.lu : c.answer)}</span>${c.fr ? `<span class="course-fr">${escapeHtml(c.fr)}</span>` : ''}</li>`).join('')}</ul></div>` : ''}
    <div class="course-sec"><h3 class="course-sec-title">Ta progression</h3><ul class="course-words">${lessonRows}</ul></div>
    <div class="cta-row">
      <button class="btn btn-primary" onclick="courseStartSession(${courseLessonArg(S.lessonIds)})">Encore une série</button>
      <button class="btn btn-secondary" onclick="courseStartFree(${courseLessonArg(S.lessonIds)})">Entraînement libre</button>
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
