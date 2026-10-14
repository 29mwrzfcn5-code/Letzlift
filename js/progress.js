const DAILY_XP_GOAL = 50;
const DAILY_NEW_WORDS_CAP = 12; // conservé comme filet de sécurité absolu (plafond du plafond)
const OVERTIME_MULTIPLIER = 1.5;
// Jetons de pause : protègent la série en cas d'absence (week-end typiquement) sans la casser.
const PAUSE_TOKEN_INTERVAL = 5; // 1 jeton gagné tous les N jours de série
const PAUSE_TOKEN_CAP = 3;      // stock maximum de jetons
const DAILY_CHALLENGE_MIN_GAMES = 2;   // mini-jeux à terminer (en plus de l'objectif XP) pour le défi du jour
const DAILY_CHALLENGE_MIN_ANSWERS = 100; // ou, alternative : ce nombre de réponses vocabulaire dans la journée

// Les 13 mini-jeux éligibles à la sélection quotidienne (mêmes clés que markMiniGameCompleted()).
// Titres dupliqués ici plutôt que lus depuis GAMES (défini plus loin dans renderVocabHub) pour
// que le widget d'accueil puisse s'en servir sans dépendre de l'ordre de définition des fonctions.
const DAILY_CHALLENGE_GAME_TITLES = {
  flash:'Conjugaison éclair', truefalse:'Vrai/Faux', memory:'Memory', intrus:"L'intrus",
  horloge:"L'horloge", article:'Le bon article', imagedesc:"Décris l'image",
  interrogatif:'Devine la question', connecteur:'Relie les idées', timeline:'Timeline',
  anagramme:'Anagramme', dialogue:'Dialogue', phrasedrill:'Remise en ordre',
};
const DAILY_CHALLENGE_GAME_LAUNCHERS = {
  flash:'startFlashGame()', truefalse:'startTrueFalseGame()', memory:'startMemoryGame()',
  intrus:'chooseIntrusLevel()', horloge:'chooseClockLevel()', article:'startArticleGame()',
  imagedesc:'startImageDescGame()', interrogatif:'chooseInterrogativeLevel()',
  connecteur:'startConnectorGame()', timeline:'startTimelineGame()', anagramme:'startAnagramGame()',
  dialogue:'startDialogueGame()', phrasedrill:'startVocabPhraseDrill()',
};

// Échelle visuelle pour la barre Arcade du jour. L'Arcade n'a PAS de plafond réel (contrairement
// à l'Endurance, bridée à DAILY_XP_GOAL) : c'est juste un repère pour que la barre veuille dire
// quelque chose, avec un dégradé qui vire au vert à mesure qu'on s'en approche.
const ARCADE_DAILY_REFERENCE = 200;

// Liste unique des mini-jeux (contenu + métadonnées visuelles pour les médaillons v1.13).
// Était auparavant déclarée à l'intérieur de renderHome() ; sortie ici pour être réutilisable.
const MINI_GAMES = [
  {key:'phrasedrill', title:'Remise en ordre', desc:'3 niveaux façon pari : clic-ordre, amorces, traduction libre.', fn:'startVocabPhraseDrill()', record:'phrasedrill', recordUnit:' pts', symbol:'↕', coin:'c-clay'},
  {key:'flash', title:'Conjugaison éclair', desc:'sinn, hunn et verbes réguliers, au chrono. -10s par erreur.', fn:'startFlashGame()', record:'flash', symbol:'⚡', coin:'c-clay'},
  {key:'truefalse', title:'Vrai / Faux', desc:'Mot + traduction : juste ou pas, le plus vite possible.', fn:'startTrueFalseGame()', record:'truefalse', symbol:'✓✗', coin:'c-river'},
  {key:'memory', title:'Memory', desc:'Associe les paires mot ↔ traduction.', fn:'startMemoryGame()', symbol:'🃏', coin:'c-gold'},
  {key:'intrus', title:"L'intrus", desc:'Quatre mots, un seul ne va pas avec les autres — deux niveaux.', fn:'chooseIntrusLevel()', symbol:'🦊', coin:'c-clay'},
  {key:'horloge', title:"L'horloge", desc:"Lis l'heure sur le cadran — QCM ou à écrire selon le niveau.", fn:'chooseClockLevel()', symbol:'🕐', coin:'c-river'},
  {key:'article', title:'Le bon article', desc:'e, en ou eng ? À la chaîne, au chrono.', fn:'startArticleGame()', record:'article', symbol:'♂♀', coin:'c-gold'},
  {key:'interrogatif', title:'Devine la question', desc:'Quel mot interrogatif a déclenché cette réponse ? Deux niveaux.', fn:'chooseInterrogativeLevel()', symbol:'?', coin:'c-clay'},
  {key:'connecteur', title:'Relie les idées', desc:'Deux idées à relier avec le bon connecteur logique.', fn:'startConnectorGame()', symbol:'🔗', coin:'c-river'},
  {key:'timeline', title:'Timeline', desc:"Un texte, six moments à remettre dans l'ordre chronologique.", fn:'startTimelineGame()', symbol:'📅', coin:'c-gold'},
  {key:'anagramme', title:'Anagramme', desc:"Remets les lettres d'un mot déjà vu dans l'ordre.", fn:'startAnagramGame()', symbol:'🔤', coin:'c-clay'},
  {key:'dialogue', title:'Dialogue', desc:'Un échange court : choisis la réplique la plus naturelle.', fn:'startDialogueGame()', symbol:'💭', coin:'c-river'},
  {key:'imagedesc', title:"Décris l'image", desc:'Une scène, 10 phrases : coche celles qui sont vraies.', fn:'startImageDescGame()', symbol:'🖼', coin:'c-gold'},
];

