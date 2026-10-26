/* ============================================================
   NAVIGATION
   ============================================================ */
function switchView(name){
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t=>t.classList.remove('active'));
  const viewMap = { home:'view-home', vocab:'view-vocab', 'vocab-list':'view-vocab-list', 'vocab-enrich':'view-vocab-enrich', 'grammar-list':'view-grammar-list', 'grammar-detail':'view-grammar-detail', 'phrase-drill':'view-phrase-drill', flash:'view-flash', truefalse:'view-truefalse', 'smalltalk-list':'view-smalltalk-list', memory:'view-memory', intrus:'view-intrus', horloge:'view-horloge', article:'view-article', imagedesc:'view-imagedesc', interrogatif:'view-interrogatif', connecteur:'view-connecteur', timeline:'view-timeline', anagramme:'view-anagramme', dialogue:'view-dialogue', niveau:'view-niveau', parametres:'view-parametres', placement:'view-placement', course:'view-course' };
  document.getElementById(viewMap[name]).classList.add('active');
  const tabKey = (name === 'grammar-detail') ? 'grammar-list' : (name === 'phrase-drill' && pdReturnView === 'smalltalk-list') ? 'smalltalk-list' : (name === 'vocab-list') ? 'vocab' : name;
  document.querySelectorAll(`.nav-tab[data-view="${tabKey}"]`).forEach(t => t.classList.add('active'));
  if(name === 'home') renderHome();
  if(name === 'vocab') renderVocabHub();
  if(name === 'vocab-list') renderVocabList();
  if(name === 'grammar-list') renderGrammarList();
  if(name === 'smalltalk-list') renderThemeList();
  if(name === 'niveau') renderNiveau();
  if(name === 'parametres') renderParametres();
  if(name === 'vocab-enrich') renderVocabEnrich();
  if(name === 'course') renderCourse();
  // Chrono : on quitte systématiquement l'état "exercice", puis on le réactive si la vue est comptée.
  // 'vocab' est volontairement exclu ici — c'est le hub ; startVocabSession() rallume le chrono après coup.
  timerLeaveExercise();
  if(TIMED_VIEWS.has(name)) timerEnterExercise();
  window.scrollTo(0,0);
}

document.querySelectorAll('.nav-tab').forEach(tab=>{
  tab.addEventListener('click', ()=> switchView(tab.dataset.view));
});

/* ============================================================
   RENDU — HOME
   ============================================================ */
function escapeHtml(value){
  return String(value ?? '').replace(/[&<>'"]/g, char => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;'
  })[char]);
}

