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
    document.getElementById('course-root').innerHTML = `<div class="screen-hdr"><button class="hdr-back" onclick="switchView('home')" aria-label="Retour à l'accueil"><svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true"><path d="M12 4 L6 10 L12 16" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg></button><div class="screen-hdr-t"><h2 class="d">Cours de luxembourgeois</h2><span class="sub">Ce module n'est pas activé sur ton compte.</span></div></div>`;
    return;
  }
  courseUI = { screen:'list', lessonId:null };
  courseSession = null; courseNRule = null;
  const course = getCourse();
  const stats = LetzCourse.lessonStats(course, courseProgress, Date.now());
  const totals = Object.values(stats).reduce((t, s) => ({ total:t.total + s.total, seen:t.seen + s.seen, mastered:t.mastered + s.mastered, due:t.due + s.due }), { total:0, seen:0, mastered:0, due:0 });
  const pct = totals.total ? Math.round(100 * totals.mastered / totals.total) : 0;
  const root = document.getElementById('course-root');
  const ring = (p, n) => `<span class="cring"><svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="19" fill="none" stroke="#EBD6AE" stroke-width="7"/><circle cx="24" cy="24" r="19" fill="none" stroke="#3E8E5A" stroke-width="7" stroke-linecap="round" stroke-dasharray="119.4" stroke-dashoffset="${(119.4 * (1 - p / 100)).toFixed(1)}" transform="rotate(-90 24 24)"/></svg><b>${n}</b></span>`;
  root.innerHTML = `
    <div class="screen-hdr">
      <button class="hdr-back" onclick="switchView('niveau')" aria-label="Retour à Moi"><svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true"><path d="M12 4 L6 10 L12 16" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
      <div class="screen-hdr-t"><h2 class="d">Cours de luxembourgeois</h2><span class="sub">A1.1 – A1.2 · ${course.lessons.length} leçons · ${totals.seen} / ${totals.total} cartes vues · ${pct} % acquises</span></div>
    </div>
    <div class="vhero">
      <div class="vhero-kicker">Révision générale</div>
      <div class="vhero-title d">${totals.due ? `${plural(totals.due, 'carte à revoir', 'cartes à revoir')}` : 'Tout est à jour'}</div>
      <div class="vocab-minutes-caption">Toutes les leçons : d'abord ce qui est à revoir, puis la suite dans l'ordre du cours.</div>
      <button class="btn-gold" onclick="courseStartSession(null)">Commencer</button>
    </div>
    <div class="vtile-grid">
      <button class="vtile" onclick="courseStartFree(null)"><span class="home-link-ic" style="background:var(--blue)"><svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12 H21 M15 6 L21 12 L15 18" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></span><b>Entraînement libre</b><small>cartes déjà vues, sans toucher au calendrier</small></button>
      <button class="vtile" onclick="courseStartNRule()"><span class="home-link-ic" style="background:var(--accent)"><svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 8 H18 M14 4 L18 8 L14 12 M18 16 H6 M10 12 L6 16 L10 20" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span><b>Règle du n</b><small>exercices UNITED ZOHA</small></button>
    </div>
    <div class="set-sect">Les leçons</div>
    <div class="moi-list">
      ${course.lessons.map(L => {
        const st = stats[L.id];
        const p = st.total ? Math.round(100 * st.mastered / st.total) : 0;
        return `<button class="moi-row" onclick="courseOpenLesson('${L.id}')">${ring(p, L.n)}<span class="moi-row-t"><b>${escapeHtml(L.title)}</b><small>${escapeHtml(courseDate(L.date))} · ${st.seen} / ${st.total} vues${st.due ? ` · ${st.due} à revoir` : ''}</small></span><i class="chev" aria-hidden="true"></i></button>`;
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
    <div class="screen-hdr">
      <button class="hdr-back" onclick="renderCourse()" aria-label="Retour aux leçons"><svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true"><path d="M12 4 L6 10 L12 16" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
      <div class="screen-hdr-t"><h2 class="d">Leçon ${L.n} · ${escapeHtml(L.title)}</h2><span class="sub">${escapeHtml(courseDate(L.date))} — ${escapeHtml(L.summary)}</span></div>
    </div>
    <div class="vhero">
      <div class="vhero-kicker">Réviser cette leçon</div>
      <div class="vhero-title d">${stats.total} cartes${stats.due ? `, ${stats.due} à revoir` : ''}</div>
      <div class="vocab-minutes-caption">${stats.seen} vues · ${stats.mastered} acquises</div>
      <button class="btn-gold" onclick="courseStartSession(['${id}'])">Commencer</button>
    </div>
    <div class="vtile-grid" style="margin-bottom:16px;">
      <button class="vtile" onclick="courseStartFree(['${id}'])"><b>Entraînement libre</b><small>sans toucher au calendrier</small></button>
      <button class="vtile" onclick="courseStartNRule(['${id}'])"><b>Règle du n</b><small>exercices UNITED ZOHA</small></button>
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
    <ul class="course-words">${L.phrases.map(p => `<li><span class="course-lu">${coursePhraseHtml(p.lu)}</span>${p.ctx ? ` <span class="course-tag">${escapeHtml(p.ctx)}</span>` : ''}<span class="course-fr">${escapeHtml(p.fr)}</span>${p.note ? `<span class="course-note-inline">${escapeHtml(p.note)}</span>` : ''}</li>`).join('')}</ul>
  </details>`;
}

