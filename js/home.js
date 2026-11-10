/* ============================================================
   ACCUEIL (v1.31.0) — billet du jour, semaine, parcours de village en village,
   et parcours d'accueil en quatre étapes.
   Dépend de js/lib/journey.js, js/lib/dates.js et des globales de l'application.
   Tout le texte dynamique passe par escapeHtml().
   ============================================================ */

const ROUDI_SVG = (cls, size) => `<svg class="${cls}" viewBox="0 0 150 150" ${size ? `width="${size}" height="${size}"` : ''} aria-hidden="true"><use href="#roudi"/></svg>`;

const ONB_GOALS = [
  { id:'fonction-publique', label:'Travailler dans la fonction publique' },
  { id:'nationalite',       label:'Obtenir la nationalité' },
  { id:'enfants',           label:'Suivre la scolarité de mes enfants' },
  { id:'quotidien',         label:'Vivre au quotidien au Luxembourg' },
  { id:'curiosite',         label:'Par curiosité, pour le plaisir' }
];
const ONB_RHYTHMS = [
  { min:5,  tag:'escale' },
  { min:10, tag:'conseillé' },
  { min:15, tag:'voyage' }
];
const ONB_STEPS = 4;

/* ---------- Données du billet du jour ---------- */
function homeTicketData(){
  const minutes = userProfile.sessionMinutes || DEFAULT_SESSION_MINUTES;
  const { sessionCardCount, newWordCeiling } = computeSessionSizing(minutes);
  const reviews = Math.min(getReviewQueue().length, sessionCardCount);
  const unseen = VOCAB.filter(v => !vocabProgress[v.id]).length;
  const reinforce = isGoalReached();
  const fresh = reinforce ? 0 : Math.min(newWordCeiling, Math.max(0, sessionCardCount - reviews), remainingNewWordSlots(), unseen);
  return { minutes, reviews, fresh, reinforce };
}

function plural(n, one, many){ return `${n} ${n > 1 ? many : one}`; }

function homeJourney(){
  const seen = VOCAB.filter(v => vocabProgress[v.id]).length;
  return { seen, state: journeyState(seen, VOCAB.length) };
}

/* ---------- Bandeau d'accueil : salutation + billet ---------- */
function homeHeroHTML(){
  const name = escapeHtml(userProfile.name || '');
  const t = homeTicketData();
  const j = homeJourney().state;
  const today = todayStr();
  const doneToday = aggregateWeek(mondayOf(today), true).days.some(d => d.date === today);
  const line = homeLine({
    streak: sessionStats.streakDays || 0,
    daysAway: sessionStats.lastActiveDate ? Math.max(0, daysBetween(sessionStats.lastActiveDate, today)) : null,
    doneToday, hour: new Date().getHours()
  }, new Date().getDate());
  const route = j.finished
    ? `<div class="route-done">Tour du pays terminé. Bravo !</div>`
    : `<div class="route">
         <div class="route-stop"><small>DÉPART</small><b>${escapeHtml(j.from || 'En route')}</b></div>
         <svg class="route-arrow" width="34" height="14" viewBox="0 0 40 14" aria-hidden="true"><path d="M2 7 H32" stroke="#FFD166" stroke-width="3" stroke-dasharray="2 6" stroke-linecap="round" fill="none"/><path d="M28 2 L36 7 L28 12" fill="none" stroke="#FFD166" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>
         <div class="route-stop to"><small>ARRIVÉE</small><b>${escapeHtml(j.to)}</b></div>
       </div>`;
  const chips = t.reinforce
    ? [`Objectif du jour atteint`, `${t.reviews ? plural(t.reviews, 'mot à revoir', 'mots à revoir') : 'Révision libre'}`]
    : [plural(t.reviews, 'mot à revoir', 'mots à revoir'), plural(t.fresh, 'nouveau mot', 'nouveaux mots')];
  chips.push(`${t.minutes} min`);
  const shownChips = chips.filter(c => !/^0 /.test(c));
  return `
    <div class="home-greet">
      ${ROUDI_SVG('home-greet-roudi')}
      <div class="home-greet-text"><h1 class="d">Moien, ${name} !</h1><p>${escapeHtml(line)}</p></div>
    </div>
    <div class="ticket">
      <div class="ticket-main">
        <div class="ticket-kicker">Billet du jour</div>
        ${route}
        <div class="ticket-chips">${shownChips.map(c => `<span>${escapeHtml(c)}</span>`).join('')}</div>
      </div>
      <div class="ticket-go">
        <button class="btn-gold" onclick="startVocabSession()">${t.reinforce ? 'Renforcer' : 'Embarquer'}</button>
      </div>
    </div>`;
}