function renderHome(){
  ensureDailyState();
  const safeUserName = escapeHtml(userProfile.name || '');

  document.getElementById('hero-section').innerHTML = !userProfile.name ? `
    <h1>Moien !</h1>
    <p>Comment tu t'appelles ? Ça permet de personnaliser ton suivi (ta progression reste privée, propre à toi).</p>
    <div class="onboard-row">
      <input type="text" class="onboard-input" id="onboard-name-input" placeholder="Ton prénom" autocomplete="off" autocapitalize="words" autocorrect="off" spellcheck="false" enterkeyhint="done" maxlength="60">
      <button class="btn btn-primary" onclick="submitOnboardingName()">Commencer</button>
    </div>
  ` : !userProfile.onboardingDone ? `
    <h1>Avant de commencer, ${safeUserName}</h1>
    <div class="onboard-warning">
      <p><strong>⚠️ Important — comment ta progression est conservée</strong></p>
      <p>Ta progression est enregistrée sur cet appareil, dans cette app, sans compte ni serveur.</p>
      <ul>
        <li>Si tu changes d'appareil ou d'adresse, elle ne te suit pas toute seule : télécharge une sauvegarde (écran Niveau → Sauvegarde) et restaure-la sur le nouvel appareil.</li>
        <li>Ne vide <strong>jamais</strong> les données du site ou de l'app dans les réglages de ton navigateur ou de ton téléphone : ça efface tout, sans recours.</li>
        <li>Télécharge une sauvegarde de temps en temps : l'app te le rappellera.</li>
      </ul>
    </div>
    <p style="margin-top:18px;">Une dernière question avant de démarrer :</p>
    <p class="sentence-fr" style="margin:4px 0 14px;">As-tu déjà quelques bases en luxembourgeois ?</p>
    <div class="cta-row" style="justify-content:center;">
      <button class="btn btn-primary" onclick="finishOnboarding(true)">Oui, un peu</button>
      <button class="btn btn-secondary" onclick="finishOnboarding(false)">Non, je débute</button>
    </div>
  ` : `
    <h1>Moien, ${safeUserName}.</h1>
    <p>Apprends le luxembourgeois pour te débrouiller en conversation, au travail comme ailleurs.</p>
  `;
  if(!userProfile.name){
    const input = document.getElementById('onboard-name-input');
    input.focus();
    input.addEventListener('keydown', (e)=>{ if(e.key === 'Enter') submitOnboardingName(); });
  }
  if(!userProfile.name || !userProfile.onboardingDone) return; // écrans d'accueil : pas de dashboard tant que ce n'est pas terminé

  let pauseTokenBanner = '';
  if(sessionStats.pauseTokenJustUsed){
    pauseTokenBanner = `<div class="pause-token-banner">🛡️ Jeton de pause utilisé — ta série continue. Il t'en reste ${sessionStats.pauseTokens}.</div>`;
    sessionStats.pauseTokenJustUsed = false;
    saveStats();
  } else if(sessionStats.pauseTokenJustEarned){
    const viaChallenge = sessionStats.pauseTokenEarnedVia === 'challenge';
    const msg = viaChallenge
      ? `🎯 Défi du jour réussi — +1 jeton de pause ! Tu en as ${sessionStats.pauseTokens} en réserve.`
      : `🛡️ Nouveau jeton de pause gagné ! Tu en as ${sessionStats.pauseTokens} en réserve pour protéger ta série.`;
    pauseTokenBanner = `<div class="pause-token-banner">${msg}</div>`;
    sessionStats.pauseTokenJustEarned = false;
    sessionStats.pauseTokenEarnedVia = null;
    saveStats();
  }
  document.getElementById('pause-token-banner').innerHTML = pauseTokenBanner;

  // Rappel de sauvegarde : localStorage est la SEULE mémoire pour un usage en fichier local
  // (pas de window.storage hors Claude.ai) — un "vider les données de site" du navigateur
  // l'efface intégralement, sans recours possible. Né d'un incident réel (Maxime a perdu sa
  // progression après un nettoyage de cache Chrome, aucune sauvegarde téléchargée au préalable).
  // Seuil réglable depuis Paramètres (v1.14.0), 7 jours par défaut.
  const backupReminderAfterDays = userProfile.backupReminderDays || 7;
  const BACKUP_REMINDER_GRACE_DAYS = 3; // pas de rappel dès le 1er jour pour un usage tout neuf
  let backupBanner = '';
  if(usingLocalStorageBackend()){
    const daysSince = sessionStats.lastBackupExportAt ? daysBetween(sessionStats.lastBackupExportAt, todayStr()) : null;
    const neverExported = !sessionStats.lastBackupExportAt && (sessionStats.totalDaysActive || 0) >= BACKUP_REMINDER_GRACE_DAYS;
    const staleExport = daysSince !== null && daysSince >= backupReminderAfterDays;
    if(neverExported || staleExport){
      const msg = neverExported
        ? "Tu n'as encore jamais téléchargé de sauvegarde. Ta progression n'existe que dans ce navigateur."
        : `Ça fait ${daysSince} jours depuis ta dernière sauvegarde téléchargée.`;
      backupBanner = `<div class="backup-reminder-banner"><span>💾 ${msg}</span><button class="btn btn-primary" onclick="exportBackup()">Sauvegarder maintenant</button></div>`;
    }
  }
  document.getElementById('backup-reminder-banner').innerHTML = backupBanner;

  // --- bannière de relâchement (v1.16.2, boutons mis à jour en v1.16.3) ---
  const slack = detectSlack();
  let slackBanner = '';
  if(slack){
    const reasonParts = [];
    if(slack.dropPts >= 15) reasonParts.push(`ton taux de réussite récent (${slack.recentRatePct}%) est nettement en dessous de ta moyenne habituelle (${slack.baselineRatePct}%)`);
    if(slack.bigBacklog) reasonParts.push(`${slack.dueCount} mots sont dus en même temps — une vraie pile qui s'est accumulée`);
    const hasDifficultPool = getDifficultPool().length >= DIFFICULT_POOL_MIN_SIZE;
    const hasConfidencePool = getConfidencePool().length >= CONFIDENCE_POOL_MIN_SIZE;
    slackBanner = `
      <div class="slack-banner" style="margin-bottom:16px;">
        <p><strong>📉 Un vrai ralentissement, pas une impression</strong></p>
        <p>${reasonParts.join(', et ')}. C'est mécanique — souvent une accumulation de révisions arrivées à échéance en même temps, pas un signe que tu apprends moins bien.</p>
        <div class="cta-row" style="margin-top:10px; flex-wrap:wrap;">
          ${hasDifficultPool ? '<button class="btn btn-secondary" onclick="startDifficultWordsSession()">🎯 Cibler les mots qui coincent</button>' : ''}
          ${hasConfidencePool ? '<button class="btn btn-secondary" onclick="startConfidenceSession()">🌿 Retrouver du terrain connu</button>' : ''}
          <button class="btn btn-secondary" onclick="switchView('niveau')">Faire une vraie pause (mode vacances)</button>
        </div>
      </div>`;
  }
  document.getElementById('slack-banner').innerHTML = slackBanner;

  // ============================================================
  // TABLEAU DE BORD v1.13 — grille bento
  // Les infos redondantes (série, jetons, niveau) sont montées en topbar sous forme de
  // pastilles avec bulle d'info : pas la peine d'une tuile entière pour un chiffre.
  // ============================================================
  const { level, nextThreshold, currentThreshold } = getEnduranceLevel();
  const goalReached = isGoalReached();
  const seen = VOCAB.filter(v => vocabProgress[v.id]).length;
  const mastered = VOCAB.filter(v => vocabProgress[v.id] && vocabProgress[v.id].box === 5).length;
  const due = getReviewQueue().length;

  // --- pastilles de série/jetons (toujours visibles) + pastille avatar (menu) — v1.14.0 ---
  const toNextToken = PAUSE_TOKEN_INTERVAL - (sessionStats.streakDays % PAUSE_TOKEN_INTERVAL || PAUSE_TOKEN_INTERVAL);
  document.getElementById('topbar-stats').innerHTML = `
    <div class="info-pill streak" tabindex="0">🔥 ${sessionStats.streakDays}
      <div class="pill-tooltip"><b>${sessionStats.streakDays} jour${sessionStats.streakDays>1?'s':''} de suite</b>${
        sessionStats.pauseTokens >= PAUSE_TOKEN_CAP
          ? 'Réserve de jetons au maximum.'
          : `Prochain jeton de pause dans ${toNextToken === 0 ? PAUSE_TOKEN_INTERVAL : toNextToken} jour${toNextToken>1?'s':''} (un tous les ${PAUSE_TOKEN_INTERVAL} jours de série).`
      }</div>
    </div>
    <div class="info-pill shield" tabindex="0">🛡️ ${sessionStats.pauseTokens}/${PAUSE_TOKEN_CAP}
      <div class="pill-tooltip"><b>${sessionStats.pauseTokens} jeton${sessionStats.pauseTokens>1?'s':''} de pause</b>1 jeton protège 1 jour d'absence sans casser ta série — un week-end complet en coûte 2, s'il t'en reste assez.</div>
    </div>
  `;
  document.getElementById('avatar-initial').textContent = (userProfile.name || '?').charAt(0).toUpperCase();
  document.getElementById('avatar-menu').innerHTML = `
    <button class="avatar-menu-item" onclick="closeAvatarMenu(); switchView('niveau');">⭐ Niveau</button>
    <button class="avatar-menu-item" onclick="closeAvatarMenu(); switchView('parametres');">⚙️ Paramètres</button>
    <button class="avatar-menu-item" onclick="closeAvatarMenu(); exportBackup();">💾 Sauvegarder maintenant</button>
  `;

  // --- bandeau d'accueil ---
  document.getElementById('hero-section').innerHTML = `
    <div class="hero-band">
      <svg class="hero-contour" viewBox="0 0 400 100" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0,70 Q100,50 200,65 T400,55" fill="none" stroke="#fff" stroke-width="1"/>
        <path d="M0,85 Q100,65 200,80 T400,72" fill="none" stroke="#fff" stroke-width="1"/>
      </svg>
      <div class="hero-text">
        <p class="hero-greeting">Moien</p>
        <h1 class="hero-title">${safeUserName}.</h1>
      </div>
      <div class="hero-side">
        <svg width="38" height="38" viewBox="0 0 40 40" aria-hidden="true" style="display:block; margin:0 0 4px auto;">
          <polygon points="20,4 26,16 20,18 14,16" fill="#ED2939"/>
          <polygon points="36,20 24,26 22,20 24,14" fill="#00A1DE"/>
          <polygon points="20,36 14,24 20,22 26,24" fill="#ED2939"/>
          <polygon points="4,20 16,14 18,20 16,26" fill="#00A1DE"/>
        </svg>
        Lëtzebuerg
      </div>
    </div>`;

  // --- bento ---
  const answersProgress = Math.min(dailyState.answeredToday || 0, DAILY_CHALLENGE_MIN_ANSWERS);
  let challengeTile;
  if(dailyState.challengeRewardedToday){
    challengeTile = `
      <div class="bento-tile tile-challenge done">
        <div>
          <div class="dc-eyebrow">🏆 Défi du jour réussi</div>
          <p style="font-size:13px; color:var(--ink-soft); margin:0;">Jeton de pause gagné — à demain pour un nouveau défi.</p>
        </div>
      </div>`;
  } else {
    const gamesToday = dailyState.challengeGames || [];
    const chips = gamesToday.map(k => {
      const done = !!(dailyState.challengeGamesDone && dailyState.challengeGamesDone[k]);
      return `<button class="dc-chip ${done ? 'done' : ''}" onclick="${DAILY_CHALLENGE_GAME_LAUNCHERS[k]}">
        <span class="dc-chip-dot">${done ? '✓' : '▸'}</span> ${DAILY_CHALLENGE_GAME_TITLES[k]}
      </button>`;
    }).join('');
    challengeTile = `
      <div class="bento-tile tile-challenge">
        <div>
          <div class="dc-eyebrow">🎯 Défi du jour · +1 jeton</div>
          <div class="dc-games">${chips}</div>
          <div class="dc-volume-label" style="margin-bottom:10px;">${goalReached ? '✓ objectif XP du jour atteint' : '+ objectif XP du jour à atteindre'}</div>
        </div>
        <div>
          <div class="dc-or">— et ${DAILY_CHALLENGE_MIN_ANSWERS} réponses vocabulaire —</div>
          <div class="dc-volume-label">${answersProgress}/${DAILY_CHALLENGE_MIN_ANSWERS}</div>
          <div class="dc-mini-bar"><div class="dc-mini-bar-fill" style="width:${answersProgress/DAILY_CHALLENGE_MIN_ANSWERS*100}%;"></div></div>
        </div>
      </div>`;
  }

  const dailyPct = Math.min(100, Math.round((dailyState.xpToday / DAILY_XP_GOAL) * 100));
  const newWordQuota = getDailyNewWordQuota();
  const newWordPct = newWordQuota ? Math.min(100, Math.round((dailyState.newWordsToday / newWordQuota) * 100)) : 0;
  // ARCADE_DAILY_REFERENCE n'est pas un plafond réel (l'Arcade n'en a pas) : juste une échelle
  // visuelle pour donner un sens à la barre, choisie avec Maxime.
  const arcadeToday = Math.max(0, (dailyState.xpToday || 0) - Math.min(dailyState.xpToday || 0, DAILY_XP_GOAL));
  const arcadePct = Math.min(100, Math.round((arcadeToday / ARCADE_DAILY_REFERENCE) * 100));

  const counts = getBoxCounts();
  const totalInBoxes = Math.max(1, Object.values(counts).reduce((a,b)=>a+b,0));
  const boxColors = {1:'var(--box1)',2:'var(--box2)',3:'var(--box3)',4:'var(--box4)',5:'var(--box5)'};
  const boxLabels = {1:'B1',2:'B2',3:'B3',4:'B4',5:'Acquis'};
  const segments = [1,2,3,4,5].map(b => {
    const pctSeg = (counts[b] / totalInBoxes) * 100;
    if(pctSeg === 0) return '';
    return `<div class="stacked-seg" style="width:${pctSeg}%; background:${boxColors[b]};" title="${boxLabels[b]} : ${counts[b]} mots">${pctSeg > 7 ? counts[b] : ''}</div>`;
  }).join('');

  document.getElementById('home-bento').innerHTML = `
    ${challengeTile}
    <div class="bento-tile tile-stat"><div class="num">${seen}<span style="font-size:12px; color:var(--muted);">/${VOCAB.length}</span></div><div class="lbl">mots vus</div></div>
    <div class="bento-tile tile-stat"><div class="num">${mastered}</div><div class="lbl">mots maîtrisés</div></div>
    <div class="bento-tile tile-stat"><div class="num">${due}</div><div class="lbl">à réviser</div></div>
    <div class="bento-tile tile-stat"><div class="num">${formatDuration(dailyState.activeSeconds || 0)}</div><div class="lbl">temps aujourd'hui</div></div>
    <div class="bento-tile tile-today">
      <div class="compact-header"><div class="compact-title">Progression du jour</div></div>
      <div class="today-row">
        <div class="today-label"><span>Objectif Endurance</span><span>${Math.min(dailyState.xpToday, DAILY_XP_GOAL)}/${DAILY_XP_GOAL}${goalReached ? ' ✓' : ''}</span></div>
        <div class="today-track"><div class="today-fill" style="width:${dailyPct}%;"></div></div>
      </div>
      <div class="today-row">
        <div class="today-label"><span>Nouveaux mots</span><span>${dailyState.newWordsToday}/${newWordQuota}</span></div>
        <div class="today-track"><div class="today-fill gold" style="width:${newWordPct}%;"></div></div>
      </div>
      <div class="today-row">
        <div class="today-label"><span>XP Arcade aujourd'hui</span><span>${arcadeToday}</span></div>
        <div class="today-track"><div class="today-fill arcade" style="width:${arcadePct}%;"></div></div>
      </div>
    </div>
    <div class="bento-tile tile-boxes">
      <div class="compact-header"><div class="compact-title">Répartition par boîte</div></div>
      <div class="stacked-bar">${segments}</div>
      <div class="boxes-legend">
        ${[1,2,3,4,5].map(b => `<span><span class="legend-dot" style="background:${boxColors[b]};"></span>${boxLabels[b]} ${counts[b]}</span>`).join('')}
      </div>
    </div>
  `;

  // --- actions principales ---
  document.getElementById('home-cta').innerHTML = `
    <button class="cta-primary" onclick="switchView('vocab')">
      <p class="t1">${goalReached ? 'Renforcer le vocabulaire' : 'Réviser le vocabulaire'}</p>
      <p class="t2">${due} mot${due>1?'s':''} dû${due>1?'s':''} · session de ${userProfile.sessionMinutes || DEFAULT_SESSION_MINUTES} min</p>
    </button>
    <button class="cta-secondary" onclick="switchView('smalltalk-list')">
      <p class="t1">💬 Small Talk</p><p class="t2">${SMALLTALK.length} thèmes</p>
    </button>
    <button class="cta-secondary" onclick="switchView('course')">
      <p class="t1">📚 Cours</p><p class="t2">${getCourse().lessons.length} leçons de l'ACD</p>
    </button>
    <button class="cta-secondary" onclick="switchView('grammar-list')">
      <p class="t1">📖 Grammaire</p><p class="t2">${GRAMMAR.length} fiches</p>
    </button>
  `;

  // --- mini-jeux en médaillons ---
  document.getElementById('mini-grid').innerHTML = MINI_GAMES.map(g => {
    const unlocked = isGameUnlocked(g.key);
    const record = (g.record && gameRecords[g.record] !== undefined) ? `${gameRecords[g.record]}${g.recordUnit || 's'}` : '—';
    if(unlocked){
      return `<button class="medallion-item" onclick="${g.fn}">
        <span class="coin ${g.coin}">${g.symbol}<span class="medallion-tooltip"><b>${g.title}</b><br>${g.desc}</span></span>
        <span class="medallion-name">${g.title}</span>
        <span class="medallion-meta">${record}</span>
      </button>`;
    }
    return `<button class="medallion-item" disabled>
      <span class="coin locked">${g.symbol}<span class="medallion-tooltip"><b>${g.title}</b><br>Se débloque au niveau ${GAME_UNLOCK_LEVELS[g.key]}. ${g.desc}</span></span>
      <span class="medallion-name">${g.title}</span>
      <span class="medallion-meta">niv. ${GAME_UNLOCK_LEVELS[g.key]}</span>
    </button>`;
  }).join('');

  // --- badges récents (les 5 derniers obtenus, détail complet dans l'écran Niveau) ---
  const earnedBadges = getEarnedBadges();
  const recentBadges = earnedBadges.slice(-5);
  document.getElementById('home-badges').innerHTML = recentBadges.length ? `
    <div class="badges-section">
      <div class="badges-header">
        <div class="badges-title">Derniers badges</div>
        <div class="badges-count">${earnedBadges.length}/${BADGES.length}</div>
      </div>
      <div class="medallion-wrap">
        ${recentBadges.map(b => `
          <div class="medallion-item">
            <span class="coin sm">${b.icon}<span class="medallion-tooltip"><b>${b.name}</b><br>${b.desc}</span></span>
            <span class="medallion-name">${b.name}</span>
          </div>`).join('')}
      </div>
    </div>` : '';
}

