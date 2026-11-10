/* ============================================================
   DASHBOARD NIVEAU — estimation CECRL heuristique + stats + badges
   ============================================================ */
function estimateCECRL(){
  // Compréhension ÉCRITE : basée sur les mots ancrés (boîte 3+) et fiches de grammaire terminées.
  // Aucun contenu audio dans l'appli — ne mesure et ne peut mesurer que l'écrit.
  const anchored = VOCAB.filter(v => vocabProgress[v.id] && vocabProgress[v.id].box >= 3).length;
  const grammarDone = GRAMMAR.filter(g => grammarProgress[g.id]).length;
  const compScore = Math.min(100, Math.round((anchored / 250) * 70 + (grammarDone / GRAMMAR.length) * 30));

  // Expression ÉCRITE : basée sur les phrases Small Talk maîtrisées et les mots produits activement
  // (boîte 4+) — tapés, jamais parlés. Même limite : rien sur l'oral.
  const totalPhrases = SMALLTALK.reduce((s,t)=>s+t.phrases.length, 0);
  const knownPhrases = Object.values(smalltalkProgress).filter(Boolean).length;
  const produced = VOCAB.filter(v => vocabProgress[v.id] && vocabProgress[v.id].box >= 4).length;
  const exprScore = Math.min(100, Math.round((knownPhrases / totalPhrases) * 55 + (produced / 200) * 45));

  function label(score){
    if(score < 15) return 'A1 débutant';
    if(score < 35) return 'A1';
    if(score < 55) return 'A1+ / A2 en approche';
    if(score < 75) return 'A2';
    if(score < 90) return 'A2 solide';
    return 'A2+ / B1 en approche';
  }
  return {
    comprehension: { score: compScore, label: label(compScore) },
    expression: { score: exprScore, label: label(exprScore) },
  };
}

let niveauTab = 'resume'; // onglet affiché dans « Moi » : resume | passeport | badges | donnees
function setNiveauTab(t){ niveauTab = t; renderNiveau(); window.scrollTo(0, 0); }

