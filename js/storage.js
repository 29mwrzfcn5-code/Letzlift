/* ============================================================
   SURCOUCHE D'ENRICHISSEMENT DU VOCABULAIRE (v1.17.1)
   VOCAB est codé en dur dans ce fichier — l'app ne peut pas réécrire son propre HTML. Un import
   CSV ne peut donc pas modifier le fichier lui-même : il alimente cette surcouche, persistée
   comme la progression (même navigateur, pas transmise en partageant le fichier), et appliquée
   UNE FOIS au chargement via applyVocabOverlay() — qui mute VOCAB en place. Comme il s'agit du
   même tableau (const empêche juste la réaffectation, pas la mutation), tout le reste du code
   qui lit VOCAB voit les mots enrichis sans qu'aucun autre endroit du fichier n'ait à changer.
   Format : { [id]: {lu, fr, cat, g, sentence, sentenceFr, note} } — un id déjà dans VOCAB met à
   jour l'entrée existante (Object.assign), un id absent ajoute un mot entièrement nouveau.
   ============================================================ */
const STORAGE_KEY_VOCAB_OVERLAY = 'letzlift:vocab-overlay';
let vocabOverlay = {};

function applyVocabOverlay(){
  const byId = new Map(VOCAB.map(v => [v.id, v]));
  for(const id of Object.keys(vocabOverlay)){
    const data = vocabOverlay[id];
    const existing = byId.get(id);
    if(existing){
      Object.assign(existing, data, { id }); // id jamais écrasable par la surcouche elle-même
    } else {
      const fresh = { ...data, id };
      VOCAB.push(fresh);
      byId.set(id, fresh);
    }
  }
}


/* ============================================================
   STOCKAGE PERSISTANT
   ============================================================ */
const STORAGE_KEY_VOCAB = 'letzlift:vocab-progress';
const STORAGE_KEY_GRAMMAR = 'letzlift:grammar-progress';
const STORAGE_KEY_STATS = 'letzlift:session-stats';
const STORAGE_KEY_SMALLTALK = 'letzlift:smalltalk-progress';
const STORAGE_KEY_XP = 'letzlift:xp';
const STORAGE_KEY_DAILY = 'letzlift:daily-state';
const STORAGE_KEY_RECORDS = 'letzlift:game-records';
const STORAGE_KEY_PROFILE = 'letzlift:profile';
const STORAGE_KEY_HISTORY = 'letzlift:daily-history';

/* ============================================================
   COUCHE DE STOCKAGE — double backend
   window.storage (artefact claude.ai) si disponible, sinon localStorage
   (cas d'usage normal : fichier ouvert en local, même navigateur).
   ============================================================ */
function hasClaudeStorage(){
  return typeof window.storage !== 'undefined' && window.storage && typeof window.storage.get === 'function';
}
function usingLocalStorageBackend(){
  return !hasClaudeStorage();
}
async function storageGet(key){
  if(hasClaudeStorage()){
    try{
      const r = await window.storage.get(key);
      if(r && r.value !== undefined) return r.value;
      return null;
    }catch(e){ /* repli localStorage */ }
  }
  try{ return localStorage.getItem(key); }catch(e){ return null; }
}
async function storageSet(key, value){
  if(hasClaudeStorage()){
    try{ await window.storage.set(key, value); return; }catch(e){ /* repli localStorage */ }
  }
  try{ localStorage.setItem(key, value); }catch(e){}
}