/* ---------- Semaine + parcours ---------- */
function homeWeekHTML(){
  const today = todayStr();
  const monday = mondayOf(today);
  const active = aggregateWeek(monday, true).days.map(d => d.date);
  const strip = weekStrip(monday, today, active, addDaysStr);
  const streak = sessionStats.streakDays || 0;
  const doneToday = active.indexOf(today) !== -1;
  const note = doneToday
    ? (streak > 0 ? `Bravo, ${plural(streak, 'jour', 'jours')} de suite.` : 'Bravo pour aujourd\'hui.')
    : (streak > 0 ? `Une session aujourd'hui pour tenir ${plural(streak + 1, 'jour', 'jours')} de suite.` : 'Une session aujourd\'hui pour lancer ta série.');
  const dayLabel = d => `${d.name} : ${d.state === 'on' ? 'fait' : d.state === 'today' ? 'aujourd\'hui' : d.state === 'missed' ? 'pas de session' : 'à venir'}`;
  const g = weeklyGoalFor(monday, true).st;
  return `
    <div class="home-card week-card">
      <div class="week-head"><span class="d">Ta semaine</span><button class="week-link" onclick="openCurrentWeekReview()">Mon bilan</button></div>
      <div class="week" role="list">
        ${strip.map(d => `<div class="week-day ${d.state}" role="listitem" aria-label="${escapeHtml(dayLabel(d))}"><i></i><span>${d.letter}</span></div>`).join('')}
      </div>
      <div class="week-goal ${g.state}">
        <div class="week-goal-head"><span>Objectif : <b>${g.done} / ${g.goal}</b> jours</span></div>
        <div class="rule-bar"><i style="width:${g.pct}%"></i></div>
        <p class="week-note">${escapeHtml(goalMessage(g))}</p>
      </div>
      <p class="week-note">${escapeHtml(note)}</p>
    </div>`;
}

const JOURNEY_X = [12, 31, 50, 69, 88];      // position horizontale des étapes (%)
const JOURNEY_HIGH = [false, true, false, true, false]; // étapes hautes : étiquette au-dessus ; basses : en dessous
function homeJourneyHTML(){
  const { seen, state } = homeJourney();
  const Y = i => JOURNEY_HIGH[i] ? 50 : 86;
  let path = '';
  state.stops.forEach((s, i) => {
    if(i === 0) return;
    const x0 = JOURNEY_X[i-1], x1 = JOURNEY_X[i], mx = (x0 + x1) / 2;
    const done = i - 1 < state.reached;
    path += `<path d="M${x0} ${Y(i-1)} C${mx} ${Y(i-1)} ${mx} ${Y(i)} ${x1} ${Y(i)}" class="${done ? 'done' : ''}" vector-effect="non-scaling-stroke"/>`;
  });
  const nodes = state.stops.map((s, i) => `
    <div class="stop ${s.state} ${JOURNEY_HIGH[i] ? 'high' : 'low'}" style="left:${JOURNEY_X[i]}%; top:${Y(i)}px">
      <span class="stop-dot">${s.state === 'current' ? ROUDI_SVG('stop-roudi') : ''}</span>
      <span class="stop-label">${escapeHtml(s.name)}</span>
    </div>`).join('');
  const next = state.finished ? 'Tu as visité tout le pays.' : `Encore ${plural(state.wordsToNext, 'mot', 'mots')} pour arriver à ${state.to}.`;
  return `
    <div class="home-card journey-card">
      <div class="week-head"><span class="d">Ton voyage</span><span class="journey-count">${seen} / ${VOCAB.length} mots vus</span></div>
      <div class="journey" role="img" aria-label="${escapeHtml(state.stops.map(s => s.name + (s.state === 'done' ? ' atteinte' : s.state === 'current' ? ' en route' : '')).join(', '))}">
        <svg class="journey-path" viewBox="0 0 100 140" preserveAspectRatio="none" aria-hidden="true">${path}</svg>
        ${nodes}
      </div>
      <p class="week-note">${escapeHtml(next)}</p>
    </div>`;
}