// Tire 2 jeux distincts au hasard parmi les 13 — "du piquant", pour forcer un peu de variété
// plutôt que de toujours pouvoir cocher le défi avec ses deux jeux préférés habituels.
function pickDailyChallengeGames(){
  const keys = Object.keys(DAILY_CHALLENGE_GAME_TITLES);
  const shuffled = [...keys].sort(()=>Math.random()-0.5);
  return shuffled.slice(0, DAILY_CHALLENGE_MIN_GAMES);
}
// PAUSE_TOKEN_MAX_GAP a disparu en v1.14.3 : la consommation est désormais 1 jeton par jour
// manqué (voir updateStreak()), le plafond de stock (PAUSE_TOKEN_CAP) borne déjà naturellement
// l'absence maximale couvrable en une fois — plus besoin d'un second seuil séparé.
// Chronomètre de temps actif : ne tourne que sur les écrans d'exercice, en pause si l'onglet
// passe en arrière-plan ou si aucune interaction depuis IDLE_TIMEOUT_MS.
const IDLE_TIMEOUT_MS = 90000;   // 90 s sans interaction → pause (assez large pour réfléchir à une réponse)
const TIMER_FLUSH_MS = 30000;    // écriture périodique en persistance, pour ne pas tout perdre si l'onglet est fermé brutalement
const HISTORY_MAX_DAYS = 400;    // plafond du journal (~13 mois), quelques dizaines d'octets par jour
const TIMED_VIEWS = new Set([
  'grammar-detail','phrase-drill','flash','truefalse','memory','intrus',
  'horloge','article','imagedesc','interrogatif','connecteur','timeline','anagramme','dialogue'
]); // 'vocab' est traité à part : l'id de vue sert à la fois au hub (non compté) et à la session (comptée)
const XP_VALUES = { type:3, qcm:2, reverse:4, genre:2, grammar:3, smalltalk:2 };
const ENDURANCE_LEVELS = [0, 150, 500, 1050, 1900, 3000, 3600, 4200, 4800, 5500, 6200];


/* ============================================================
   BADGES (3 familles) + DÉBLOCAGES PAR NIVEAU
   ============================================================ */