/* ============================================================
   RENDU — HUB VOCABULAIRE (accueil de l'onglet) + LISTE COMPLÈTE
   ============================================================ */
function isVerbCategory(cat){
  return cat === 'Verbes' || cat === 'Verbes modaux';
}

// Renvoie la fiche de grammaire pertinente pour un mot-verbe, ou null si
// la catégorie n'est pas un verbe, ou {none:true} si verbe non couvert par une fiche.
function getConjugationFiche(item){
  if(!isVerbCategory(item.cat)) return null;
  if(item.lu === 'sinn') return GRAMMAR.find(g => g.id === 'g1');
  if(item.lu === 'hunn') return GRAMMAR.find(g => g.id === 'g2');
  if(item.cat === 'Verbes') return GRAMMAR.find(g => g.id === 'g5');
  return { none:true };
}

function getWordStatusInfo(id){
  const e = vocabProgress[id];
  if(!e) return { label:'Nouveau', color:'var(--muted)' };
  if(e.learningStep !== undefined && e.learningStep < 3) return { label:`Apprentissage ${e.learningStep+1}/3`, color:'var(--box1)' };
  if(e.box >= 5) return { label:'Acquis', color:'var(--box5)' };
  return { label:`Boîte ${e.box}`, color:`var(--box${e.box})` };
}