/* ---------- Raccourcis ---------- */
const HOME_ICONS = {
  talk:    '<path d="M4 5 h16 v10 H9 l-5 4Z" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round"/>',
  grammar: '<path d="M5 4 h10 a4 4 0 0 1 4 4 v12 H9 a4 4 0 0 1 -4 -4Z" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round"/>',
  gn:      '<path d="M6 8 H18 M14 4 L18 8 L14 12 M18 16 H6 M10 12 L6 16 L10 20" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  course:  '<path d="M3 9 L12 4 L21 9 L12 14Z M7 11.5 V16 c2.5 2 7.5 2 10 0 V11.5" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round"/>'
};
function homeLinkHTML(icon, color, title, sub, view, action){
  return `<button class="home-link" onclick="${action || `switchView('${view}')`}">
    <span class="home-link-ic" style="background:${color}"><svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">${HOME_ICONS[icon]}</svg></span>
    <span class="home-link-t d">${escapeHtml(title)}</span><span class="home-link-s">${escapeHtml(sub)}</span>
  </button>`;
}
function homeLinksHTML(){
  const rs = ruleStatsSummary();
  const gnSub = rs.n.total + rs.genre.total === 0 ? 'Le n et le genre des noms'
    : `n : ${rs.n.pct === null ? '—' : rs.n.pct + ' %'} · genre : ${rs.genre.pct === null ? '—' : rs.genre.pct + ' %'}`;
  return homeLinkHTML('gn', 'var(--accent)', 'Genre et n', gnSub, null, 'startArticleGame()')
    + homeLinkHTML('talk', 'var(--blue)', 'Small Talk', `${SMALLTALK.length} thèmes`, 'smalltalk-list')
    + homeLinkHTML('grammar', 'var(--green)', 'Grammaire', `${GRAMMAR.length} fiches`, 'grammar-list')
    + (hasEntitlement('course') ? homeLinkHTML('course', 'var(--gold-deep)', 'Cours', `${getCourse().lessons.length} leçons de l'ACD`, 'course') : '');
}

/* ---------- Mini-jeux : verrouillés tant que 20 mots ne sont pas vus ---------- */
function homeGamesLocked(){
  return VOCAB.filter(v => vocabProgress[v.id]).length < GAMES_UNLOCK_WORDS;
}
function homeLockedCardHTML(){
  const seen = VOCAB.filter(v => vocabProgress[v.id]).length;
  return `<div class="lock-card">
    <span class="lock-ic"><svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2" fill="#fff"/><path d="M8 11 V8 a4 4 0 0 1 8 0 V11" fill="none" stroke="#fff" stroke-width="2.4"/></svg></span>
    <div><div class="lock-t d">La gare des jeux</div><div class="lock-s">Ouverte à ${GAMES_UNLOCK_WORDS} mots vus. Tu en es à ${seen} / ${GAMES_UNLOCK_WORDS}.</div></div>
  </div>`;
}

/* ============================================================
   PARCOURS D'ACCUEIL
   1 prénom · 2 motif et rythme · 3 niveau · 4 première session (5 mots)
   ============================================================ */
let onbStep = null;

// Masque la navigation pendant le parcours d'accueil (classe sur <body> lue par le CSS).
function setOnboardingMode(on){
  if(document.body && document.body.classList) document.body.classList.toggle('onboarding', !!on);
}

function onbCurrentStep(){
  if(onbStep === null || (onbStep === 1 && userProfile.name)) onbStep = userProfile.name ? 2 : 1;
  return onbStep;
}

