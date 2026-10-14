// ---- Moteur Vocabulaire v2 : curseur minutes ----
const CARDS_PER_MINUTE = 5; // hypothèse à valider empiriquement
const DEFAULT_SESSION_MINUTES = 10;
const SESSION_MINUTES_RANGE = { min:2, max:60 };
function computeSessionSizing(minutes){
  const sessionCardCount = Math.min(400, Math.max(10, Math.round(minutes * CARDS_PER_MINUTE)));
  const newWordCeiling = Math.round(sessionCardCount * 0.25);
  return { sessionCardCount, newWordCeiling };
}

// ---- Moteur Vocabulaire v2 : learning steps — voir js/lib/srs.js (LEARNING_GAPS, applyLearningStep) ----
function randomInRange([min,max]){ return min + Math.floor(Math.random()*(max-min+1)); }

/* ============================================================
   LOGIQUE LEITNER
   Box 1: revoir < 1h | Box 2: 1 jour | Box 3: 3 jours
   Box 4: 7 jours | Box 5: 14 jours (acquis)
   ============================================================ */
// BOX_INTERVALS_MS : voir js/lib/srs.js

function getEntry(id){
  if(!vocabProgress[id]) vocabProgress[id] = { box:1, dueAt:0, learningStep:0 };
  return vocabProgress[id];
}

function isDue(id){
  return isDueEntry(getEntry(id), Date.now());
}

// Renvoie null si le mot est "réglé" pour cette carte (review classique, ou mot qui vient de
// diplômer) — sinon un intervalle [min,max] de cartes avant la prochaine réapparition en session
// (mot encore en phase d'apprentissage, étapes 0-2). La logique des boîtes est dans
// applyAnswerToEntry() (js/lib/srs.js, testée sous Node) ; ici seulement l'état global et la persistance.
function recordAnswer(id, correct){
  const e = getEntry(id);
  const prevReps = difficultRepCount.get(id) || 0;
  const res = applyAnswerToEntry(e, correct, { now: Date.now(), kind: sessionKind, difficultReps: prevReps });
  if(res.difficultReps !== prevReps) difficultRepCount.set(id, res.difficultReps);
  const requeueGap = res.requeueGap;
  sessionStats.totalReviews += 1;
  saveVocabProgress();
  saveStats();
  recordVocabAttempt(correct);
  return requeueGap;
}

function getReviewQueue(){
  return VOCAB.filter(v => vocabProgress[v.id] && isDue(v.id))
    .sort((a,b) => (getEntry(a.id).box - getEntry(b.id).box) || (getEntry(a.id).dueAt - getEntry(b.id).dueAt));
}

// Détection de relâchement (v1.16.2). Née d'un cas réel : Maxime se sentait stagner depuis plus
// d'une semaine, et les vraies données lui donnaient raison — 90% de réussite le 17/08 à 42% le
// 10/09, causé par un embouteillage mécanique de révisions dues au même moment (beaucoup de mots
// avaient gradué en boîte 5 à peu près ensemble, donc revenaient à échéance ensemble 14 jours
// plus tard). Objectif : repérer ce genre de vrai décrochage AVANT que ça s'accumule sur des
// semaines, plutôt que de laisser la personne le découvrir seule et s'en inquiéter.
// Ne se prononce jamais sur l'état mental de la personne — uniquement des faits chiffrés
// (taux de réussite, taille de la pile de révisions) et des leviers concrets.
function detectSlack(){
  const recent = dailyHistory.filter(d => d.answered > 0).slice(-3);
  const recentAnswered = recent.reduce((a,d)=>a+d.answered, 0) + (dailyState.answeredToday || 0);
  const recentCorrect = recent.reduce((a,d)=>a+d.correct, 0) + (dailyState.correctToday || 0);
  const dueCount = getReviewQueue().length;

  // Pas assez d'historique pour un signal fiable (pas la peine d'alarmer sur un petit échantillon)
  if(recentAnswered < 30 || sessionStats.totalAnswered < 100) return null;

  const recentRate = recentCorrect / recentAnswered;
  const baselineRate = sessionStats.totalCorrect / sessionStats.totalAnswered;
  const dropPts = Math.round((baselineRate - recentRate) * 100);
  const bigBacklog = dueCount >= 100;

  if(dropPts < 15 && !bigBacklog) return null;

  return {
    dropPts, dueCount, bigBacklog,
    recentRatePct: Math.round(recentRate * 100),
    baselineRatePct: Math.round(baselineRate * 100),
  };
}

// File pour la session "révision des acquis" : mots en boîte 4-5 uniquement, dus en priorité,
// complétée par les mots non dus les plus anciennement revus (pour toujours remplir la session,
// même quand tout est à jour — cf. discussion sur les dates d'échéance).
function getMasteredPool(){
  return VOCAB.filter(v => {
    const p = vocabProgress[v.id];
    return p && p.learningStep === undefined && (p.box === 4 || p.box === 5);
  });
}

