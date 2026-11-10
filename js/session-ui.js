/* ============================================================
   ÉCRAN DE SESSION COMMUN (v1.39.0) — vocabulaire et jeux
   Barre du haut (quitter, progression, pastille), compteur « Question 7 / 20 », corps de la question, et un panneau de
   correction en bas (vert ou rouge, avec Roudi) qui contient aussi le bouton « Continuer ».
   Tout texte venant des données passe par escapeHtml() chez l'appelant.
   ============================================================ */

// o : { quit, pct, pill, left, tag, hint, body, cap, panelId, fbId, contId }
function sessionShellHTML(o){
  const pct = Math.max(0, Math.min(100, Math.round(o.pct || 0)));
  return `
    <div class="sess">
      <div class="sess-top">
        <button class="sess-x" onclick="${o.quit}" aria-label="Quitter la session"><svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true"><path d="M5 5 L15 15 M15 5 L5 15" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg></button>
        <div class="sess-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><i style="width:${pct}%"></i></div>
        ${o.pill || ''}
      </div>
      <div class="sess-meta"><span>${o.left || ''}</span><span class="sess-tag">${o.tag || ''}</span></div>
      <div class="sess-body">
        ${o.hint ? `<div class="sess-talk">${ROUDI_SVG('sess-roudi')}<div class="sess-bubble">${escapeHtml(o.hint)}</div></div>` : ''}
        ${o.body}
        ${o.cap ? `<div class="sess-cap">${o.cap}</div>` : ''}
      </div>
      <div class="sess-panel" id="${o.panelId}">
        <div class="feedback" id="${o.fbId}" aria-live="polite"></div>
        <div class="continue-wrap" id="${o.contId}"></div>
      </div>
    </div>`;
}

// Pastille de série (flamme + nombre) pour la barre du haut.
function sessionStreakPill(){
  return `<span class="pill-flame" title="Série en cours"><svg width="16" height="18" viewBox="0 0 20 22" aria-hidden="true"><use href="#flame"/></svg>${sessionStats.streakDays || 0}</span>`;
}

// Affiche la correction dans le panneau : status 'correct' | 'almost' | 'wrong', titre court, corps HTML déjà échappé.
function sessionPanel(panelId, fbId, status, title, bodyHtml){
  const panel = document.getElementById(panelId), fb = document.getElementById(fbId);
  if(!panel || !fb) return;
  panel.className = `sess-panel open ${status}`;
  fb.className = `feedback ${status}`;
  fb.innerHTML = `<div class="fb-head">${ROUDI_SVG('fb-roudi')}<b>${escapeHtml(title)}</b></div><div class="fb-text" id="${fbId}-text">${bodyHtml}</div>`;
}