const BADGES = [
  // Famille 1 — Paliers Endurance (lieux du Luxembourg)
  {id:'gelle-fra', family:'palier', name:'Gëlle Fra', desc:'Atteindre le niveau 2 Endurance', icon:'🗽', check:()=>getEnduranceLevel().level >= 2},
  {id:'adolphe-breck', family:'palier', name:'Adolphe-Bréck', desc:'Atteindre le niveau 4 Endurance', icon:'🌉', check:()=>getEnduranceLevel().level >= 4},
  {id:'vianden', family:'palier', name:'Vianden', desc:'Atteindre le niveau 6 Endurance', icon:'🏰', check:()=>getEnduranceLevel().level >= 6},
  {id:'mellerdall', family:'palier', name:'Mëllerdall', desc:'Atteindre le niveau 8 Endurance', icon:'🪨', check:()=>getEnduranceLevel().level >= 8},
  {id:'sproochentest', family:'palier', name:'Sproochentest-prêt', desc:'Atteindre le niveau 10 Endurance', icon:'🎓', check:()=>getEnduranceLevel().level >= 10},
  // Famille 2 — Arcade (spécialités culinaires)
  {id:'gromperekichelcher', family:'arcade', name:'Gromperekichelcher', desc:'50 XP Arcade', icon:'🥔', check:()=>xpState.arcadeXP >= 50},
  {id:'bouneschlupp', family:'arcade', name:'Bouneschlupp', desc:'150 XP Arcade', icon:'🍲', check:()=>xpState.arcadeXP >= 150},
  {id:'quetschentaart', family:'arcade', name:'Quetschentaart', desc:'300 XP Arcade', icon:'🥧', check:()=>xpState.arcadeXP >= 300},
  {id:'judd', family:'arcade', name:'Judd mat Gaardebounen', desc:'600 XP Arcade', icon:'🍖', check:()=>xpState.arcadeXP >= 600},
  // Famille 3 — Incongrus (records absurdes)
  {id:'andy-schleck', family:'incongru', name:'Andy Schleck', desc:'Conjugaison éclair en moins de 60s', icon:'🚴', check:()=>gameRecords.flash !== undefined && gameRecords.flash < 60},
  {id:'battin-flash', family:'incongru', name:'Battin', desc:'Conjugaison éclair en moins de 45s', icon:'🍺', check:()=>gameRecords.flash !== undefined && gameRecords.flash < 45},
  {id:'simon-flash', family:'incongru', name:'Simon', desc:'Conjugaison éclair en moins de 30s', icon:'🍻', check:()=>gameRecords.flash !== undefined && gameRecords.flash < 30},
  {id:'bofferding-article', family:'incongru', name:'Bofferding', desc:'Le bon article en moins de 45s', icon:'🍺', check:()=>gameRecords.article !== undefined && gameRecords.article < 45},
  {id:'battin-article', family:'incongru', name:'Battin', desc:'Le bon article en moins de 32s', icon:'🍺', check:()=>gameRecords.article !== undefined && gameRecords.article < 32},
  {id:'simon-article', family:'incongru', name:'Simon', desc:'Le bon article en moins de 22s', icon:'🍻', check:()=>gameRecords.article !== undefined && gameRecords.article < 22},
  {id:'bofferding-tf', family:'incongru', name:'Bofferding', desc:'Vrai/Faux en moins de 50s', icon:'🍺', check:()=>gameRecords.truefalse !== undefined && gameRecords.truefalse < 50},
  {id:'battin-tf', family:'incongru', name:'Battin', desc:'Vrai/Faux en moins de 35s', icon:'🍺', check:()=>gameRecords.truefalse !== undefined && gameRecords.truefalse < 35},
  {id:'simon-tf', family:'incongru', name:'Simon', desc:'Vrai/Faux en moins de 24s', icon:'🍻', check:()=>gameRecords.truefalse !== undefined && gameRecords.truefalse < 24},
  // Badges "ça résiste" : célèbrent la persistance plutôt que la perfection — cohérent avec le
  // principe "jamais punitif" du projet. wrongCount (v1.7.0) compte les erreurs cumulées sur un
  // mot, toutes sessions confondues (hors test de placement, qui ne passe pas par recordAnswer).
  {id:'decidement', family:'incongru', name:'Décidément…', desc:'Un mot raté 10 fois ou plus', icon:'😅', check:()=>Object.values(vocabProgress).some(e => (e.wrongCount||0) >= 10)},
  {id:'increvable', family:'incongru', name:'Increvable', desc:'Un mot raté 20 fois ou plus — toujours pas abandonné', icon:'💪', check:()=>Object.values(vocabProgress).some(e => (e.wrongCount||0) >= 20)},
  {id:'la-revanche', family:'incongru', name:'La revanche', desc:'Un mot raté au moins 5 fois, maintenant pleinement maîtrisé (boîte 5)', icon:'🏆', check:()=>Object.values(vocabProgress).some(e => (e.wrongCount||0) >= 5 && e.box === 5)},
  {id:'roude-leiw', family:'incongru', name:'Roude Léiw', desc:'Vrai/Faux parfait : 20/20', icon:'🦁', check:()=>!!gameRecords.tfPerfect},
  {id:'superjhemp', family:'incongru', name:'Superjhemp', desc:'Conjugaison éclair parfaite : 15/15', icon:'🦸', check:()=>!!gameRecords.flashPerfect},
  {id:'schueberfouer', family:'incongru', name:'Schueberfouer', desc:'100 réponses en une seule journée', icon:'🎡', check:()=>!!gameRecords.hundredDay},
  {id:'renert', family:'incongru', name:'Renert', desc:"L'intrus niveau 2, sans-faute", icon:'🦊', check:()=>!!gameRecords.intrusL2Perfect},
  {id:'bretzelsonndeg', family:'incongru', name:'Bretzelsonndeg', desc:'Anagramme, sans-faute', icon:'🥨', check:()=>!!gameRecords.anagramPerfect},
  {id:'buergbrennen', family:'incongru', name:'Buergbrennen', desc:'Timeline, ordre chronologique parfait', icon:'🔥', check:()=>!!gameRecords.timelinePerfect},
  {id:'kniddelen', family:'incongru', name:'Kniddelen', desc:'Devine la question niveau 2, sans-faute', icon:'🥟', check:()=>!!gameRecords.interrogatifL2Perfect},
  // Famille 4 — Séries (paliers de jours de suite ; un jeton de pause qui comble un trou compte
  // normalement puisque sessionStats.streakDays continue d'augmenter dans ce cas — pas de logique dédiée nécessaire)
  {id:'serie-3', family:'serie', name:'Trois de suite', desc:'3 jours de suite', icon:'🔥', check:()=>sessionStats.streakDays >= 3},
  {id:'serie-5', family:'serie', name:'Cinq de suite', desc:'5 jours de suite', icon:'🔥', check:()=>sessionStats.streakDays >= 5},
  {id:'serie-10', family:'serie', name:'Dix de suite', desc:'10 jours de suite', icon:'🔥', check:()=>sessionStats.streakDays >= 10},
  {id:'serie-20', family:'serie', name:'Vingt de suite', desc:'20 jours de suite', icon:'🔥', check:()=>sessionStats.streakDays >= 20},
  {id:'serie-30', family:'serie', name:'Trente de suite', desc:'30 jours de suite', icon:'🔥', check:()=>sessionStats.streakDays >= 30},
  // Famille 2bis — Arcade, paliers additionnels (le plus haut existant, 600 XP, est très vite dépassé en pratique)
  {id:'feierstengszalot', family:'arcade', name:'Feierstengszalot', desc:'1500 XP Arcade', icon:'🥗', check:()=>xpState.arcadeXP >= 1500},
  {id:'kachkeess', family:'arcade', name:'Kachkéis', desc:'4000 XP Arcade', icon:'🧀', check:()=>xpState.arcadeXP >= 4000},
  {id:'traiteur', family:'arcade', name:'Buffet complet', desc:'10000 XP Arcade', icon:'🍽️', check:()=>xpState.arcadeXP >= 10000},
];

