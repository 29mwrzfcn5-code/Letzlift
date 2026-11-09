/* ============================================================
   RETOURS SENSORIELS (v1.32.0) — sons, confettis, tampons gagnés.
   Sons synthétisés par WebAudio (aucun fichier), désactivables dans Paramètres.
   Confettis et animations coupés si la personne a demandé moins de mouvement.
   ============================================================ */
const SOUND_KEY = 'letzlift:sound';
const STAMPS_SEEN_KEY = 'letzlift:stamps-seen';
let audioCtx = null;

function soundEnabled(){
  try{ return localStorage.getItem(SOUND_KEY) !== 'off'; }catch(e){ return true; }
}
function setSoundEnabled(on){
  try{ localStorage.setItem(SOUND_KEY, on ? 'on' : 'off'); }catch(e){}
}
function reducedMotion(){
  try{ return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }catch(e){ return false; }
}

// Joue une suite de notes [fréquence Hz, durée s, délai s] ; silencieux si le son est coupé ou indisponible.
function playTones(notes, type, volume){
  if(!soundEnabled()) return;
  try{
    const AC = window.AudioContext || window.webkitAudioContext;
    if(!AC) return;
    if(!audioCtx) audioCtx = new AC();
    if(audioCtx.state === 'suspended') audioCtx.resume();
    const t0 = audioCtx.currentTime;
    notes.forEach(([freq, dur, delay]) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type || 'sine';
      osc.frequency.value = freq;
      const start = t0 + delay;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(volume || 0.12, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
      osc.connect(gain); gain.connect(audioCtx.destination);
      osc.start(start); osc.stop(start + dur + 0.05);
    });
  }catch(e){}
}
function soundCorrect(){ playTones([[660, 0.12, 0], [880, 0.18, 0.1]], 'sine', 0.12); }
function soundWrong(){ playTones([[220, 0.22, 0]], 'triangle', 0.1); }
function soundFanfare(){ playTones([[523, 0.14, 0], [659, 0.14, 0.12], [784, 0.14, 0.24], [1047, 0.34, 0.36]], 'triangle', 0.13); }
function soundStamp(){ playTones([[392, 0.1, 0], [523, 0.1, 0.09], [784, 0.3, 0.18]], 'square', 0.07); }

// Confettis en HTML/CSS (30 pièces), retirés après l'animation.
function confetti(count){
  if(reducedMotion() || !document.body || !document.createElement) return;
  const layer = document.createElement('div');
  layer.className = 'confetti-layer';
  layer.setAttribute('aria-hidden', 'true');
  const colors = ['#D9342B', '#F2B33D', '#146EA6', '#3E8E5A', '#FFD166'];
  let html = '';
  for(let i = 0; i < (count || 30); i++){
    const left = Math.round(Math.random() * 100);
    const delay = (Math.random() * 0.5).toFixed(2);
    const dur = (1.6 + Math.random() * 1.2).toFixed(2);
    const rot = Math.round(Math.random() * 360);
    html += `<i style="left:${left}%;background:${colors[i % colors.length]};animation-delay:${delay}s;animation-duration:${dur}s;transform:rotate(${rot}deg)"></i>`;
  }
  layer.innerHTML = html;
  document.body.appendChild(layer);
  setTimeout(() => { if(layer.parentNode) layer.parentNode.removeChild(layer); }, 3400);
}

function bounceRoudi(){
  if(reducedMotion() || !document.querySelector) return;
  const el = document.querySelector('.brand-roudi');
  if(!el || !el.classList) return;
  el.classList.remove('bounce'); void el.getBoundingClientRect(); el.classList.add('bounce');
}

function feedbackCorrect(){ soundCorrect(); bounceRoudi(); }
function feedbackWrong(){ soundWrong(); }
function feedbackSessionEnd(pct){
  if(pct !== null && pct >= 70){ soundFanfare(); confetti(pct >= 90 ? 44 : 26); } else soundCorrect();
}

/* ---------- Tampons ---------- */
function stampContext(){
  const seen = VOCAB.filter(v => vocabProgress[v.id]).length;
  return {
    seen, total: VOCAB.length,
    mastered: VOCAB.filter(v => vocabProgress[v.id] && vocabProgress[v.id].box === 5).length,
    streak: sessionStats.streakDays || 0,
    sessions: sessionStats.totalSessions || 0,
    reached: journeyState(seen, VOCAB.length).reached
  };
}
function earnedStampIds(){ return earnedStamps(stampContext()).map(s => s.id); }

function readCelebrated(){
  try{ const v = JSON.parse(localStorage.getItem(STAMPS_SEEN_KEY) || 'null'); return Array.isArray(v) ? v : null; }catch(e){ return null; }
}
function writeCelebrated(ids){
  try{ localStorage.setItem(STAMPS_SEEN_KEY, JSON.stringify(ids)); }catch(e){}
}

// Appelé au début d'une session : fixe le point de départ des tampons (rien n'est fêté pour l'existant).
function ensureStampBaseline(){
  if(readCelebrated() === null) writeCelebrated(earnedStampIds());
}

// Appelé à la fin d'une session : renvoie les tampons nouvellement gagnés (et les note comme fêtés).
// Au tout premier appel sur un appareil, on enregistre l'existant sans fête (un compte ancien ne doit pas déclencher 12 tampons d'un coup).
function collectNewStamps(){
  const earned = earnedStampIds();
  const celebrated = readCelebrated();
  if(celebrated === null){ writeCelebrated(earned); return []; }
  const fresh = newStamps(earned, celebrated);
  if(fresh.length) writeCelebrated(earned);
  return fresh;
}

function stampBadgeHTML(s, on){
  return `<div class="stamp ${on ? 'on' : 'off'}" title="${escapeHtml(s.sub)}">
    <span class="stamp-ring"><span class="stamp-glyph d">${escapeHtml(s.glyph)}</span></span>
    <span class="stamp-name">${escapeHtml(s.label)}</span>
  </div>`;
}

function stampsPassportHTML(){
  const earned = new Set(earnedStampIds());
  const groups = [];
  STAMPS.forEach(s => { if(groups.indexOf(s.group) === -1) groups.push(s.group); });
  return `<div class="passport">
    <div class="passport-head"><b class="d">Ton passeport</b><span>${earned.size} / ${STAMPS.length} tampons</span></div>
    ${groups.map(g => `<div class="passport-group"><div class="passport-gname">${escapeHtml(g)}</div><div class="passport-row">${STAMPS.filter(s => s.group === g).map(s => stampBadgeHTML(s, earned.has(s.id))).join('')}</div></div>`).join('')}
  </div>`;
}

function newStampsHTML(list){
  if(!list || !list.length) return '';
  return `<div class="new-stamps">
    <div class="new-stamps-title d">${list.length > 1 ? 'Nouveaux tampons !' : 'Nouveau tampon !'}</div>
    <div class="passport-row">${list.map(s => stampBadgeHTML(s, true)).join('')}</div>
  </div>`;
}