async function loadState(){
  try{
    const v = await storageGet(STORAGE_KEY_VOCAB);
    if(v) vocabProgress = JSON.parse(v);
  }catch(e){ vocabProgress = {}; }
  try{
    const v = await storageGet(STORAGE_KEY_VOCAB_OVERLAY);
    if(v) vocabOverlay = JSON.parse(v);
  }catch(e){ vocabOverlay = {}; }
  applyVocabOverlay(); // avant tout le reste : VOCAB doit déjà être enrichi au premier rendu
  try{
    const v = await storageGet(STORAGE_KEY_GRAMMAR);
    if(v) grammarProgress = JSON.parse(v);
  }catch(e){ grammarProgress = {}; }
  try{
    const v = await storageGet(STORAGE_KEY_STATS);
    if(v) sessionStats = JSON.parse(v);
  }catch(e){ sessionStats = { streakDays:0, lastActiveDate:null, totalReviews:0, pauseTokens:0, lastTokenAwardStreak:0, totalAnswered:0, totalCorrect:0, lastBackupExportAt:null }; }
  try{
    const v = await storageGet(STORAGE_KEY_SMALLTALK);
    if(v) smalltalkProgress = JSON.parse(v);
  }catch(e){ smalltalkProgress = {}; }
  try{
    const v = await storageGet(STORAGE_KEY_XP);
    if(v) xpState = JSON.parse(v);
  }catch(e){ xpState = { enduranceXP:0, arcadeXP:0 }; }
  try{
    const v = await storageGet(STORAGE_KEY_DAILY);
    if(v) dailyState = JSON.parse(v);
  }catch(e){ dailyState = { date:null, xpToday:0, newWordsToday:0 }; }
  try{
    const v = await storageGet(STORAGE_KEY_RECORDS);
    if(v) gameRecords = JSON.parse(v);
  }catch(e){ gameRecords = {}; }
  try{
    const v = await storageGet(STORAGE_KEY_PROFILE);
    if(v) userProfile = JSON.parse(v);
  }catch(e){ userProfile = { name:null, sessionMinutes:DEFAULT_SESSION_MINUTES, onboardingDone:false, keyboardNavEnabled:true, backupReminderDays:7 }; }
  // Personnes déjà utilisatrices avant l'ajout de cet écran de bienvenue (v1.8.0) : le champ
  // n'existe pas dans leur sauvegarde, mais elles ont déjà un prénom enregistré — pas question
  // de leur imposer rétroactivement l'écran d'accueil. Seuls les VRAIS nouveaux profils
  // (name encore null à ce stade du chargement) traverseront le nouveau parcours plus bas.
  if(userProfile.name && userProfile.onboardingDone === undefined) userProfile.onboardingDone = true;
  if(userProfile.keyboardNavEnabled === undefined) userProfile.keyboardNavEnabled = true;
  if(userProfile.backupReminderDays === undefined) userProfile.backupReminderDays = 7;
  // Prénom enregistré avant la v1.20.0 avec < ou > : retirés une fois pour toutes (sinon la
  // sauvegarde exportée serait refusée à l'import).
  const repairedName = cleanUserName(userProfile.name);
  if(repairedName !== userProfile.name){ userProfile.name = repairedName; saveProfile(); }
  try{
    const v = await storageGet(STORAGE_KEY_HISTORY);
    if(v) dailyHistory = JSON.parse(v);
  }catch(e){ dailyHistory = []; }
  if(!Array.isArray(dailyHistory)) dailyHistory = [];
  ensureDailyState();

  updateStreak();
}

async function saveVocabProgress(){ await storageSet(STORAGE_KEY_VOCAB, JSON.stringify(vocabProgress)); }
async function saveVocabOverlay(){ await storageSet(STORAGE_KEY_VOCAB_OVERLAY, JSON.stringify(vocabOverlay)); }

async function saveGrammarProgress(){ await storageSet(STORAGE_KEY_GRAMMAR, JSON.stringify(grammarProgress)); }
async function saveStats(){ await storageSet(STORAGE_KEY_STATS, JSON.stringify(sessionStats)); }
async function saveSmalltalkProgress(){ await storageSet(STORAGE_KEY_SMALLTALK, JSON.stringify(smalltalkProgress)); }
async function saveXpState(){ await storageSet(STORAGE_KEY_XP, JSON.stringify(xpState)); }
async function saveDailyState(){ await storageSet(STORAGE_KEY_DAILY, JSON.stringify(dailyState)); }
async function saveGameRecords(){ await storageSet(STORAGE_KEY_RECORDS, JSON.stringify(gameRecords)); }
async function saveProfile(){ await storageSet(STORAGE_KEY_PROFILE, JSON.stringify(userProfile)); }
async function saveDailyHistory(){ await storageSet(STORAGE_KEY_HISTORY, JSON.stringify(dailyHistory)); }
