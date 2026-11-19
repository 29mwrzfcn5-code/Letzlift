/* ============================================================
   MON VOYAGE — module pilote : parcours en unités (v1.45.0)
   Réservé aux comptes qui ont le droit « voyage » (donné par l'administrateur). Le son est réservé aux comptes qui ont
   en plus le droit « audio ». Données : data/voyage.js ; logique pure : js/lib/voyage.js.
   Une unité : 1 Écouter · 2 Découvrir · 3 Comprendre · 4 Produire · 5 Bilan.
   ============================================================ */
const VOYAGE_STEPS = ['Écouter', 'Découvrir', 'Comprendre', 'Produire', 'Bilan'];
let voyageSession = null;
let voyageAudioEl = null;
let voyageSceneToken = 0;

function voyageProgress(){
  if(!userProfile.voyage || typeof userProfile.voyage !== 'object') userProfile.voyage = { units: {} };
  if(!userProfile.voyage.units || typeof userProfile.voyage.units !== 'object') userProfile.voyage.units = {};
  return userProfile.voyage;
}
function voyageUnit(id){ return VOYAGE_UNITS.find(u => u.id === id); }
function voyageAudioOn(){ return hasEntitlement('audio'); }

// Barre du bas : « Mon voyage » prend la place de « Grammaire » pour les comptes autorisés (la grammaire reste sur l'accueil).
function voyageRefreshNav(){
  const on = hasEntitlement('voyage');
  document.querySelectorAll('.nav-tab[data-view="voyage"]').forEach(t => t.classList.toggle('is-off', !on));
  document.querySelectorAll('.nav-tab[data-view="grammar-list"]').forEach(t => t.classList.toggle('is-off', on));
}

/* ---------- son ---------- */
const VOYAGE_ICON_SOUND = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9 H8 L13 5 V19 L8 15 H4Z"/><path d="M16 9 q3 3 0 6 M18.5 6.5 q5 5.5 0 11"/></svg>';
function voyagePlay(unitId, file, onEnd){
  if(!voyageAudioOn() || !file) return;
  try{
    if(voyageAudioEl){ voyageAudioEl.onended = null; voyageAudioEl.pause(); }
    voyageAudioEl = new Audio(`assets/audio/voyage/${unitId}/${file}.mp3`);
    if(onEnd) voyageAudioEl.onended = onEnd;
    const p = voyageAudioEl.play();
    if(p && p.catch) p.catch(() => {});
  }catch(e){ /* le son est facultatif */ }
}
function voyageSoundBtn(unitId, file, label){
  if(!voyageAudioOn() || !file) return '';
  return `<button class="vy-play" onclick="voyagePlay('${unitId}','${file}')" aria-label="Écouter ${escapeHtml(label)}">${VOYAGE_ICON_SOUND}</button>`;
}
function voyagePlayScene(i){
  const u = voyageUnit(voyageSession.unitId);
  if(i === 0) voyageSceneToken++;
  const token = voyageSceneToken;
  const line = u.scene.lines[i];
  if(!line) return;
  document.querySelectorAll('.vy-line').forEach((el, k) => el.classList.toggle('now', k === i));
  voyagePlay(u.id, line.audio, () => { if(token === voyageSceneToken) { if(u.scene.lines[i + 1]) voyagePlayScene(i + 1); else document.querySelectorAll('.vy-line').forEach(el => el.classList.remove('now')); } });
}