function getEarnedBadges(){
  return BADGES.filter(b => { try{ return b.check(); }catch(e){ return false; } });
}

// Déblocage des thèmes Small Talk par niveau Endurance
const THEME_UNLOCK_LEVELS = {
  'st-aarbecht':1, 'st-famill':1, 'st-wieder':1, 'st-auer':1,
  'st-iessen':2, 'st-hobbien':2,
  'st-transport':3, 'st-reesen':3,
  'st-sproochen':4, 'st-akafen':4,
  'st-wunnen':5, 'st-gesond':5,
  'st-haushalt':6, 'st-medien':6,
};

// Déblocage des mini-jeux par niveau Endurance (jeux de compétence pure = toujours ouverts)
const GAME_UNLOCK_LEVELS = {
  flash:1, truefalse:1, phrasedrill:1,
  memory:2, intrus:3, interrogatif:3, horloge:4, article:5, connecteur:5, timeline:5, anagramme:6, imagedesc:6, dialogue:7,
};

function isThemeUnlocked(id){
  return getEnduranceLevel().level >= (THEME_UNLOCK_LEVELS[id] || 1);
}
function isGameUnlocked(key){
  return getEnduranceLevel().level >= (GAME_UNLOCK_LEVELS[key] || 1);
}

/* ============================================================
   MOTEUR XP — double monnaie (Endurance / Arcade) + objectif journalier
   ============================================================ */