// Mode "mots difficiles" (v1.16.3) : les mots avec le plus d'erreurs cumulées (wrongCount,
// alimenté depuis v1.7.0 pour les badges "ça résiste"), triés du plus raté au moins raté.
const DIFFICULT_POOL_MIN_SIZE = 6;   // en dessous, pas assez de matière pour une vraie session (garde-fou)
const DIFFICULT_MIN_WRONG_COUNT = 3; // seuil pour qu'un mot soit considéré "difficile"
const DIFFICULT_SESSION_SIZE = 12;
// DIFFICULT_TARGET_REPS et DIFFICULT_REQUEUE_GAP_* : voir js/lib/srs.js

function getDifficultPool(){
  // wrongCount ne diminue jamais (compteur cumulatif à vie, pour les badges "ça résiste") — sans
  // condition de sortie, un mot une fois qualifié restait "difficile" pour toujours, même après
  // l'avoir depuis bien réussi plusieurs fois dans ce mode même. Un mot remonté en boîte 4-5
  // est un signal direct et à jour qu'il est de nouveau bien tenu, donc exclu du pool malgré
  // son historique — c'est ce qui fait tourner la sélection d'une session à l'autre.
  return VOCAB.filter(v => {
    const p = vocabProgress[v.id];
    return p && (p.wrongCount || 0) >= DIFFICULT_MIN_WRONG_COUNT && p.box < 4;
  }).sort((a,b) => (vocabProgress[b.id].wrongCount||0) - (vocabProgress[a.id].wrongCount||0));
}

// Mode "remise en confiance" (v1.16.3) : uniquement des mots déjà en boîte 5, indépendamment
// de leur date d'échéance — l'idée est de retrouver du terrain connu, pas de rattraper du retard.
const CONFIDENCE_POOL_MIN_SIZE = 6;
const CONFIDENCE_SESSION_SIZE = 10;

function getConfidencePool(){
  return VOCAB.filter(v => vocabProgress[v.id]?.box === 5);
}

function buildMasteryQueue(minutes){
  const { sessionCardCount } = computeSessionSizing(minutes);
  const pool = getMasteredPool();
  const due = pool.filter(v => isDue(v.id)).sort((a,b) => getEntry(a.id).dueAt - getEntry(b.id).dueAt);
  const notDue = pool.filter(v => !isDue(v.id)).sort((a,b) => getEntry(a.id).dueAt - getEntry(b.id).dueAt);
  return [...due, ...notDue].slice(0, sessionCardCount);
}

function getNewWordsQueue(limit){
  // Mélangé plutôt que dans l'ordre naturel du fichier : sinon un seul mot resté non enregistré
  // (ex. raté ou sauté pendant le test de placement) bloque en tête de file indéfiniment, et
  // avec lui tout ce qui suit dans l'ordre — chaque session repiochant les mêmes mots en boucle.
  return [...VOCAB].filter(v => !vocabProgress[v.id]).sort(()=>Math.random()-0.5).slice(0, limit);
}

function buildSessionQueue(minutes){
  const { sessionCardCount, newWordCeiling } = computeSessionSizing(minutes);
  const reviews = getReviewQueue().slice(0, sessionCardCount);
  const remainingSlots = Math.max(0, sessionCardCount - reviews.length);
  const newWordsAllowed = Math.min(newWordCeiling, remainingSlots, remainingNewWordSlots());
  const newWords = getNewWordsQueue(newWordsAllowed);

  // entrelace les nouveaux mots dans les révisions plutôt que de les coller à la fin
  const combined = [...reviews];
  newWords.forEach((w, i) => {
    const pos = Math.floor((i + 1) * (combined.length + 1) / (newWords.length + 1));
    combined.splice(Math.min(pos, combined.length), 0, w);
  });
  return combined;
}

function buildReinforcementQueue(minutes){
  // utilisé une fois l'objectif du jour atteint : uniquement du déjà-vu, pas de nouveauté
  const { sessionCardCount } = computeSessionSizing(minutes);
  const reviews = getReviewQueue();
  if(reviews.length > 0) return reviews.slice(0, sessionCardCount);
  const seen = VOCAB.filter(v => vocabProgress[v.id]);
  return [...seen].sort(()=>Math.random()-0.5).slice(0, sessionCardCount);
}

function getBoxCounts(){
  const counts = {1:0,2:0,3:0,4:0,5:0};
  VOCAB.forEach(v=>{
    const box = vocabProgress[v.id] ? vocabProgress[v.id].box : 0;
    if(box >= 1) counts[box]++;
  });
  return counts;
}