function onbShell(step, bubble, bodyHTML, footHTML, canBack){
  const bars = Array.from({length:ONB_STEPS}, (_, i) => `<i class="${i < step ? 'on' : ''}"></i>`).join('');
  return `<div class="onb">
    <div class="onb-top">
      ${canBack ? `<button class="onb-back" onclick="onbBack()" aria-label="Retour"><svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true"><path d="M12 4 L6 10 L12 16" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg></button>` : ''}
      <div class="onb-steps" role="img" aria-label="Étape ${step} sur ${ONB_STEPS}">${bars}</div>
    </div>
    <div class="onb-talk">${ROUDI_SVG('onb-roudi')}<div class="onb-bubble">${bubble}</div></div>
    <div class="onb-body">${bodyHTML}</div>
    <div class="onb-foot">${footHTML}</div>
  </div>`;
}

function renderOnboarding(){
  setOnboardingMode(true);
  const step = onbCurrentStep();
  const name = escapeHtml(userProfile.name || '');
  const hero = document.getElementById('hero-section');
  let html = '';
  if(step === 1){
    html = onbShell(1, 'Moien ! Je suis Roudi. Et toi, comment tu t\'appelles ?',
      `<div class="onb-field"><label for="onboard-name-input">Ton prénom</label>
         <input type="text" class="onboard-input" id="onboard-name-input" placeholder="Ton prénom" autocomplete="off" autocapitalize="words" autocorrect="off" spellcheck="false" enterkeyhint="done" maxlength="60" value="${name}">
         <p class="onb-hint">Je m'en sers seulement pour te saluer. Tu pourras le changer plus tard.</p>
         <p class="feedback wrong" id="onboard-name-feedback" role="alert"></p></div>`,
      `<button class="btn-big" onclick="onbSubmitName()">Continuer</button>`, false);
  } else if(step === 2){
    const goal = userProfile.goal || '';
    const minutes = userProfile.sessionMinutes || DEFAULT_SESSION_MINUTES;
    html = onbShell(2, `Enchanté ${name} ! Dis-moi pourquoi tu es là.`,
      `<div class="onb-options" role="radiogroup" aria-label="Pourquoi le luxembourgeois ?">
         ${ONB_GOALS.map(g => `<button class="onb-opt ${goal === g.id ? 'sel' : ''}" role="radio" aria-checked="${goal === g.id}" onclick="onbPickGoal('${g.id}')"><span class="onb-dot"></span><span>${escapeHtml(g.label)}</span></button>`).join('')}
       </div>
       <div class="onb-rhythm-title">Combien de temps par jour ?</div>
       <div class="onb-rhythm" role="radiogroup" aria-label="Durée quotidienne">
         ${ONB_RHYTHMS.map(r => `<button class="onb-min ${minutes === r.min ? 'sel' : ''}" role="radio" aria-checked="${minutes === r.min}" onclick="onbPickMinutes(${r.min})"><b>${r.min} min</b><small>${r.tag}</small></button>`).join('')}
       </div>`,
      `<button class="btn-big" onclick="onbGo(3)">Continuer</button>`, true);
  } else if(step === 3){
    html = onbShell(3, 'Tu connais déjà un peu de luxembourgeois ?',
      `<div class="onb-options">
         <button class="onb-opt big" onclick="onbLevel(false)"><span><b class="d">Non, je débute</b><em>On commence tout doucement, avec les salutations.</em></span></button>
         <button class="onb-opt big" onclick="onbLevel(true)"><span><b class="d">Oui, j'ai déjà des bases</b><em>Un petit test pour savoir où tu en es.</em></span></button>
       </div>`,
      '', true);
  } else {
    html = onbShell(4, 'Allons-y ! On commence par 5 mots, ça prend 3 minutes.',
      `<div class="onb-first">
         <div class="onb-first-card">
           <div class="onb-first-word d">Moien</div>
           <div class="onb-first-fr">Bonjour</div>
           <p>C'est le premier mot de ta première session. Ensuite, on voit ensemble comment tu avances.</p>
         </div>
       </div>`,
      `<button class="btn-big gold" onclick="onbStart()">Embarquer</button>`, true);
  }
  hero.innerHTML = html;
  if(step === 1){
    const input = document.getElementById('onboard-name-input');
    if(!input) return;
    input.focus();
    input.addEventListener('keydown', e => { if(e.key === 'Enter') onbSubmitName(); });
  }
  window.scrollTo(0, 0);
}

function onbSubmitName(){
  const input = document.getElementById('onboard-name-input');
  const msg = document.getElementById('onboard-name-feedback');
  const val = (input.value || '').trim();
  if(!val){ msg.textContent = 'Écris ton prénom pour continuer.'; return; }
  if(val.length > USER_NAME_MAX_LEN){ msg.textContent = `Ton prénom doit faire ${USER_NAME_MAX_LEN} caractères au plus.`; return; }
  if(hasForbiddenNameChars(val)){ msg.textContent = 'Les caractères < et > ne sont pas autorisés dans le prénom.'; return; }
  userProfile.name = val;
  saveProfile();
  onbGo(2);
}
function onbGo(step){ onbStep = step; renderOnboarding(); }
function onbBack(){ onbGo(Math.max(1, onbCurrentStep() - 1)); }
function onbPickGoal(id){ userProfile.goal = id; saveProfile(); renderOnboarding(); }
function onbPickMinutes(m){ userProfile.sessionMinutes = m; saveProfile(); renderOnboarding(); }
function onbFinish(){
  userProfile.onboardingDone = true;
  if(typeof track === 'function') track('onboarding_done');
  saveProfile();
  setOnboardingMode(false);
  onbStep = null;
}
function onbLevel(hasBasics){
  if(hasBasics){ onbFinish(); startPlacementTest(); } else onbGo(4);
}
function onbStart(){
  onbFinish();
  startVocabSession({ firstSession: true });
}