function ensureDailyState(){
  const today = todayStr();
  if(dailyState.date !== today){
    archiveDay(dailyState);
    dailyState = { date:today, xpToday:0, newWordsToday:0, activeSeconds:0, miniGamesCompletedToday:0, challengeRewardedToday:false, challengeGames:pickDailyChallengeGames(), challengeGamesDone:{} };
    saveDailyState();
  }
  if(dailyState.activeSeconds === undefined) dailyState.activeSeconds = 0; // migration anciennes sauvegardes
  if(dailyState.miniGamesCompletedToday === undefined) dailyState.miniGamesCompletedToday = 0;
  if(dailyState.challengeRewardedToday === undefined) dailyState.challengeRewardedToday = false;
  if(!dailyState.challengeGames) dailyState.challengeGames = pickDailyChallengeGames();
  if(!dailyState.challengeGamesDone) dailyState.challengeGamesDone = {};
}

// Archive une journée écoulée dans le journal. Ignore les journées vides (date nulle au tout
// premier lancement, ou jour ouvert sans aucune activité) pour ne pas polluer les moyennes.
function archiveDay(day){
  if(!day || !day.date) return;
  const hasActivity = (day.xpToday || 0) > 0 || (day.answeredToday || 0) > 0 || (day.activeSeconds || 0) > 0;
  if(!hasActivity) return;
  if(dailyHistory.some(d => d.date === day.date)) return; // idempotent : jamais deux fois la même date
  dailyHistory.push({
    date: day.date,
    xp: day.xpToday || 0,
    newWords: day.newWordsToday || 0,
    answered: day.answeredToday || 0,
    correct: day.correctToday || 0,
    seconds: day.activeSeconds || 0
  });
  if(dailyHistory.length > HISTORY_MAX_DAYS) dailyHistory = dailyHistory.slice(-HISTORY_MAX_DAYS);
  saveDailyHistory();
}

function isGoalReached(){
  ensureDailyState();
  return dailyState.xpToday >= DAILY_XP_GOAL;
}

function getDailyNewWordQuota(){
  // quota adaptatif : proportionnel au taux de réussite du jour, avec plancher garanti (jamais 0)
  const ceiling = DAILY_NEW_WORDS_CAP;
  const rate = getSuccessRateToday();
  let quota;
  if(rate >= 0.85) quota = ceiling;
  else if(rate >= 0.6) quota = Math.round(ceiling * 0.6);
  else quota = Math.max(3, Math.round(ceiling * 0.25));
  return Math.min(ceiling, quota);
}

function canIntroduceNewWord(){
  ensureDailyState();
  return !isGoalReached() && dailyState.newWordsToday < getDailyNewWordQuota();
}

function remainingNewWordSlots(){
  ensureDailyState();
  if(isGoalReached()) return 0;
  return Math.max(0, getDailyNewWordQuota() - dailyState.newWordsToday);
}

function markWordIntroduced(){
  ensureDailyState();
  dailyState.newWordsToday++;
  saveDailyState();
}

function addEnduranceXP(baseAmount, ratio){
  ensureDailyState();
  const overtime = isGoalReached();
  const adjustedBase = ratio ? Math.max(1, Math.round(baseAmount * ratio)) : baseAmount;
  const amount = overtime ? Math.round(adjustedBase * OVERTIME_MULTIPLIER) : adjustedBase;
  if(overtime){
    // objectif quotidien déjà atteint : le XP supplémentaire nourrit l'Arcade (badges culinaires),
    // plus le niveau Endurance — ça plafonne la progression de niveau/déblocage des jeux à 50 XP/jour,
    // quel que soit le volume de pratique en plus.
    xpState.arcadeXP += amount;
  } else {
    xpState.enduranceXP += amount;
  }
  dailyState.xpToday += amount;
  dailyState.answersToday = (dailyState.answersToday || 0) + 1; // compteur dédié au badge "100 réponses/jour", distinct de answeredToday
  if(dailyState.answersToday >= 100 && !gameRecords.hundredDay){ gameRecords.hundredDay = true; saveGameRecords(); }
  saveXpState();
  saveDailyState();
  checkDailyChallenge();
  return { amount, overtime };
}