/* ---------- carte du parcours ---------- */
function renderVoyage(){
  const root = document.getElementById('voyage-root');
  if(!root) return;
  const back = `<button class="hdr-back" onclick="switchView('home')" aria-label="Retour à l'accueil"><svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true"><path d="M12 4 L6 10 L12 16" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`;
  if(!hasEntitlement('voyage')){
    root.innerHTML = `<div class="screen-hdr">${back}<div class="screen-hdr-t"><h2 class="d">Mon voyage</h2><span class="sub">Ce module n'est pas activé sur ton compte.</span></div></div>`;
    return;
  }
  const prog = voyageProgress();
  const doneCount = VOYAGE_UNITS.filter((u, i) => voyageUnitState(prog, VOYAGE_UNITS, i) === 'done').length;
  const cur = voyageCurrentIndex(prog, VOYAGE_UNITS);
  const unit = VOYAGE_UNITS[cur];
  const hero = unit ? `
    <div class="vhero">
      <div class="vhero-kicker">Ta prochaine étape</div>
      <div class="vhero-title d">${escapeHtml(unit.title)}</div>
      <div class="vocab-minutes-caption">${unit.minutes} min · ${unit.cards.length} mots et phrases · 1 règle</div>
      <button class="btn-gold" onclick="voyageStart('${unit.id}')">${(prog.units[unit.id] || {}).stars ? 'Refaire l’unité' : 'Commencer l’unité'}</button>
    </div>` : `
    <div class="vhero"><div class="vhero-kicker">Mon voyage</div><div class="vhero-title d">Toutes les unités sont validées</div><div class="vocab-minutes-caption">D'autres unités arrivent.</div></div>`;
  const stars = n => '★'.repeat(n) + '<span class="vy-star-off">' + '★'.repeat(3 - n) + '</span>';
  const rows = VOYAGE_UNITS.map((u, i) => {
    const st = voyageUnitState(prog, VOYAGE_UNITS, i);
    const s = (prog.units[u.id] || {}).stars || 0;
    const node = st === 'done' ? '<span class="vy-node done">✓</span>' : st === 'open' ? `<span class="vy-node open">${u.n}</span>` : '<span class="vy-node lock">·</span>';
    const sub = st === 'done' ? stars(s) : st === 'open' ? 'en cours' : 'verrouillée';
    return `<button class="moi-row vy-row ${st}" ${st === 'locked' ? 'disabled' : `onclick="voyageStart('${u.id}')"`}>${node}<span class="moi-row-t"><b>${u.n} · ${escapeHtml(u.title)}</b><small>${sub}</small></span></button>`;
  }).join('');
  const soon = VOYAGE_SOON.map((t, i) => `<div class="moi-row vy-row soon"><span class="vy-node lock">·</span><span class="moi-row-t"><b>${VOYAGE_UNITS.length + i + 1} · ${escapeHtml(t)}</b><small>bientôt</small></span></div>`).join('');
  root.innerHTML = `
    <div class="screen-hdr">${back}<div class="screen-hdr-t"><h2 class="d">Mon voyage</h2><span class="sub">Module pilote · ${doneCount} unité${doneCount > 1 ? 's' : ''} validée${doneCount > 1 ? 's' : ''}</span></div></div>
    ${hero}
    <div class="set-sect">A1 · Les premiers pas</div>
    <div class="moi-list">${rows}${soon}</div>
    <p class="course-foot">${voyageAudioOn() ? 'Le son est une voix de synthèse du Zenter fir d’Lëtzebuerger Sprooch : à confirmer avec un locuteur natif.' : 'Le son n’est pas activé sur ton compte.'} Les phrases sont à faire relire par la professeure.</p>`;
}

/* ---------- déroulement d'une unité ---------- */
function voyageStart(unitId){
  voyageSession = { unitId, step: 0, card: 0, ex: 0, results: [], finished: false, added: 0, stars: 0 };
  voyageShow();
}
function voyageQuit(){
  voyageSceneToken++;
  if(voyageAudioEl){ voyageAudioEl.onended = null; voyageAudioEl.pause(); }
  voyageSession = null;
  renderVoyage();
}
function voyageNextStep(){ voyageSession.step++; voyageSession.card = 0; voyageSession.ex = 0; voyageShow(); }

function voyageShell(unit, body, sub, left){
  const S = voyageSession;
  return sessionShellHTML({
    quit: 'voyageQuit()', pct: 100 * (S.step + (sub || 0)) / VOYAGE_STEPS.length, pill: sessionStreakPill(),
    left: left || `Étape <b>${S.step + 1}</b> sur ${VOYAGE_STEPS.length} · ${VOYAGE_STEPS[S.step]}`,
    tag: `Unité ${unit.n}`, body, panelId: 'voyage-panel', fbId: 'voyage-feedback', contId: 'voyage-next'
  });
}

function voyageShow(){
  const S = voyageSession, root = document.getElementById('voyage-root');
  if(!S || !root) return;
  const u = voyageUnit(S.unitId);
  voyageSceneToken++;
  if(S.step === 0) root.innerHTML = voyageShell(u, voyageSceneHTML(u));
  else if(S.step === 1) voyageShowCard(u);
  else if(S.step === 2) root.innerHTML = voyageShell(u, voyageRuleHTML(u));
  else if(S.step === 3) voyageShowEx(u);
  else voyageShowEnd(u);
  window.scrollTo(0, 0);
}

function voyageSceneHTML(u){
  const lines = u.scene.lines.map((l, i) => `
    <div class="vy-line ${l.who === 'v' ? 'v' : 'c'}">
      <div class="vy-line-t"><div class="vy-lu">${escapeHtml(l.lu)}</div><div class="vy-fr">${escapeHtml(l.fr)}</div></div>
      ${voyageSoundBtn(u.id, l.audio, l.lu)}
    </div>`).join('');
  return `
    <div class="vy-scene">
      <div class="vy-scene-hd"><b class="d">${escapeHtml(u.scene.title)}</b>${voyageAudioOn() ? `<button class="btn-soft vy-all" onclick="voyagePlayScene(0)">${VOYAGE_ICON_SOUND} Écouter la scène</button>` : ''}</div>
      ${lines}
    </div>
    <p class="vy-note">${voyageAudioOn() ? 'Voix de synthèse : une voix humaine viendra plus tard.' : 'Lis la scène à voix haute. Le son sera ajouté plus tard.'}</p>
    <div class="sess-end-cta"><button class="btn-big" onclick="voyageNextStep()">Continuer →</button></div>`;
}