function vocabMinutesCaption(minutes){
  const { sessionCardCount, newWordCeiling } = computeSessionSizing(minutes);
  return `≈ ${sessionCardCount} carte${sessionCardCount>1?'s':''} · jusqu'à ${newWordCeiling} nouveau${newWordCeiling>1?'x':''} mot${newWordCeiling>1?'s':''}`;
}

function renderVocabHub(){
  const seen = VOCAB.filter(v => vocabProgress[v.id]).length;
  const mastered = VOCAB.filter(v => vocabProgress[v.id] && vocabProgress[v.id].box === 5).length;
  const masteryPool = getMasteredPool(); // boîtes 4-5 : périmètre plus large, réservé au bouton de révision ci-dessous
  const masteryPoolDue = masteryPool.filter(v => isDue(v.id)).length;
  const difficultPool = getDifficultPool();
  const confidencePool = getConfidencePool();
  const due = getReviewQueue().length;
  const goalReached = isGoalReached();
  const minutes = userProfile.sessionMinutes || DEFAULT_SESSION_MINUTES;
  const container = document.getElementById('vocab-session-container');
  container.innerHTML = `
    <h2 style="margin-top:0;">Vocabulaire</h2>
    <p class="list-intro">${VOCAB.length} mots, classés par catégorie, avec répétition espacée et learning steps pour les mots tout juste introduits. Une session mélange révisions dues et nouveaux mots.</p>
    <div class="vstat-grid">
      <div class="vstat"><div class="num">${seen}<span style="font-size:12px; color:var(--muted);">/${VOCAB.length}</span></div><div class="lbl">mots vus</div></div>
      <div class="vstat"><div class="num">${mastered}</div><div class="lbl">mots maîtrisés</div></div>
      <div class="vstat"><div class="num">${due}</div><div class="lbl">à réviser aujourd'hui</div></div>
      <div class="vstat"><div class="num">${dailyState.newWordsToday}<span style="font-size:12px; color:var(--muted);">/${getDailyNewWordQuota()}</span></div><div class="lbl">nouveaux mots aujourd'hui</div></div>
    </div>
    <div class="minutes-card">
      <div class="vocab-minutes-row">
        <label for="vocab-minutes-slider">Durée de la session</label>
        <span class="vocab-minutes-value" id="vocab-minutes-value">${minutes} min</span>
      </div>
      <input type="range" id="vocab-minutes-slider" class="vocab-minutes-slider"
        min="${SESSION_MINUTES_RANGE.min}" max="${SESSION_MINUTES_RANGE.max}" step="1" value="${minutes}">
      <div class="vocab-minutes-caption" id="vocab-minutes-caption">${vocabMinutesCaption(minutes)}</div>
    </div>
    <div class="cta-band" style="margin-bottom:10px;">
      <button class="cta-primary" onclick="startVocabSession()">
        <p class="t1">${goalReached ? 'Renforcer (objectif atteint)' : 'Réviser le vocabulaire'}</p>
        <p class="t2">${due} mot${due>1?'s':''} dû${due>1?'s':''} aujourd'hui</p>
      </button>
      <button class="cta-secondary" onclick="switchView('vocab-list')"><p class="t1">Voir la liste complète</p></button>
      <button class="cta-secondary" onclick="switchView('vocab-enrich')"><p class="t1">✏️ Enrichir / modifier</p></button>
    </div>
    <div class="cta-band">
      <button class="cta-secondary" onclick="startMasterySession()" ${masteryPool.length === 0 ? 'disabled' : ''}>
        <p class="t1">🎯 Révision des acquis</p>
        <p class="t2">${masteryPool.length ? `${masteryPoolDue} dû${masteryPoolDue>1?'s':''} sur ${masteryPool.length}` : 'aucun mot en boîte 4-5'}</p>
      </button>
      <button class="cta-secondary" onclick="startPlacementTest()">
        <p class="t1">📋 Test de placement</p>
        <p class="t2">mots jamais rencontrés</p>
      </button>
    </div>
    <div class="cta-band">
      <button class="cta-secondary" onclick="startDifficultWordsSession()" ${difficultPool.length < DIFFICULT_POOL_MIN_SIZE ? 'disabled' : ''}>
        <p class="t1">🎯 Mots difficiles</p>
        <p class="t2">${difficultPool.length >= DIFFICULT_POOL_MIN_SIZE ? `${Math.min(difficultPool.length, DIFFICULT_SESSION_SIZE)} mots ciblés, en boucle` : 'pas encore assez de mots qualifiés'}</p>
      </button>
      <button class="cta-secondary" onclick="startConfidenceSession()" ${confidencePool.length < CONFIDENCE_POOL_MIN_SIZE ? 'disabled' : ''}>
        <p class="t1">🌿 Remise en confiance</p>
        <p class="t2">${confidencePool.length >= CONFIDENCE_POOL_MIN_SIZE ? `${Math.min(confidencePool.length, CONFIDENCE_SESSION_SIZE)} mots déjà maîtrisés, sans pression` : 'encore trop peu de mots en boîte 5'}</p>
      </button>
    </div>
  `;
  const slider = document.getElementById('vocab-minutes-slider');
  slider.addEventListener('input', (e)=>{
    const val = parseInt(e.target.value, 10);
    document.getElementById('vocab-minutes-value').textContent = `${val} min`;
    document.getElementById('vocab-minutes-caption').textContent = vocabMinutesCaption(val);
  });
  slider.addEventListener('change', (e)=>{
    userProfile.sessionMinutes = parseInt(e.target.value, 10);
    saveProfile();
  });
}