function recordVocabAttempt(wasCorrect){
  // à appeler pour CHAQUE tentative vocabulaire (juste ou fausse) — SEULE source de vérité pour
  // answeredToday/correctToday (voir le correctif du double comptage dans addEnduranceXP ci-dessus).
  ensureDailyState();
  dailyState.answeredToday = (dailyState.answeredToday || 0) + 1;
  if(wasCorrect) dailyState.correctToday = (dailyState.correctToday || 0) + 1;
  sessionStats.totalAnswered = (sessionStats.totalAnswered || 0) + 1;
  if(wasCorrect) sessionStats.totalCorrect = (sessionStats.totalCorrect || 0) + 1;
  saveDailyState();
  saveStats();
}

function getSuccessRateToday(){
  ensureDailyState();
  if(!dailyState.answeredToday) return 1.0;
  return dailyState.correctToday / dailyState.answeredToday;
}

function addArcadeXP(amount){
  ensureDailyState();
  xpState.arcadeXP += amount;
  dailyState.answersToday = (dailyState.answersToday || 0) + 1;
  if(dailyState.answersToday >= 100 && !gameRecords.hundredDay){ gameRecords.hundredDay = true; saveGameRecords(); }
  saveXpState();
  saveDailyState();
  checkDailyChallenge();
}

// Compteur précis de rounds de mini-jeux terminés aujourd'hui — appelé UNE FOIS par partie,
// directement dans l'écran de fin de chaque jeu (pas dans addArcadeXP : Remise en ordre y appelle
// plusieurs fois par partie, une fois par phrase, ce qui fausserait le compte).
// gameKey identifie PRÉCISÉMENT quel jeu vient de se terminer (v1.12.0) : le défi quotidien exige
// désormais les deux jeux tirés au sort du jour, pas deux jeux au hasard parmi les 13.
function markMiniGameCompleted(gameKey){
  ensureDailyState();
  dailyState.miniGamesCompletedToday = (dailyState.miniGamesCompletedToday || 0) + 1;
  if(dailyState.challengeGames && dailyState.challengeGames.includes(gameKey)){
    dailyState.challengeGamesDone[gameKey] = true;
  }
  saveDailyState();
  checkDailyChallenge();
}

// Défi quotidien (relevé en v1.10.0, affiné en v1.12.0, et de nouveau en v1.14.1) : au départ un
// "ou" entre les deux voies — Maxime a constaté qu'une grosse session de 100 réponses suffisait
// à elle seule à décrocher le défi, sans jamais toucher aux mini-jeux, ce qui vidait de son sens
// l'objectif de variété fixé en v1.12.0. Passé en "et" : objectif XP + les deux jeux du jour
// terminés, ET 100 réponses vocabulaire — les deux voies sont désormais complémentaires, plus
// alternatives.
function checkDailyChallenge(){
  if(dailyState.challengeRewardedToday) return;
  const gamesToday = dailyState.challengeGames || [];
  const gamesDoneCount = gamesToday.filter(k => dailyState.challengeGamesDone && dailyState.challengeGamesDone[k]).length;
  const viaGames = isGoalReached() && gamesToday.length > 0 && gamesDoneCount >= gamesToday.length;
  const viaVolume = (dailyState.answeredToday || 0) >= DAILY_CHALLENGE_MIN_ANSWERS;
  if(!viaGames || !viaVolume) return;
  dailyState.challengeRewardedToday = true;
  saveDailyState();
  if(sessionStats.pauseTokens < PAUSE_TOKEN_CAP){
    sessionStats.pauseTokens += 1;
    sessionStats.pauseTokenJustEarned = true; // réutilise la bannière déjà existante (v0.16.0)
    sessionStats.pauseTokenEarnedVia = 'challenge'; // distingue du gain par palier de série
    saveStats();
  }
}

function getEnduranceLevel(){
  let level = 1;
  for(let i = 0; i < ENDURANCE_LEVELS.length; i++){
    if(xpState.enduranceXP >= ENDURANCE_LEVELS[i]) level = i + 1;
  }
  const idx = level - 1;
  const nextThreshold = ENDURANCE_LEVELS[idx + 1] ?? null;
  const currentThreshold = ENDURANCE_LEVELS[idx];
  return { level, nextThreshold, currentThreshold };
}