function renderNiveau(){
  const est = estimateCECRL();
  const earned = getEarnedBadges();
  const earnedIds = new Set(earned.map(b=>b.id));
  const { level, nextThreshold } = getEnduranceLevel();
  const familyNames = { palier:'Paliers (lieux du Luxembourg)', serie:'Séries', arcade:'Arcade (spécialités)', incongru:'Records incongrus' };
  const families = ['palier','serie','arcade','incongru'];
  // Le jour courant n'est pas encore dans dailyHistory (archivé seulement au changement de date),
  // il faut donc l'ajouter à la main au total de la semaine en cours.
  const thisWeek = aggregateWeek(mondayOf(todayStr()), true); // true = inclut la journée en cours
  const masteryPool = getMasteredPool();

  const badgeFamilyHtml = families.map(f => `
    <div class="family-block">
      <div class="family-name">${familyNames[f]}</div>
      <div class="medallion-wrap">
        ${BADGES.filter(b=>b.family===f).map(b => {
          const has = earnedIds.has(b.id);
          return `<div class="medallion-item">
            <span class="coin sm ${has ? '' : 'locked'}">${b.icon}<span class="medallion-tooltip"><b>${b.name}</b><br>${b.desc}${has ? '' : ' (verrouillé)'}</span></span>
            <span class="medallion-name">${b.name}</span>
          </div>`;
        }).join('')}
      </div>
    </div>`).join('');

  const todaySuccess = dailyState.answeredToday ? Math.round(dailyState.correctToday / dailyState.answeredToday * 100) + '%' : '—';
  const globalSuccess = sessionStats.totalAnswered ? Math.round(sessionStats.totalCorrect / sessionStats.totalAnswered * 100) + '%' : '—';
  const gaugeCirc = 157; // 2πr avec r=25

  const vacationActive = !!(sessionStats.vacationStart && sessionStats.vacationEnd);
  const vacationHtml = `
    <details class="moi-details" ${vacationActive ? 'open' : ''}>
      <summary><b>Mode vacances / formation</b><small>${vacationActive ? `actif jusqu'au ${formatDayFR(sessionStats.vacationEnd)}` : 'protège ta série pendant une absence'}</small></summary>
      <div class="onboard-warning" style="margin:10px 0 0;">
      ${vacationActive ? `
        <p><strong>🌴 Mode vacances actif</strong> : du ${formatDayFR(sessionStats.vacationStart)} au ${formatDayFR(sessionStats.vacationEnd)}. Ta série ne cassera pas pendant cette période, sans consommer de jeton.</p>
        <button class="btn btn-ghost" onclick="cancelVacationUI()">Annuler</button>
      ` : `
        <p>Déclare une absence planifiée à l'avance (vacances, formation) pour que ta série ne casse pas à ton retour. C'est distinct des jetons de pause, qui couvrent les imprévus plus courts.</p>
        <div class="cta-row" style="margin-top:10px; flex-wrap:wrap;">
          <input type="date" id="vacation-start-input" class="onboard-input" style="flex:0 0 auto; min-width:0;">
          <input type="date" id="vacation-end-input" class="onboard-input" style="flex:0 0 auto; min-width:0;">
          <button class="btn btn-primary" onclick="declareVacationUI()">Déclarer</button>
        </div>
        <p class="feedback wrong" id="vacation-error" style="margin-top:8px;"></p>
      `}
      </div>
    </details>`;

  const row = (title, sub, onclick, disabled) => `<button class="moi-row" onclick="${onclick}" ${disabled ? 'disabled' : ''}><span class="moi-row-t"><b>${title}</b><small>${sub}</small></span><i class="chev" aria-hidden="true"></i></button>`;

  const tabs = [['resume', 'Résumé'], ['passeport', 'Passeport'], ['badges', 'Badges'], ['donnees', 'Données']];
  const header = `
    <div class="screen-hdr">
      <div class="screen-hdr-t"><h2 class="d">Moi</h2><span class="sub">${escapeHtml(userProfile.name || '')} · niveau ${level}</span></div>
      <button class="gear-btn" onclick="switchView('parametres')" aria-label="Paramètres"><svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M12 3 V6 M12 18 V21 M3 12 H6 M18 12 H21 M5.6 5.6 L7.7 7.7 M16.3 16.3 L18.4 18.4 M18.4 5.6 L16.3 7.7 M7.7 16.3 L5.6 18.4" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg></button>
    </div>
    <div class="seg" role="tablist" aria-label="Sections">${tabs.map(([k, l]) => `<button role="tab" class="${niveauTab === k ? 'on' : ''}" aria-selected="${niveauTab === k}" onclick="setNiveauTab('${k}')">${l}</button>`).join('')}</div>`;

  let content = '';
  if(niveauTab === 'passeport'){
    content = stampsPassportHTML();
  } else if(niveauTab === 'badges'){
    content = `<div class="moi-count">${earned.length} / ${BADGES.length} badges</div>${badgeFamilyHtml}`;
  } else if(niveauTab === 'donnees'){
    content = `
      <div class="settings-card">
        <div class="settings-title">Sauvegarde</div>
        <p class="storage-note">
          Stockage automatique actif : ${usingLocalStorageBackend() ? 'localStorage de ce navigateur' : 'claude.ai'}.
          ${usingLocalStorageBackend() ? 'Ta progression est déjà conservée sans rien faire tant que tu rouvres l\'app depuis ce même navigateur. Le bouton ci-dessous te donne une copie de secours portable.' : ''}
        </p>
        <div class="vocab-hub-cta">
          <button class="btn btn-secondary" onclick="exportBackup()">Télécharger une sauvegarde</button>
          <button class="btn btn-secondary" onclick="triggerImportBackup()">Restaurer une sauvegarde</button>
        </div>
        <div class="feedback" id="backup-status" style="display:block;"></div>
      </div>
      <div class="moi-list">${row('Paramètres', 'compte, sons, objectif, rappel de sauvegarde', "switchView('parametres')")}</div>`;
  } else {
    content = `
      <div class="cecrl-row">
        <div class="cecrl-tile">
          <svg class="gauge" viewBox="0 0 60 60" aria-hidden="true">
            <circle class="gauge-track" cx="30" cy="30" r="25"/>
            <circle class="gauge-fill" cx="30" cy="30" r="25" stroke-dasharray="${gaugeCirc}" stroke-dashoffset="${gaugeCirc - (est.comprehension.score/100)*gaugeCirc}"/>
          </svg>
          <div>
            <div class="assid-lbl">Compréhension écrite</div>
            <div class="compact-title" style="font-size:16px;">${est.comprehension.label}</div>
          </div>
        </div>
        <div class="cecrl-tile">
          <svg class="gauge" viewBox="0 0 60 60" aria-hidden="true">
            <circle class="gauge-track" cx="30" cy="30" r="25"/>
            <circle class="gauge-fill gold" cx="30" cy="30" r="25" stroke-dasharray="${gaugeCirc}" stroke-dashoffset="${gaugeCirc - (est.expression.score/100)*gaugeCirc}"/>
          </svg>
          <div>
            <div class="assid-lbl">Expression écrite</div>
            <div class="compact-title" style="font-size:16px;">${est.expression.label}</div>
          </div>
        </div>
      </div>
      <details class="moi-details"><summary><b>À propos de cette estimation</b></summary><div class="disclaimer" style="margin-top:8px;">Estimation heuristique basée sur ta progression dans l'appli : ce n'est pas une évaluation certifiée CECRL. Elle ne couvre que l'écrit, faute de contenu audio. Seul un test officiel (ex. INL) fait foi.</div></details>

      <div class="moi-stats">
        <div class="moi-stat"><b>${sessionStats.streakDays}</b><span>jours de suite</span></div>
        <div class="moi-stat"><b>${globalSuccess}</b><span>réussite</span></div>
        <div class="moi-stat"><b>${formatDuration(thisWeek.seconds)}</b><span>cette semaine</span></div>
      </div>

      <div class="section-title">Genre et règle du n</div>
      ${rulePanelHTML()}

      <div class="moi-list">
        ${row('Ma semaine en cours', `${thisWeek.activeDays} jour${thisWeek.activeDays > 1 ? 's' : ''} pratiqué${thisWeek.activeDays > 1 ? 's' : ''} · bilan et objectif`, 'openCurrentWeekReview()')}
        ${row('Révision des acquis', `${masteryPool.length} mots en boîte 4-5`, 'startMasterySession()', masteryPool.length === 0)}
        ${row('Test de placement', 'repérer les mots que tu connais déjà', 'startPlacementTest()')}
        ${hasEntitlement('course') ? row('Cours de luxembourgeois', 'révisions des leçons de l\'ACD', "switchView('course')") : ''}
      </div>
      ${vacationHtml}

      <details class="moi-details"><summary><b>Toutes mes statistiques</b><small>temps, activité, XP, jetons</small></summary>
        <div class="assid-grid" style="margin-top:10px;">
          <div class="assid-tile">
            <div class="assid-title">Série</div>
            <div class="assid-big"><span class="assid-num">${sessionStats.streakDays}</span><span class="assid-lbl">jours de suite</span></div>
            <div class="assid-row"><span class="assid-lbl">🛡️ Jetons de pause</span><span class="assid-num">${sessionStats.pauseTokens}/${PAUSE_TOKEN_CAP}</span></div>
          </div>
          <div class="assid-tile">
            <div class="assid-title">Temps d'exercice</div>
            <div class="assid-row"><span class="assid-lbl">Total</span><span class="assid-num">${formatDuration(sessionStats.totalActiveSeconds)}</span></div>
            <div class="assid-row"><span class="assid-lbl">Cette semaine</span><span class="assid-num">${formatDuration(thisWeek.seconds)}</span></div>
            <div class="assid-row"><span class="assid-lbl">Aujourd'hui</span><span class="assid-num">${formatDuration(dailyState.activeSeconds || 0)}</span></div>
          </div>
          <div class="assid-tile">
            <div class="assid-title">Réussite</div>
            <div class="assid-row"><span class="assid-lbl">Aujourd'hui</span><span class="assid-num">${todaySuccess}</span></div>
            <div class="assid-row"><span class="assid-lbl">Globale</span><span class="assid-num">${globalSuccess}</span></div>
          </div>
          <div class="assid-tile">
            <div class="assid-title">Activité</div>
            <div class="assid-row"><span class="assid-lbl">Jours utilisés</span><span class="assid-num">${sessionStats.totalDaysActive || 0}</span></div>
            <div class="assid-row"><span class="assid-lbl">Sessions</span><span class="assid-num">${sessionStats.totalSessions || 0}</span></div>
            <div class="assid-row"><span class="assid-lbl">Révisions totales</span><span class="assid-num">${sessionStats.totalReviews}</span></div>
          </div>
          <div class="assid-tile">
            <div class="assid-title">XP</div>
            <div class="assid-row"><span class="assid-lbl">Niveau</span><span class="assid-num">${level}</span></div>
            <div class="assid-row"><span class="assid-lbl">Endurance</span><span class="assid-num">${xpState.enduranceXP}</span></div>
            <div class="assid-row"><span class="assid-lbl">Arcade</span><span class="assid-num">${xpState.arcadeXP}</span></div>
            <div class="assid-row"><span class="assid-lbl">${nextThreshold ? `Avant niveau ${level+1}` : 'Niveau max atteint'}</span><span class="assid-num" style="color:var(--gold-ink);">${nextThreshold ? `${nextThreshold - xpState.enduranceXP} XP` : '—'}</span></div>
          </div>
        </div>
      </details>`;
  }
  document.getElementById('niveau-container').innerHTML = header + `<div class="moi-body">${content}</div>`;
}