/* ============================================================
   RENDU — PARAMÈTRES (v1.14.0)
   ============================================================ */
function renderParametres(){
  const container = document.getElementById('parametres-container');
  const safeUserName = escapeHtml(userProfile.name || '');
  container.innerHTML = `
    <div class="settings-card">
      <div class="settings-title">Prénom</div>
      <div class="settings-desc">Utilisé pour personnaliser l'accueil et l'initiale de ton avatar.</div>
      <div style="display:flex; gap:8px;">
        <input type="text" class="settings-input" id="settings-name-input" value="${safeUserName}" placeholder="Ton prénom" autocapitalize="words" autocorrect="off" spellcheck="false" enterkeyhint="done" maxlength="60">
        <button class="btn btn-primary" onclick="saveSettingsName()">Enregistrer</button>
      </div>
      <div class="feedback" id="settings-name-feedback"></div>
    </div>

    <div class="settings-card">
      <div class="settings-title">Session de vocabulaire par défaut</div>
      <div class="settings-desc">Durée proposée à l'ouverture du hub Vocabulaire.</div>
      <div class="vocab-minutes-row">
        <label for="settings-minutes-slider">Durée</label>
        <span class="vocab-minutes-value" id="settings-minutes-value">${userProfile.sessionMinutes || DEFAULT_SESSION_MINUTES} min</span>
      </div>
      <input type="range" id="settings-minutes-slider" class="vocab-minutes-slider"
        min="${SESSION_MINUTES_RANGE.min}" max="${SESSION_MINUTES_RANGE.max}" step="1" value="${userProfile.sessionMinutes || DEFAULT_SESSION_MINUTES}">
    </div>

    <div class="settings-card">
      <div class="settings-title">Navigation</div>
      <div class="settings-row">
        <div>
          <div class="settings-row-label">Flèches du clavier</div>
          <div class="settings-row-sub">Déplace la sélection sur les écrans à choix multiple (QCM, Vrai/Faux...)</div>
        </div>
        <button class="toggle-switch ${userProfile.keyboardNavEnabled ? 'on' : ''}" id="settings-keyboard-toggle" onclick="toggleKeyboardNavSetting()" aria-label="Navigation au clavier"></button>
      </div>
    </div>

    <div class="settings-card">
      <div class="settings-title">Sauvegarde</div>
      <div class="settings-desc">Stockage automatique actif : ${usingLocalStorageBackend() ? 'localStorage de ce navigateur' : 'claude.ai'}.</div>
      <div class="settings-row">
        <div>
          <div class="settings-row-label">Rappel après</div>
          <div class="settings-row-sub">Nombre de jours sans sauvegarde avant que l'accueil te le rappelle</div>
        </div>
        <select class="settings-select" id="settings-reminder-select" onchange="saveReminderDays(this.value)">
          ${[3,5,7,10,14].map(d => `<option value="${d}" ${userProfile.backupReminderDays===d?'selected':''}>${d} jours</option>`).join('')}
        </select>
      </div>
      <div class="cta-row" id="settings-backup-actions" style="margin-top:10px;">
        <button class="btn btn-secondary" onclick="exportBackup()">Télécharger une sauvegarde</button>
        <button class="btn btn-secondary" onclick="triggerImportBackup()">Restaurer une sauvegarde</button>
      </div>
    </div>

    <div class="settings-card">
      <div class="settings-title">Vocabulaire</div>
      <div class="settings-desc">Télécharger, corriger ou compléter les ${VOCAB.length} mots au format tableur.</div>
      <button class="btn btn-secondary" onclick="switchView('vocab-enrich')">Gérer le vocabulaire</button>
    </div>

    <div class="settings-card">
      <div class="settings-title">Vacances / formation</div>
      <div class="settings-desc">Déclarer une absence planifiée se fait depuis l'écran Niveau, avec les autres réglages liés à la série.</div>
      <button class="btn btn-secondary" onclick="switchView('niveau')">Aller à l'écran Niveau</button>
    </div>

    <div class="settings-card danger">
      <div class="settings-title" style="color:var(--error);">Réinitialiser mes données</div>
      <div class="settings-desc">Efface toute ta progression (vocabulaire, badges, XP, séries...) sur cet appareil, sans recours possible. Télécharge une sauvegarde avant si tu n'es pas sûr.</div>
      <div id="settings-reset-zone">
        <button class="btn btn-secondary" style="border-color:var(--error); color:var(--error);" onclick="showResetConfirm()">Réinitialiser mes données</button>
      </div>
    </div>
  `;

  const slider = document.getElementById('settings-minutes-slider');
  slider.addEventListener('input', (e)=>{
    document.getElementById('settings-minutes-value').textContent = `${e.target.value} min`;
  });
  slider.addEventListener('change', (e)=>{
    userProfile.sessionMinutes = parseInt(e.target.value, 10);
    saveProfile();
  });
}