function recordGameScore(gameKey, scoreSeconds){
  const prev = gameRecords[gameKey];
  const isNewRecord = (prev === undefined) || scoreSeconds < prev;
  if(isNewRecord){
    gameRecords[gameKey] = scoreSeconds;
    saveGameRecords();
  }
  return isNewRecord;
}

// Symétrique de recordGameScore, pour les jeux notés en points où plus haut = meilleur
// (ex. Remise en ordre, où le temps n'a pas de sens vu les 3 niveaux de difficulté au choix).
function recordGameScoreHigh(gameKey, score){
  const prev = gameRecords[gameKey];
  const isNewRecord = (prev === undefined) || score > prev;
  if(isNewRecord){
    gameRecords[gameKey] = score;
    saveGameRecords();
  }
  return isNewRecord;
}

/* ============================================================
   CHRONOMÈTRE DE TEMPS ACTIF
   Ne compte que le temps passé sur les écrans d'exercice, et seulement
   quand l'onglet est visible ET qu'il y a eu une interaction récente.
   ============================================================ */
let timerOnExerciseScreen = false; // on est sur un écran compté
let timerRunningSince = null;      // timestamp du début du segment en cours (null = en pause)
let timerIdleId = null;
let timerFlushId = null;

function timerFlush(){
  if(timerRunningSince === null) return;
  const now = Date.now();
  const elapsed = Math.round((now - timerRunningSince) / 1000);
  timerRunningSince = now; // on repart du point de flush, sans perdre le reliquat
  if(elapsed <= 0) return;
  ensureDailyState();
  dailyState.activeSeconds = (dailyState.activeSeconds || 0) + elapsed;
  sessionStats.totalActiveSeconds = (sessionStats.totalActiveSeconds || 0) + elapsed;
  saveDailyState();
  saveStats();
}

function timerResume(){
  if(!timerOnExerciseScreen) return;
  if(document.hidden) return;
  if(timerRunningSince !== null) return;
  timerRunningSince = Date.now();
  if(!timerFlushId) timerFlushId = setInterval(timerFlush, TIMER_FLUSH_MS);
}

function timerPause(){
  timerFlush();
  timerRunningSince = null;
  if(timerFlushId){ clearInterval(timerFlushId); timerFlushId = null; }
}

function timerArmIdle(){
  if(timerIdleId) clearTimeout(timerIdleId);
  timerIdleId = setTimeout(() => { timerPause(); }, IDLE_TIMEOUT_MS);
}

function timerEnterExercise(){
  timerOnExerciseScreen = true;
  timerResume();
  timerArmIdle();
}

function timerLeaveExercise(){
  timerPause();
  timerOnExerciseScreen = false;
  if(timerIdleId){ clearTimeout(timerIdleId); timerIdleId = null; }
}

// Toute interaction relance le compteur : sort de l'état "inactif" et réarme le délai.
['keydown','pointerdown','click'].forEach(evt => {
  document.addEventListener(evt, () => {
    if(!timerOnExerciseScreen) return;
    timerResume();
    timerArmIdle();
  }, { passive:true });
});

document.addEventListener('visibilitychange', () => {
  if(document.hidden) timerPause();
  else if(timerOnExerciseScreen) { timerResume(); timerArmIdle(); }
});

// Dernière chance d'écrire avant fermeture de l'onglet
window.addEventListener('beforeunload', () => { timerFlush(); });