function voyageShowCard(u){
  const S = voyageSession, c = u.cards[S.card], last = S.card === u.cards.length - 1;
  const head = c.art ? `<span class="g-${c.g}">${escapeHtml(c.art)}</span> ${escapeHtml(c.lu)}` : escapeHtml(c.lu);
  const body = `
    <div class="vy-card">
      <div class="vy-card-kick">${escapeHtml(u.scene.title)}</div>
      <div class="vy-card-lu d">${head}</div>
      <div class="vy-card-fr">${escapeHtml(c.fr)}</div>
      ${voyageSoundBtn(u.id, c.audio, c.lu)}
      <div class="vy-card-sep"></div>
      <div class="vy-card-ex">${escapeHtml(c.ex)} ${voyageSoundBtn(u.id, c.exAudio, c.ex)}</div>
      <div class="vy-card-exfr">${escapeHtml(c.exFr)}</div>
    </div>
    ${c.art ? typeof genderLegendHTML === 'function' ? genderLegendHTML() : '' : ''}
    <div class="sess-end-cta">
      <button class="btn-big" onclick="voyageCardNext()">${last ? 'Continuer →' : 'Mot suivant →'}</button>
      ${S.card > 0 ? '<button class="btn-soft" onclick="voyageCardPrev()">← Précédent</button>' : ''}
    </div>`;
  document.getElementById('voyage-root').innerHTML = voyageShell(u, body, S.card / u.cards.length, `Mot <b>${S.card + 1}</b> / ${u.cards.length} · ${VOYAGE_STEPS[1]}`);
}
function voyageCardNext(){
  const u = voyageUnit(voyageSession.unitId);
  if(voyageSession.card >= u.cards.length - 1) return voyageNextStep();
  voyageSession.card++; voyageShowCard(u);
}
function voyageCardPrev(){ const u = voyageUnit(voyageSession.unitId); if(voyageSession.card > 0){ voyageSession.card--; voyageShowCard(u); } }

function voyageRuleHTML(u){
  const r = u.rule;
  const ex = r.examples.map(e => `
    <div class="vy-rule-row">
      <span class="vy-rule-w d"><span class="g-${e.g}">${escapeHtml(e.art)}</span> <mark class="${e.keep ? 'keep' : 'drop'}">${escapeHtml(e.letter)}</mark>${escapeHtml(e.word.slice(1))}</span>
      <span class="vy-rule-v ${e.keep ? 'keep' : 'drop'}">${escapeHtml(e.letter)} : ${e.keep ? 'dans la liste' : 'pas dans la liste'}</span>
    </div>`).join('');
  const letters = r.letters.split('').map(l => `<span class="vy-letter">${l}</span>`).join('');
  return `
    <h3 class="vy-rule-h d">${escapeHtml(r.title)}</h3>
    <p class="vy-rule-p">${escapeHtml(r.intro)}</p>
    <div class="vy-rule-card">${ex}</div>
    <div class="set-sect">Le n reste devant ces lettres</div>
    <div class="vy-letters">${letters}</div>
    <div class="sess-talk">${ROUDI_SVG('sess-roudi')}<div class="sess-bubble">${escapeHtml(r.tip)}</div></div>
    <div class="sess-end-cta"><button class="btn-big" onclick="voyageNextStep()">J'ai compris →</button></div>`;
}

function voyageShowEx(u){
  const S = voyageSession, ex = u.exercises[S.ex];
  const w = Math.max(3, ex.answer.length + 1);
  const body = `
    <div class="vy-ex-q">Complète la phrase</div>
    <div class="vy-sentence">${escapeHtml(ex.before)} <input type="text" class="vy-input" id="voyage-input" size="${w}" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="go" aria-label="Mot manquant"> ${escapeHtml(ex.after)}</div>
    <div class="vy-fr">${escapeHtml(ex.fr)}</div>
    <div class="sess-end-cta" id="voyage-check-wrap"><button class="btn-big" id="voyage-check" onclick="voyageCheck()">Valider</button></div>`;
  document.getElementById('voyage-root').innerHTML = voyageShell(u, body, S.ex / u.exercises.length, `Question <b>${S.ex + 1}</b> / ${u.exercises.length} · ${S.results.filter(r => r).length} ✓`);
  const input = document.getElementById('voyage-input');
  input.addEventListener('keydown', e => { if(e.key === 'Enter'){ e.preventDefault(); voyageCheck(); } });
  input.focus();
}