// ---------- session de révision ----------
// Nom du cours avec son article en couleur du genre (réglage Paramètres) ; texte brut sinon.
function courseLuHtml(text, g){
  const t = String(text);
  const i = t.indexOf(' ');
  if(!genderColorsOn() || !(g === 'm' || g === 'f' || g === 'n') || i < 1) return escapeHtml(t);
  return `<span class="g-${g}">${escapeHtml(t.slice(0, i))}</span>${escapeHtml(t.slice(i))}`;
}
function courseMsgHtml(prefix, answer, g, phrase){ return `${escapeHtml(prefix)}${phrase ? coursePhraseHtml(answer) : courseLuHtml(answer, g)}`; }

// Table des noms de genre connu (mots du cours + vocabulaire à genre sûr), pour colorer les noms à l'intérieur des phrases.
let courseNounMap = null;
function courseNouns(){
  if(!courseNounMap) courseNounMap = LetzCourseEx.buildNounGenders(getCourse(), VOCAB.filter(v => LetzGenre.certainGender(v)));
  return courseNounMap;
}
// Phrase luxembourgeoise dont les noms de genre connu sont colorés (bleu masculin, rouge féminin, vert neutre).
function coursePhraseHtml(text){
  if(!genderColorsOn()) return escapeHtml(text);
  return LetzCourseEx.phraseSegments(text, courseNouns()).map(seg => seg.g ? `<span class="g-${seg.g}">${escapeHtml(seg.t)}</span>` : escapeHtml(seg.t)).join('');
}

function courseLessonArg(lessonIds){ return lessonIds ? `['${lessonIds.join("','")}']` : 'null'; }