function formatDuration(totalSeconds){
  const s = Math.max(0, Math.round(totalSeconds || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if(h > 0) return `${h} h ${String(m).padStart(2,'0')}`;
  if(m > 0) return `${m} min`;
  return `${s} s`;
}


function updateStreak(){
  // migration défensive : anciennes sauvegardes sans les champs jetons de pause
  if(sessionStats.pauseTokens === undefined) sessionStats.pauseTokens = 0;
  if(sessionStats.lastTokenAwardStreak === undefined) sessionStats.lastTokenAwardStreak = 0;
  if(sessionStats.vacationStart === undefined) sessionStats.vacationStart = null;
  if(sessionStats.vacationEnd === undefined) sessionStats.vacationEnd = null;

  const today = todayStr();
  if(sessionStats.lastActiveDate === today) return;

  if(sessionStats.lastActiveDate){
    const gap = daysBetween(sessionStats.lastActiveDate, today); // 1 = hier, 3 = week-end typique (ven.->lun.), ...
    const missedDays = gap - 1; // nb de jours calendaires réellement sautés entre les deux
    // Mode vacances (v1.9.0) : une fenêtre déclarée À L'AVANCE (voir declareVacation()) pour une
    // absence planifiée (vacances, formation) — distinct des jetons de pause, pensés pour des
    // trous plus courts et imprévus. Exemption accordée seulement si TOUTE la période sautée
    // (pas juste une partie) tombe dans la fenêtre déclarée — sinon on retombe sur la logique
    // normale (jetons ou reset), plus prudente qu'un calcul de recouvrement partiel.
    let coveredByVacation = false;
    if(missedDays >= 1 && sessionStats.vacationStart && sessionStats.vacationEnd){
      const missedStart = addDaysStr(sessionStats.lastActiveDate, 1);
      const missedEnd = addDaysStr(today, -1);
      coveredByVacation = missedStart >= sessionStats.vacationStart && missedEnd <= sessionStats.vacationEnd;
    }
    if(gap === 1){
      sessionStats.streakDays += 1;
    } else if(coveredByVacation){
      sessionStats.streakDays += 1; // absence couverte par le mode vacances : aucun jeton consommé
    } else if(missedDays >= 1 && sessionStats.pauseTokens >= missedDays){
      // 1 jeton PAR JOUR manqué (v1.14.3) — remplace l'ancien "1 jeton couvre le trou entier
      // jusqu'à 2 jours d'un coup". Un long week-end reste couvrable si assez de jetons sont en
      // stock (le défi quotidien en fait gagner plus facilement désormais) — juste à un coût réel,
      // pas un forfait fixe. Le plafond PAUSE_TOKEN_CAP borne déjà naturellement l'absence
      // maximale couvrable en une fois, plus besoin d'un second seuil séparé.
      sessionStats.pauseTokens -= missedDays;
      sessionStats.streakDays += 1;
      sessionStats.pauseTokenJustUsed = true;
    } else {
      sessionStats.streakDays = 1;
    }
  } else {
    sessionStats.streakDays = 1;
  }

  // Nettoyage : une fois la fenêtre de vacances dépassée, on l'efface — usage ponctuel, pas
  // question de laisser une vieille déclaration traîner et couvrir une absence future sans rapport.
  if(sessionStats.vacationEnd && today > sessionStats.vacationEnd){
    sessionStats.vacationStart = null;
    sessionStats.vacationEnd = null;
  }

  // Attribution d'un nouveau jeton tous les PAUSE_TOKEN_INTERVAL jours de série (plafonné à PAUSE_TOKEN_CAP)
  if(sessionStats.streakDays > 0
     && sessionStats.streakDays % PAUSE_TOKEN_INTERVAL === 0
     && sessionStats.streakDays !== sessionStats.lastTokenAwardStreak
     && sessionStats.pauseTokens < PAUSE_TOKEN_CAP){
    sessionStats.pauseTokens += 1;
    sessionStats.lastTokenAwardStreak = sessionStats.streakDays;
    sessionStats.pauseTokenJustEarned = true;
    sessionStats.pauseTokenEarnedVia = 'streak';
  }

  sessionStats.lastActiveDate = today;
  sessionStats.totalDaysActive = (sessionStats.totalDaysActive || 0) + 1;
  saveStats();
}

// Déclare une absence planifiée (vacances, formation) : tant que TOUTE l'absence tombe dans
// cette fenêtre, la série n'est pas cassée à ton retour, sans consommer de jeton de pause.
function declareVacation(start, end){
  sessionStats.vacationStart = start;
  sessionStats.vacationEnd = end;
  saveStats();
}
function cancelVacation(){
  sessionStats.vacationStart = null;
  sessionStats.vacationEnd = null;
  saveStats();
}

function declareVacationUI(){
  const startEl = document.getElementById('vacation-start-input');
  const endEl = document.getElementById('vacation-end-input');
  const errorEl = document.getElementById('vacation-error');
  const start = startEl.value, end = endEl.value;
  let error = null;
  if(!start || !end) error = 'Choisis une date de début et une date de fin.';
  else if(end < start) error = 'La date de fin doit être après la date de début.';
  else if(end < todayStr()) error = 'Cette période est déjà passée.';
  if(error){
    if(errorEl) errorEl.textContent = error;
    return;
  }
  declareVacation(start, end);
  renderNiveau();
}

function cancelVacationUI(){
  cancelVacation();
  renderNiveau();
}
