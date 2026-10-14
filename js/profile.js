
let vocabProgress = {};   // { id: { box:1-5, dueAt: timestamp } }
let grammarProgress = {}; // { id: true }
let smalltalkProgress = {}; // { "themeId-index": true|false }
let sessionStats = { streakDays:0, lastActiveDate:null, totalReviews:0, totalSessions:0, totalDaysActive:0, pauseTokens:0, lastTokenAwardStreak:0, totalActiveSeconds:0, lastWeeklyReviewWeek:null, totalAnswered:0, totalCorrect:0, lastBackupExportAt:null };
let xpState = { enduranceXP:0, arcadeXP:0 };
let dailyState = { date:null, xpToday:0, newWordsToday:0, activeSeconds:0 };
// Journal quotidien : une entrée archivée par jour écoulé. Prérequis du bilan hebdomadaire —
// dailyState ne conserve QUE le jour courant et était jusqu'ici écrasé sans trace au changement de date.
let dailyHistory = []; // [{date, xp, newWords, answered, correct, seconds}]
let gameRecords = {}; // { flash: bestScoreSeconds, truefalse: bestScoreSeconds }
let userProfile = { name:null, sessionMinutes:10, onboardingDone:false, keyboardNavEnabled:true, backupReminderDays:7 };


/* ============================================================
   SAUVEGARDE / RESTAURATION (filet de sécurité manuel)
   Complète la persistance automatique (localStorage / claude.ai) par un
   export-import JSON portable — utile si le cache navigateur est vidé,
   ou pour transférer la progression vers un autre appareil.
   ============================================================ */
function buildBackupPayload(){
  return {
    app: 'letzlift',
    formatVersion: 1,
    exportedAt: new Date().toISOString(),
    data: { vocabProgress, grammarProgress, sessionStats, smalltalkProgress, xpState, dailyState, gameRecords, userProfile, dailyHistory }
  };
}

function exportBackup(){
  const payload = buildBackupPayload();
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type:'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `letzlift-sauvegarde-${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  sessionStats.lastBackupExportAt = todayStr();
  saveStats();
  const status = document.getElementById('backup-status');
  if(status){ status.textContent = 'Sauvegarde téléchargée.'; status.className = 'feedback correct'; }
  const homeBanner = document.getElementById('backup-reminder-banner');
  if(homeBanner) homeBanner.innerHTML = ''; // efface le rappel immédiatement si on vient de l'écran d'accueil
}


function triggerImportBackup(){
  const input = document.getElementById('backup-import-input');
  if(input) input.click();
}