function saveSettingsName(){
  const input = document.getElementById('settings-name-input');
  const val = (input.value || '').trim();
  const feedback = document.getElementById('settings-name-feedback');
  if(!val || val.length > USER_NAME_MAX_LEN){
    feedback.className = 'feedback wrong';
    feedback.textContent = 'Entre un prénom de 1 à 60 caractères.';
    return;
  }
  if(hasForbiddenNameChars(val)){
    feedback.className = 'feedback wrong';
    feedback.textContent = 'Les caractères < et > ne sont pas autorisés dans le prénom.';
    return;
  }
  userProfile.name = val;
  saveProfile();
  feedback.className = 'feedback correct';
  feedback.textContent = 'Prénom enregistré.';
}

function toggleKeyboardNavSetting(){
  userProfile.keyboardNavEnabled = !userProfile.keyboardNavEnabled;
  saveProfile();
  document.getElementById('settings-keyboard-toggle').classList.toggle('on', userProfile.keyboardNavEnabled);
}

function saveReminderDays(val){
  userProfile.backupReminderDays = parseInt(val, 10);
  saveProfile();
}

// Réinitialisation en 2 temps plutôt qu'un window.confirm() natif — cohérent avec le reste de
// l'app, qui n'utilise jamais de boîte de dialogue navigateur (voir declareVacationUI() pour le
// même choix). Un clic affiche l'avertissement + un second bouton de confirmation explicite.
function showResetConfirm(){
  const zone = document.getElementById('settings-reset-zone');
  zone.innerHTML = `
    <p class="feedback wrong" style="margin:0 0 10px;">Cette action est définitive. Toute ta progression sur cet appareil sera perdue.</p>
    <div class="cta-row">
      <button class="btn btn-secondary" onclick="renderParametres()">Annuler</button>
      <button class="btn btn-primary" style="background:var(--error);" onclick="confirmResetData()">Confirmer la réinitialisation</button>
    </div>
  `;
}

