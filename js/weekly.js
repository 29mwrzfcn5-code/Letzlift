/* ============================================================
   BILAN HEBDOMADAIRE
   Semaine calendaire lundi→dimanche. La clé d'une semaine est la date de son
   lundi ('YYYY-MM-DD') : plus simple et plus sûr que les numéros de semaine ISO,
   qui ont des cas limites pénibles autour du 1er janvier.
   ============================================================ */

// Agrège les entrées du journal sur la semaine commençant au lundi donné.
// includeToday : la journée en cours n'est JAMAIS dans dailyHistory (archivée seulement au
// changement de date). Sans ce reliquat, tout affichage de la semaine en cours est faux.
function aggregateWeek(mondayStr, includeToday){
  const end = addDaysStr(mondayStr, 6);
  let days = dailyHistory.filter(d => d.date >= mondayStr && d.date <= end);
  if(includeToday){
    const today = todayStr();
    const alreadyThere = days.some(d => d.date === today);
    const live = { date:today, xp:dailyState.xpToday||0, newWords:dailyState.newWordsToday||0,
                   answered:dailyState.answeredToday||0, correct:dailyState.correctToday||0,
                   seconds:dailyState.activeSeconds||0 };
    const hasActivity = live.xp>0 || live.answered>0 || live.seconds>0;
    if(!alreadyThere && hasActivity && today >= mondayStr && today <= end) days = days.concat(live);
  }
  const totals = days.reduce((acc, d) => ({
    xp: acc.xp + (d.xp||0),
    newWords: acc.newWords + (d.newWords||0),
    answered: acc.answered + (d.answered||0),
    correct: acc.correct + (d.correct||0),
    seconds: acc.seconds + (d.seconds||0)
  }), { xp:0, newWords:0, answered:0, correct:0, seconds:0 });
  const bestDay = days.slice().sort((a,b) => (b.xp||0) - (a.xp||0))[0] || null;
  return {
    monday: mondayStr, end, days, ...totals,
    activeDays: days.length,
    successRate: totals.answered ? totals.correct / totals.answered : null,
    bestDay
  };
}

function renderWeeklyDelta(current, previous, unit){
  const diff = (current || 0) - (previous || 0);
  if(diff === 0) return '<div class="weekly-delta down">= semaine précédente</div>';
  const cls = diff > 0 ? 'up' : 'down';
  const sign = diff > 0 ? '+' : '−';
  const value = (unit === 'time') ? formatDuration(Math.abs(diff)) : Math.abs(diff);
  return `<div class="weekly-delta ${cls}">${sign}${value} vs semaine précédente</div>`;
}

function showWeeklyReview(mondayStr, opts){
  const live = !!(opts && opts.live);
  const w = aggregateWeek(mondayStr, live);
  const prev = aggregateWeek(addDaysStr(mondayStr, -7));
  const hasPrev = prev.activeDays > 0;
  const labels = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];
  const doneDates = new Set(w.days.map(d => d.date));
  const today = todayStr();

  const dayStrip = labels.map((lbl, i) => {
    const date = addDaysStr(mondayStr, i);
    // en mode "semaine en cours", les jours à venir restent neutres plutôt que d'apparaître ratés
    const future = live && date > today;
    const cls = doneDates.has(date) ? 'done' : (future ? 'future' : '');
    return `<div class="weekly-day ${cls}">${lbl}</div>`;
  }).join('');

  const elapsed = live ? (daysBetween(mondayStr, today) + 1) : 7;
  let note;
  if(live){
    note = w.activeDays === 0
      ? "Rien d'enregistré cette semaine pour l'instant — le bilan se remplit au fil de tes sessions."
      : `${w.activeDays} jour${w.activeDays>1?'s':''} pratiqué${w.activeDays>1?'s':''} sur les ${elapsed} écoulé${elapsed>1?'s':''} cette semaine.`;
  } else if(w.activeDays >= 5) note = "Semaine très régulière — c'est exactement ce rythme qui fait progresser à l'oral.";
  else if(w.activeDays >= 3) note = "Bonne semaine. La régularité compte plus que la durée des sessions.";
  else note = "Semaine plus légère. Une session courte vaut mieux qu'une longue reportée — reprends tranquillement.";

  document.getElementById('weekly-modal').innerHTML = `
    <h2>${live ? 'Ma semaine en cours' : 'Bilan de la semaine'}</h2>
    <div class="weekly-range">${formatDayFR(w.monday)} → ${formatDayFR(w.end)}</div>
    <div class="weekly-days">${dayStrip}</div>
    <div class="weekly-grid">
      <div class="stat-card">
        <div class="num">${w.activeDays}/${live ? elapsed : 7}</div><div class="lbl">jours pratiqués</div>
        ${hasPrev && !live ? renderWeeklyDelta(w.activeDays, prev.activeDays) : ''}
      </div>
      <div class="stat-card">
        <div class="num">${formatDuration(w.seconds)}</div><div class="lbl">temps d'exercice</div>
        ${hasPrev ? renderWeeklyDelta(w.seconds, prev.seconds, 'time') : ''}
      </div>
      <div class="stat-card">
        <div class="num">${w.newWords}</div><div class="lbl">nouveaux mots</div>
        ${hasPrev ? renderWeeklyDelta(w.newWords, prev.newWords) : ''}
      </div>
      <div class="stat-card">
        <div class="num">${w.xp}</div><div class="lbl">XP gagné</div>
        ${hasPrev ? renderWeeklyDelta(w.xp, prev.xp) : ''}
      </div>
      <div class="stat-card">
        <div class="num">${w.successRate !== null ? Math.round(w.successRate*100)+'%' : '—'}</div>
        <div class="lbl">taux de réussite</div>
      </div>
      <div class="stat-card">
        <div class="num">${w.bestDay ? formatDayFR(w.bestDay.date) : '—'}</div><div class="lbl">meilleur jour</div>
      </div>
    </div>
    <div class="weekly-note">${note}</div>
    <button class="btn btn-primary" onclick="closeWeeklyReview()">${live ? 'Fermer' : 'Continuer'}</button>
  `;
  document.getElementById('weekly-overlay').classList.add('open');
}

// Consultation manuelle : montre la semaine EN COURS (journée du jour incluse),
// là où le déclenchement automatique récapitule la semaine écoulée.
function openCurrentWeekReview(){
  ensureDailyState();
  timerFlush(); // pour que le temps de la session en cours soit compté dans le bilan
  showWeeklyReview(mondayOf(todayStr()), { live:true });
}

function closeWeeklyReview(){
  document.getElementById('weekly-overlay').classList.remove('open');
}

// Déclenchement automatique au premier lancement d'une nouvelle semaine.
function maybeShowWeeklyReview(){
  const currentWeek = mondayOf(todayStr());
  if(sessionStats.lastWeeklyReviewWeek === currentWeek) return;

  const firstRun = !sessionStats.lastWeeklyReviewWeek;
  sessionStats.lastWeeklyReviewWeek = currentWeek;
  saveStats();
  // Au tout premier lancement il n'y a rien à récapituler : on pose seulement le repère.
  if(firstRun) return;

  const lastWeek = addDaysStr(currentWeek, -7);
  if(aggregateWeek(lastWeek).activeDays === 0) return; // semaine vide : pas de bilan démoralisant
  showWeeklyReview(lastWeek);
}