// Révision : cartes dues d'abord, puis les nouvelles dans l'ordre du professeur (leçon après leçon), avec quelques
// répliques de mini-dialogue glissées au hasard quand les leçons choisies en contiennent.
function courseStartSession(lessonIds){
  const course = getCourse();
  const cards = LetzCourse.buildQueue(course, courseProgress, { lessons:lessonIds || undefined, now:Date.now(), size:20, newLimit:10 });
  const root = document.getElementById('course-root');
  if(!cards.length){
    root.innerHTML = `
      <div class="screen-hdr"><button class="hdr-back" onclick="renderCourse()" aria-label="Retour aux leçons"><svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true"><path d="M12 4 L6 10 L12 16" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg></button><div class="screen-hdr-t"><h2 class="d">Tout est à jour</h2></div></div>
      <div class="sess-talk">${ROUDI_SVG('sess-roudi big')}<div class="sess-bubble">Aucune carte à revoir pour le moment${lessonIds ? ' dans cette leçon' : ''}. Tu peux quand même t'entraîner : l'entraînement libre tire des cartes déjà vues, sans changer ton calendrier.</div></div>
      <div class="sess-end-cta"><button class="btn-big" onclick="courseStartFree(${courseLessonArg(lessonIds)})">Entraînement libre</button>
      <button class="btn-soft" onclick="courseStartNRule(${lessonIds ? `['${lessonIds.join("','")}']` : ''})">Règle du n</button></div>`;
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
      <div class="course-choices" id="course-tokens">${ex.tokens.map((t, i) => `<button class="btn btn-secondary course-choice" onclick="courseOrderPick(${i})">${coursePhraseHtml(t)}</button>`).join('')}</div>
      <div class="cta-row"><button class="btn btn-secondary" id="course-order-undo" onclick="courseOrderUndo()" disabled>Annuler le dernier</button>
      <button class="btn btn-primary" id="course-order-submit" onclick="courseOrderSubmit()" disabled>Valider</button></div>`;
  } else {
    answerHtml = `<div class="course-choices">${ex.options.map((o, i) => `<button class="btn btn-secondary course-choice" onclick="courseChoose(${i})">${ex.optionGenders ? courseLuHtml(o, ex.optionGenders[i]) : ex.optionsLu ? coursePhraseHtml(o) : escapeHtml(o)}</button>`).join('')}</div>`;
  }
  const blankIt = html => html.replace(/___/g, '<span class="blank">?</span>');
  const textInner = !prompt.text ? '' : ex.promptG ? courseLuHtml(prompt.text, ex.promptG)
    : ex.promptLu ? coursePhraseHtml(prompt.text)
    : ex.type === 'cloze' && !ex.hidesGender ? blankIt(coursePhraseHtml(prompt.text))
    : blankIt(escapeHtml(prompt.text));
  const textHtml = prompt.text ? `<div class="course-q-text">${textInner}</div>` : '';
  const qHtml = `
    <div class="course-q">
      <div class="course-q-label">${escapeHtml(prompt.label)} <span class="course-type-tag">${escapeHtml(COURSE_TYPE_LABELS[ex.type] || '')}</span></div>
      ${prompt.swatch ? `<i class="course-swatch course-swatch-big" style="background:#${escapeHtml(prompt.swatch)}"></i>` : ''}
      ${textHtml}
      ${prompt.hint ? `<div class="course-q-hint">${escapeHtml(prompt.hint)}</div>` : ''}
    </div>`;
  const legend = /class="g-[mfn]"/.test(textHtml + answerHtml) ? genderLegendHTML() : '';
  root.innerHTML = sessionShellHTML({
    quit: 'courseQuit()', pct, pill: sessionStreakPill(),
    left: `Question <b>${S.index + 1}</b> / ${S.queue.length} · ${S.correct} ✓${S.streak >= 3 ? ` · série de ${S.streak}` : ''}`, tag: escapeHtml(tag),
    body: qHtml + answerHtml + legend, panelId: 'course-panel', fbId: 'course-feedback', contId: 'course-next'
  });
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
  const g = S.ex.answerG, ph = S.card.kind === 'phrase';
  const show = a => ph ? coursePhraseHtml(a) : courseLuHtml(a, g);
  let msg;
  if(res.status === 'correct') msg = escapeHtml('✓ Juste');
  else if(res.status === 'almost') msg = res.hint === 'article' ? `${escapeHtml("Presque : n'oublie pas l'article. Réponse : ")}${show(S.card.answer)}` : `${escapeHtml('Presque : ')}${show(S.card.answer)}${escapeHtml(' (accents, majuscules ou ponctuation)')}`;
  else msg = `${escapeHtml('Réponse : ')}${show(S.card.answer)}`;
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
    // Phrase complète en couleurs une fois la réponse donnée (le genre n'aide plus à répondre), puis l'explication.
    extra = `<div class="course-detail">${coursePhraseHtml(ex.full)}${ex.why ? `<br>${escapeHtml(ex.why)}` : ''}</div>`;
  }
  const phrase = !!(ex.optionsLu || ex.type === 'cloze' || (S.card && S.card.kind === 'phrase'));
  courseFinishAnswer(ok, ok ? 'correct' : 'wrong', ok ? escapeHtml('✓ Juste') : courseMsgHtml('Réponse : ', ex.type === 'cloze' ? ex.answer : ex.full, ex.answerG, phrase && ex.type !== 'cloze'), extra);
}

// Mots à remettre dans l'ordre.
function courseOrderRefresh(){
  const S = courseSession;
  const line = document.getElementById('course-order-line');
  line.innerHTML = S.picked.length ? S.picked.map(i => `<span class="course-chip">${coursePhraseHtml(S.ex.tokens[i])}</span>`).join(' ') : `<span class="course-order-empty">Touche les mots dans l'ordre</span>`;
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
  courseFinishAnswer(status === 'correct', status, status === 'correct' ? escapeHtml('✓ Juste') : courseMsgHtml('Phrase correcte : ', S.ex.full, null, true));
}

// msg : HTML déjà échappé (courseMsgHtml / escapeHtml).
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
  const title = status === 'correct' ? 'Richteg !' : status === 'almost' ? 'Presque !' : 'Pas tout à fait';
  sessionPanel('course-panel', 'course-feedback', status, title, `${msg}${extraHtml || ''}${detail.length ? `<div class="course-detail">${detail.map(escapeHtml).join('<br>')}</div>` : ''}`);
  if(typeof feedbackCorrect === 'function'){ if(correct) feedbackCorrect(); else feedbackWrong(); }
  const next = document.getElementById('course-next');
  next.innerHTML = `<button class="continue-btn" id="course-next-btn" onclick="courseNext()">Continuer →</button>`;
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
  const endLine = sessionLine(S.answered ? pct : null, S.correct);
  root.innerHTML = `
    <div class="sess sess-end">
      <div class="screen-hdr"><div class="screen-hdr-t"><h2 class="d">Session terminée</h2></div></div>
      <div class="sess-talk">${ROUDI_SVG('sess-roudi big')}<div class="sess-bubble">${escapeHtml(endLine)}</div></div>
      <div class="result-score-card">
        <div class="result-big d">${S.correct}<small>/${S.answered}</small></div>
        <div class="result-cap">réussies (${pct} %)${S.bestStreak >= 3 ? ` · meilleure série : ${S.bestStreak}` : ''}</div>
        ${S.kind === 'free' ? '<div class="result-record" style="color:var(--ink-soft)">Entraînement libre : ton calendrier n\'a pas changé.</div>' : ''}
      </div>
      ${S.misses.length ? `<div class="result-review"><div class="result-review-title">À retravailler</div>${S.misses.map(c => `<div class="result-review-row"><span>${escapeHtml(c.kind === 'letter' ? c.letter + ' → ' + c.name : c.kind === 'number' ? c.n + ' → ' + c.lu : c.answer)}</span><span>${c.fr ? `<strong>${escapeHtml(c.fr)}</strong>` : ''}</span></div>`).join('')}</div>` : ''}
      <div class="result-review"><div class="result-review-title">Ta progression</div>${ids.map(id => { const L = course.lessonById[id], st = stats[id]; return `<div class="result-review-row"><span>Leçon ${L.n}</span><span>${st.seen} / ${st.total} vues · ${st.mastered} acquises${st.due ? ` · ${st.due} à revoir` : ''}</span></div>`; }).join('')}</div>
      <div class="sess-end-cta">
        <button class="btn-big" onclick="courseStartSession(${courseLessonArg(S.lessonIds)})">Encore une série</button>
        <button class="btn-soft" onclick="courseStartFree(${courseLessonArg(S.lessonIds)})">Entraînement libre</button>
        <button class="btn-soft" onclick="renderCourse()">Retour au cours</button>
      </div>
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
    const pct = R.questions.length ? Math.round(100 * R.correct / R.questions.length) : 0;
    root.innerHTML = `
      <div class="sess sess-end">
        <div class="screen-hdr"><div class="screen-hdr-t"><h2 class="d">Règle du n</h2></div></div>
        <div class="sess-talk">${ROUDI_SVG('sess-roudi big')}<div class="sess-bubble">${escapeHtml(sessionLine(pct, R.correct))}</div></div>
        <div class="result-score-card"><div class="result-big d">${R.correct}<small>/${R.questions.length}</small></div><div class="result-cap">justes (${pct} %)</div></div>
        <div class="result-review"><div class="result-review-title">Rappel</div><div class="fb-text">Le n se garde devant a, e, i, o, u, d, h, n, t, z (UNITED ZOHA). Devant toute autre lettre, il tombe.</div></div>
        <div class="sess-end-cta"><button class="btn-big" onclick="courseStartNRule(${R.lessonIds ? `['${R.lessonIds.join("','")}']` : ''})">Encore</button><button class="btn-soft" onclick="renderCourse()">Retour au cours</button></div>
      </div>`;
    if(typeof feedbackSessionEnd === 'function') feedbackSessionEnd(pct);
    courseNRule = null;
    return;
  }
  const q = R.questions[R.index];
  R.locked = false;
  root.innerHTML = sessionShellHTML({
    quit: 'renderCourse()', pct: 100 * R.index / R.questions.length, pill: sessionStreakPill(),
    left: `Question <b>${R.index + 1}</b> / ${R.questions.length} · ${R.correct} ✓`, tag: 'Règle du n',
    body: `<div class="course-q"><div class="course-q-label">Complète (règle du n)</div><div class="course-q-text">${escapeHtml(q.prompt)}</div></div>
      <div class="course-choices">${q.options.map((o, i) => `<button class="btn btn-secondary course-choice" onclick="courseNRuleChoose(${i})">${escapeHtml(o)}</button>`).join('')}</div>`,
    panelId: 'course-panel', fbId: 'course-feedback', contId: 'course-next'
  });
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
  if(typeof feedbackCorrect === 'function'){ if(ok) feedbackCorrect(); else feedbackWrong(); }
  sessionPanel('course-panel', 'course-feedback', ok ? 'correct' : 'wrong', ok ? 'Richteg !' : 'Presque !', `${ok ? '' : `Réponse : <b>${escapeHtml(q.answer)}</b>`}<div class="course-detail">${escapeHtml(q.explanation)}</div>`);
  document.getElementById('course-next').innerHTML = `<button class="continue-btn" id="course-next-btn" onclick="courseNRuleNext()">Continuer →</button>`;
  document.getElementById('course-next-btn').focus();
}
function courseNRuleNext(){ if(courseNRule && courseNRule.locked){ courseNRule.index++; courseShowNRule(); } }