async function confirmResetData(){
  vocabProgress = {}; grammarProgress = {}; smalltalkProgress = {}; courseProgress = {};
  sessionStats = { streakDays:0, lastActiveDate:null, totalReviews:0, totalSessions:0, totalDaysActive:0, pauseTokens:0, lastTokenAwardStreak:0, totalActiveSeconds:0, lastWeeklyReviewWeek:null, totalAnswered:0, totalCorrect:0, lastBackupExportAt:null, vacationStart:null, vacationEnd:null };
  xpState = { enduranceXP:0, arcadeXP:0 };
  dailyState = { date:null, xpToday:0, newWordsToday:0, activeSeconds:0, miniGamesCompletedToday:0, challengeRewardedToday:false, challengeGames:null, challengeGamesDone:{} };
  gameRecords = {};
  dailyHistory = [];
  await Promise.all([
    saveVocabProgress(), saveGrammarProgress(), saveStats(), saveSmalltalkProgress(),
    saveXpState(), saveDailyState(), saveGameRecords(), saveDailyHistory(), saveCourseProgress()
  ]);
  updateStreak(); // sinon streakDays resterait à 0 et lastActiveDate à null jusqu'au prochain rechargement de page
  switchView('home');
}


let vocabListFilters = { q:'', cat:'all', status:'all' };