function voyageCheck(){
  const S = voyageSession, u = voyageUnit(S.unitId), ex = u.exercises[S.ex];
  const input = document.getElementById('voyage-input');
  if(!input || input.readOnly) return;
  const status = voyageGrade(input.value, ex.answer);
  if(status === 'empty'){ input.focus(); return; }
  input.readOnly = true;
  const ok = status !== 'wrong';
  S.results[S.ex] = ok;
  input.classList.add(ok ? 'good' : 'bad');
  if(typeof feedbackCorrect === 'function'){ if(ok) feedbackCorrect(); else feedbackWrong(); }
  const title = status === 'correct' ? 'Richteg !' : status === 'almost' ? 'Presque !' : 'Pas tout à fait';
  const said = status === 'wrong' ? `Réponse : <b>${escapeHtml(ex.answer)}</b>. ` : status === 'almost' ? `Écris <b>${escapeHtml(ex.answer)}</b> (accents et majuscules). ` : '';
  sessionPanel('voyage-panel', 'voyage-feedback', status === 'wrong' ? 'wrong' : status === 'almost' ? 'almost' : 'correct', title, `${said}${escapeHtml(ex.why)}`);
  const wrap = document.getElementById('voyage-check-wrap'); if(wrap) wrap.remove();
  document.getElementById('voyage-next').innerHTML = `<button class="continue-btn" id="voyage-next-btn" onclick="voyageNextEx()">Continuer →</button>`;
  const btn = document.getElementById('voyage-next-btn'); if(btn) btn.focus();
  voyagePlay(u.id, ex.audio);
}
function voyageNextEx(){
  const S = voyageSession, u = voyageUnit(S.unitId);
  S.ex++;
  if(S.ex >= u.exercises.length) return voyageNextStep();
  voyageShowEx(u);
}

// Les mots de l'unité qui existent dans le vocabulaire et ne sont pas encore vus : première révision demain.
function voyageAddWords(unit){
  let n = 0;
  unit.words.forEach(lu => {
    const v = VOCAB.find(x => x.lu === lu);
    if(v && !vocabProgress[v.id]){
      vocabProgress[v.id] = { box: 2, dueAt: Date.now() + BOX_INTERVALS_MS[2], learningStep: 3, updatedAt: Date.now() };
      n++;
    }
  });
  if(n && typeof saveVocabProgress === 'function') saveVocabProgress();
  return n;
}

function voyageFinish(u){
  const S = voyageSession;
  if(S.finished) return;
  S.finished = true;
  const correct = S.results.filter(r => r).length;
  S.stars = voyageStars(correct, u.exercises.length);
  voyageRecord(voyageProgress(), u.id, S.stars, Date.now());
  S.added = S.stars >= 1 ? voyageAddWords(u) : 0;
  saveProfile();
}

function voyageShowEnd(u){
  voyageFinish(u);
  const S = voyageSession, correct = S.results.filter(r => r).length, total = u.exercises.length;
  const stars = '★'.repeat(S.stars) + '<span class="vy-star-off">' + '★'.repeat(3 - S.stars) + '</span>';
  const hint = S.stars >= 1 ? `Unité ${u.n} réussie ! ${u.title} : tu sais le faire.` : 'Pas encore : refais l’unité, la règle va rentrer.';
  document.getElementById('voyage-root').innerHTML = `
    <div class="sess sess-end">
      <div class="screen-hdr"><div class="screen-hdr-t"><h2 class="d">Bilan de l'unité</h2></div></div>
      <div class="sess-talk">${ROUDI_SVG('sess-roudi big')}<div class="sess-bubble">${escapeHtml(hint)}</div></div>
      <div class="vy-stars" aria-label="${S.stars} étoile${S.stars > 1 ? 's' : ''} sur 3">${stars}</div>
      <div class="result-score-card"><div class="result-big d">${correct}<small>/${total}</small></div><div class="result-cap">réponses justes</div></div>
      <div class="result-review"><div class="result-review-title">Dans tes révisions</div>
        <div class="result-review-row"><span>${S.added ? `${S.added} mot${S.added > 1 ? 's' : ''} ajouté${S.added > 1 ? 's' : ''}` : 'Rien de nouveau à ajouter'}</span><span>première révision demain</span></div>
      </div>
      <div class="sess-end-cta">
        <button class="btn-big" onclick="voyageQuit()">Retour à Mon voyage</button>
        <button class="btn-soft" onclick="voyageStart('${u.id}')">Refaire l'unité</button>
      </div>
    </div>`;
  if(typeof feedbackSessionEnd === 'function') feedbackSessionEnd(Math.round(100 * correct / total));
}