const MAX_BACKUP_FILE_BYTES = 5 * 1024 * 1024;
function isPlainRecord(value){
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function isSafeBackupValue(value, depth = 0){
  if(depth > 6) return false;
  if(value === null || typeof value === 'boolean') return true;
  if(typeof value === 'number') return Number.isFinite(value);
  if(typeof value === 'string') return value.length <= 200 && !/[<>]/.test(value);
  if(Array.isArray(value)) return value.length <= 1000 && value.every(v => isSafeBackupValue(v, depth + 1));
  if(isPlainRecord(value)){
    const entries = Object.entries(value);
    return entries.length <= 1000 && entries.every(([key, v]) => key.length <= 80 && isSafeBackupValue(v, depth + 1));
  }
  return false;
}
function validateBackupPayload(payload){
  if(!isPlainRecord(payload) || payload.app !== 'letzlift' || payload.formatVersion !== 1 || !isPlainRecord(payload.data)){
    throw new Error('format invalide');
  }
  const d = payload.data;
  const recordFields = ['vocabProgress','grammarProgress','sessionStats','smalltalkProgress','xpState','dailyState','gameRecords','userProfile'];
  if(recordFields.some(field => d[field] !== undefined && !isPlainRecord(d[field]))) throw new Error('structure invalide');
  if(d.dailyHistory !== undefined && !Array.isArray(d.dailyHistory)) throw new Error('historique invalide');
  if(!isSafeBackupValue(d)) throw new Error('contenu invalide');
  if(d.userProfile?.name !== undefined && d.userProfile.name !== null &&
     (typeof d.userProfile.name !== 'string' || d.userProfile.name.trim().length > 60)){
    throw new Error('profil invalide');
  }
  if(d.vocabProgress){
    const knownIds = new Set(VOCAB.map(v => v.id));
    for(const [id, entry] of Object.entries(d.vocabProgress)){
      if(!knownIds.has(id) || !isPlainRecord(entry) || !Number.isInteger(entry.box) || entry.box < 1 || entry.box > 5 || !Number.isFinite(entry.dueAt)){
        throw new Error('progression vocabulaire invalide');
      }
      if(entry.learningStep !== undefined && (!Number.isInteger(entry.learningStep) || entry.learningStep < 0 || entry.learningStep > 3)){
        throw new Error('étape d’apprentissage invalide');
      }
    }
  }
  return d;
}

async function handleImportBackupFile(fileInput){
  const file = fileInput.files && fileInput.files[0];
  if(!file) return;
  let ok = true;
  let message = '';
  try{
    if(file.size > MAX_BACKUP_FILE_BYTES) throw new Error('fichier trop volumineux');
    const text = await file.text();
    const payload = JSON.parse(text);
    const d = validateBackupPayload(payload);
    vocabProgress = d.vocabProgress || {};
    grammarProgress = d.grammarProgress || {};
    sessionStats = d.sessionStats || { streakDays:0, lastActiveDate:null, totalReviews:0, totalSessions:0, totalDaysActive:0, pauseTokens:0, lastTokenAwardStreak:0, totalActiveSeconds:0, lastWeeklyReviewWeek:null, totalAnswered:0, totalCorrect:0, lastBackupExportAt:null };
    smalltalkProgress = d.smalltalkProgress || {};
    xpState = d.xpState || { enduranceXP:0, arcadeXP:0 };
    dailyState = d.dailyState || { date:null, xpToday:0, newWordsToday:0, activeSeconds:0 };
    gameRecords = d.gameRecords || {};
    userProfile = d.userProfile || { name:null, sessionMinutes:DEFAULT_SESSION_MINUTES, onboardingDone:false, keyboardNavEnabled:true, backupReminderDays:7 };
    if(userProfile.keyboardNavEnabled === undefined) userProfile.keyboardNavEnabled = true;
    if(userProfile.backupReminderDays === undefined) userProfile.backupReminderDays = 7;
    if(userProfile.name && userProfile.onboardingDone === undefined) userProfile.onboardingDone = true;
    dailyHistory = Array.isArray(d.dailyHistory) ? d.dailyHistory : [];
    await Promise.all([
      saveVocabProgress(), saveGrammarProgress(), saveStats(), saveSmalltalkProgress(),
      saveXpState(), saveDailyState(), saveGameRecords(), saveProfile(), saveDailyHistory()
    ]);
    ensureDailyState();
    updateStreak();
    message = `Progression restaurée (sauvegarde du ${payload.exportedAt ? payload.exportedAt.slice(0,10) : '?'}).`;
  }catch(e){
    ok = false;
    message = "Ce fichier n'est pas une sauvegarde LetzLift valide.";
  }
  fileInput.value = '';
  renderNiveau(); // rebuild niveau-container avec les stats à jour (et un #backup-status frais)
  const status = document.getElementById('backup-status');
  if(status){ status.textContent = message; status.className = ok ? 'feedback correct' : 'feedback wrong'; }
}

function submitOnboardingName(){
  const input = document.getElementById('onboard-name-input');
  const val = (input.value || '').trim();
  if(!val || val.length > 60) return;
  userProfile.name = val;
  saveProfile();
  renderHome();
}

function finishOnboarding(hasBasics){
  userProfile.onboardingDone = true;
  saveProfile();
  if(hasBasics){
    startPlacementTest(); // amène directement au test — évite de repasser par un accueil vide entre les deux
  } else {
    renderHome();
  }
}