function renderVocabList(){
  const container = document.getElementById('vocab-list-container');
  const categories = [...new Set(VOCAB.map(v => v.cat))].sort((a,b)=>a.localeCompare(b, 'fr'));
  container.innerHTML = `
    <div class="vocab-list-controls">
      <input type="text" class="vocab-search-input" id="vocab-search-input" placeholder="Chercher un mot (LU ou FR)…" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="search" value="${vocabListFilters.q.replace(/"/g,'&quot;')}">
      <select class="vocab-filter-select" id="vocab-cat-select">
        <option value="all">Toutes les catégories</option>
        ${categories.map(c => `<option value="${c}" ${vocabListFilters.cat===c?'selected':''}>${c}</option>`).join('')}
      </select>
      <select class="vocab-filter-select" id="vocab-status-select">
        <option value="all">Tous les statuts</option>
        <option value="new" ${vocabListFilters.status==='new'?'selected':''}>Nouveau</option>
        <option value="learning" ${vocabListFilters.status==='learning'?'selected':''}>En apprentissage</option>
        <option value="mastered" ${vocabListFilters.status==='mastered'?'selected':''}>Acquis</option>
      </select>
    </div>
    <div class="vocab-list-count" id="vocab-list-count"></div>
    <div class="vocab-table-wrap">
      <table class="vocab-table">
        <thead>
          <tr><th>Lëtzebuergesch</th><th>Français</th><th>Catégorie</th><th>Statut</th><th>Fiche</th></tr>
        </thead>
        <tbody id="vocab-table-body"></tbody>
      </table>
    </div>
  `;
  document.getElementById('vocab-search-input').addEventListener('input', (e)=>{
    vocabListFilters.q = e.target.value;
    renderVocabTableBody();
  });
  document.getElementById('vocab-cat-select').addEventListener('change', (e)=>{
    vocabListFilters.cat = e.target.value;
    renderVocabTableBody();
  });
  document.getElementById('vocab-status-select').addEventListener('change', (e)=>{
    vocabListFilters.status = e.target.value;
    renderVocabTableBody();
  });
  renderVocabTableBody();
}

function renderVocabTableBody(){
  const body = document.getElementById('vocab-table-body');
  const countEl = document.getElementById('vocab-list-count');
  if(!body) return;
  const q = normalize(vocabListFilters.q || '');
  const filtered = VOCAB.filter(v => {
    if(vocabListFilters.cat !== 'all' && v.cat !== vocabListFilters.cat) return false;
    if(q){
      const hay = normalize(v.lu + ' ' + v.fr);
      if(!hay.includes(q)) return false;
    }
    if(vocabListFilters.status !== 'all'){
      const e = vocabProgress[v.id];
      const isNew = !e;
      const isMastered = e && e.box === 5;
      const isLearning = e && e.box < 5;
      if(vocabListFilters.status === 'new' && !isNew) return false;
      if(vocabListFilters.status === 'learning' && !isLearning) return false;
      if(vocabListFilters.status === 'mastered' && !isMastered) return false;
    }
    return true;
  }).sort((a,b) => a.cat.localeCompare(b.cat, 'fr') || a.lu.localeCompare(b.lu, 'fr'));

  countEl.textContent = `${filtered.length} / ${VOCAB.length} mot${filtered.length>1?'s':''} affiché${filtered.length>1?'s':''}`;

  if(filtered.length === 0){
    body.innerHTML = `<tr><td colspan="5" class="vocab-empty-row">Aucun mot ne correspond à ces filtres.</td></tr>`;
    return;
  }

  body.innerHTML = filtered.map(v => {
    const status = getWordStatusInfo(v.id);
    const fiche = getConjugationFiche(v);
    let ficheHtml = '';
    if(fiche && fiche.none){
      ficheHtml = `<span class="vocab-fiche-none">non couvert</span>`;
    } else if(fiche){
      ficheHtml = `<button class="vocab-fiche-link" onclick="openLesson('${fiche.id}')">Voir la fiche →</button>`;
    }
    return `
      <tr>
        <td class="vocab-lu">${v.lu}</td>
        <td>${v.fr}</td>
        <td>${v.cat}</td>
        <td><span class="vocab-status-pill" style="background:${status.color};">${status.label}</span></td>
        <td>${ficheHtml}</td>
      </tr>`;
  }).join('');
}
