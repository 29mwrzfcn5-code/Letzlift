/* ============================================================
   ADMINISTRATION (réservée aux comptes de rôle « admin »)
   Aperçu, clés d'accès individuelles, comptes, statistiques d'usage. Toutes les données viennent
   du serveur, qui refuse l'accès aux autres comptes ; tout texte affiché passe par escapeHtml().
   ============================================================ */
let adminState = { tab:'overview', message:null, newKey:null, userQuery:'', days:30, data:{} };

const ADMIN_TABS = [['overview', 'Aperçu'], ['keys', 'Clés d’accès'], ['users', 'Comptes'], ['stats', 'Statistiques']];

async function adminCall(method, path, body){
  if(!syncAuth) throw new Error('Non connecté.');
  const res = await syncClient(syncAuth.url, syncAuth.token).request(method, path, body);
  if(!res.ok) throw new Error((res.body && res.body.error) || 'Erreur du serveur.');
  return res.body;
}

function adminDate(ts){
  return ts ? new Date(ts).toLocaleDateString('fr-LU', { day:'numeric', month:'short', year:'numeric' }) : '—';
}
function adminCardLabel(id){
  if(/^v\d+$/.test(id)){ const v = VOCAB.find(x => x.id === id); if(v) return `${v.lu} (${v.fr})`; }
  if(typeof getCourse === 'function'){ const c = getCourse().byId[id]; if(c) return c.kind === 'letter' ? c.letter : (c.lu || c.answer || id); }
  return id;
}
function adminPct(a, b){ return b ? Math.round(100 * a / b) + ' %' : '—'; }

async function renderAdmin(tab){
  if(tab) adminState.tab = tab;
  const root = document.getElementById('admin-root');
  if(!syncIsAdmin()){
    root.innerHTML = `<button class="back-link" onclick="switchView('parametres')">&larr; Paramètres</button><p class="course-sub">Accès réservé.</p>`;
    return;
  }
  const st = adminState;
  root.innerHTML = `
    <button class="back-link" onclick="switchView('parametres')">&larr; Paramètres</button>
    <h2 class="course-h">Administration</h2>
    <div class="admin-tabs" role="tablist">${ADMIN_TABS.map(([k, label]) => `<button class="btn ${st.tab === k ? 'btn-primary' : 'btn-secondary'}" role="tab" aria-selected="${st.tab === k}" onclick="renderAdmin('${k}')">${label}</button>`).join('')}</div>
    ${st.message ? `<div class="feedback ${st.message.ok ? 'correct' : 'wrong'}" role="alert">${escapeHtml(st.message.text)}</div>` : ''}
    <div id="admin-body"><p class="course-sub">Chargement…</p></div>`;
  try{
    if(st.tab === 'overview') adminShowOverview(await adminCall('GET', '/api/admin/overview'));
    else if(st.tab === 'keys') adminShowKeys((await adminCall('GET', '/api/admin/invites')).invites);
    else if(st.tab === 'users') adminShowUsers((await adminCall('GET', '/api/admin/users?limit=100&q=' + encodeURIComponent(st.userQuery))).users);
    else adminShowStats(await adminCall('GET', '/api/admin/stats?days=' + st.days));
  }catch(e){
    document.getElementById('admin-body').innerHTML = `<div class="feedback wrong">${escapeHtml(e.message)}</div>`;
  }
}

function adminSay(text, ok){ adminState.message = { text, ok }; }

function adminShowOverview(o){
  const tile = (n, label) => `<div class="admin-tile"><strong>${n}</strong><span>${escapeHtml(label)}</span></div>`;
  document.getElementById('admin-body').innerHTML = `
    <div class="admin-tiles">
      ${tile(o.users, 'comptes')}${tile(o.activeDay, 'actifs (24 h)')}${tile(o.activeWeek, 'actifs (7 j)')}${tile(o.activeMonth, 'actifs (30 j)')}
      ${tile(o.premium, 'premium')}${tile(o.suspended, 'suspendus')}${tile(o.invitesOpen, 'clés disponibles')}
    </div>
    <h3 class="course-sec-title" style="margin-top:18px;">Consentement aux statistiques</h3>
    <div class="admin-tiles">${tile(o.consentYes, 'acceptées')}${tile(o.consentNo, 'refusées')}${tile(o.consentUnknown, 'pas encore choisies')}</div>
    <p class="course-note">Les « actifs » viennent de la dernière visite de chaque compte. Les statistiques d'usage ne portent que sur les comptes qui les ont acceptées.</p>`;
}

function adminShowKeys(invites){
  const k = adminState.newKey;
  const statusLabel = { open:'disponible', used:'utilisée', expired:'expirée', revoked:'révoquée' };
  document.getElementById('admin-body').innerHTML = `
    ${k ? `<div class="admin-newkey"><div>Clé pour <strong>${escapeHtml(k.label)}</strong> — copie-la maintenant, elle ne sera plus affichée :</div>
      <code id="admin-newkey-code">${escapeHtml(k.code)}</code>
      <button class="btn btn-secondary" onclick="adminCopyKey()">Copier</button></div>` : ''}
    <div class="settings-card">
      <div class="settings-title">Nouvelle clé d'accès</div>
      <div class="settings-desc">Une clé = une personne (usage unique). Elle donne accès à la création d'un compte, avec les droits choisis ci-dessous.</div>
      <div style="display:flex; flex-direction:column; gap:8px;">
        <input type="text" class="settings-input" id="admin-key-label" placeholder="Pour qui ? (ex. Sophie, collègue)" maxlength="60" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false">
        <label class="auth-check"><input type="checkbox" id="admin-key-course"> <span>Module Cours (réservé, en attendant l'accord du professeur)</span></label>
        <div class="admin-row">
          <input type="number" class="settings-input" id="admin-key-trial" placeholder="Essai premium (jours)" min="1" max="365" inputmode="numeric" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false">
          <input type="number" class="settings-input" id="admin-key-expires" placeholder="Valable (jours)" min="1" max="3650" inputmode="numeric" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false">
          <input type="number" class="settings-input" id="admin-key-uses" placeholder="Utilisations (1)" min="1" max="1000" inputmode="numeric" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false">
        </div>
        <button class="btn btn-primary" onclick="adminCreateKey()">Créer la clé</button>
      </div>
    </div>
    <div class="course-scroll"><table class="course-table"><thead><tr><th>Pour</th><th>Statut</th><th>Droits</th><th>Utilisations</th><th>Expire</th><th></th></tr></thead><tbody>
      ${invites.map(i => `<tr><td>${escapeHtml(i.label)}</td><td>${statusLabel[i.status] || escapeHtml(i.status)}</td>
        <td>${escapeHtml([...i.entitlements, i.trialDays ? `essai ${i.trialDays} j` : ''].filter(Boolean).join(', ') || '—')}</td>
        <td>${i.uses}/${i.maxUses}</td><td>${escapeHtml(adminDate(i.expiresAt))}</td>
        <td>${i.status === 'open' ? `<button class="btn btn-secondary" onclick="adminRevokeKey('${escapeHtml(i.id)}')">Révoquer</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="6">Aucune clé.</td></tr>'}
    </tbody></table></div>`;
}

function adminNum(id){ const v = document.getElementById(id).value.trim(); return v === '' ? null : parseInt(v, 10); }

async function adminCreateKey(){
  const label = document.getElementById('admin-key-label').value.trim();
  if(!label){ adminSay('Indique pour qui est cette clé.', false); return renderAdmin(); }
  const body = { label, entitlements: document.getElementById('admin-key-course').checked ? ['course'] : [], trialDays: adminNum('admin-key-trial'), expiresInDays: adminNum('admin-key-expires') };
  const uses = adminNum('admin-key-uses'); if(uses !== null) body.maxUses = uses;
  try{
    const r = await adminCall('POST', '/api/admin/invites', body);
    adminState.newKey = { code:r.code, label:r.label }; adminSay('', true); adminState.message = null;
  }catch(e){ adminSay(e.message, false); }
  renderAdmin('keys');
}

function adminCopyKey(){
  const code = document.getElementById('admin-newkey-code');
  if(!code) return;
  if(navigator.clipboard) navigator.clipboard.writeText(code.textContent).then(() => { adminSay('Clé copiée.', true); renderAdmin('keys'); }, () => {});
}

async function adminRevokeKey(id){
  if(!confirm('Révoquer cette clé ?')) return;
  try{ await adminCall('POST', `/api/admin/invites/${id}/revoke`, {}); adminSay('Clé révoquée.', true); }catch(e){ adminSay(e.message, false); }
  renderAdmin('keys');
}

function adminShowUsers(users){
  const me = syncMe ? syncMe.id : '';
  document.getElementById('admin-body').innerHTML = `
    <div class="admin-row" style="margin-bottom:10px;">
      <input type="text" class="settings-input" id="admin-user-q" placeholder="Chercher un identifiant" value="${escapeHtml(adminState.userQuery)}" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" onkeydown="if(event.key==='Enter') adminSearchUsers()">
      <button class="btn btn-secondary" onclick="adminSearchUsers()">Chercher</button>
    </div>
    <div class="course-scroll"><table class="course-table"><thead><tr><th>Identifiant</th><th>Créé</th><th>Vu le</th><th>Formule</th><th>Droits</th><th>Stats</th><th>Clé</th><th></th></tr></thead><tbody>
      ${users.map(u => {
        const ents = u.entitlements.includes('course');
        const act = (action, extra) => `adminUserAction('${escapeHtml(u.id)}', ${escapeHtml(JSON.stringify({ action, ...(extra || {}) }))})`;
        return `<tr><td><strong>${escapeHtml(u.username)}</strong>${u.role === 'admin' ? ' <span class="course-tag">admin</span>' : ''}${u.status === 'suspended' ? ' <span class="course-tag">suspendu</span>' : ''}</td>
        <td>${escapeHtml(adminDate(u.createdAt))}</td><td>${escapeHtml(adminDate(u.lastSeenAt))}</td>
        <td>${escapeHtml(u.plan)}${u.trialEndsAt && u.trialEndsAt > Date.now() ? ` (essai → ${escapeHtml(adminDate(u.trialEndsAt))})` : ''}</td>
        <td>${escapeHtml(u.entitlements.join(', ') || '—')}</td>
        <td>${u.analyticsConsent === true ? 'oui' : u.analyticsConsent === false ? 'non' : '?'}</td><td>${escapeHtml(u.inviteLabel || '—')}</td>
        <td>${u.id === me ? '' : `<details><summary>Actions</summary><div class="admin-actions">
          <button class="btn btn-secondary" onclick="${act(u.status === 'suspended' ? 'unsuspend' : 'suspend')}">${u.status === 'suspended' ? 'Rétablir' : 'Suspendre'}</button>
          <button class="btn btn-secondary" onclick="${act('set-plan', { plan:'premium', expiresInDays:30 })}">Premium 30 j</button>
          <button class="btn btn-secondary" onclick="${act('set-plan', { plan:'free' })}">Repasser en gratuit</button>
          <button class="btn btn-secondary" onclick="${act('extend-trial', { days:14 })}">Essai 14 j</button>
          <button class="btn btn-secondary" onclick="${act('set-entitlements', { entitlements: ents ? u.entitlements.filter(x => x !== 'course') : [...u.entitlements, 'course'] })}">${ents ? 'Retirer le Cours' : 'Donner le Cours'}</button>
          <button class="btn btn-secondary" style="border-color:var(--error); color:var(--error);" onclick="adminDeleteUser('${escapeHtml(u.id)}')">Supprimer</button>
        </div></details>`}</td></tr>`;
      }).join('') || '<tr><td colspan="8">Aucun compte.</td></tr>'}
    </tbody></table></div>`;
}

function adminDeleteUser(id){
  if(confirm('Supprimer ce compte et toutes ses données ?')) adminUserAction(id, { action:'delete' });
}

function adminSearchUsers(){ adminState.userQuery = document.getElementById('admin-user-q').value.trim(); renderAdmin('users'); }

async function adminUserAction(id, body){
  try{ await adminCall('POST', `/api/admin/users/${id}`, body); adminSay('Fait.', true); }catch(e){ adminSay(e.message, false); }
  renderAdmin('users');
}

function adminShowStats(s){
  const maxUsers = Math.max(1, ...s.daily.map(d => d.users));
  const bars = s.daily.length ? s.daily.map(d => `<div class="admin-bar"><span>${escapeHtml(d.day)}</span><i style="width:${Math.round(100 * d.users / maxUsers)}%"></i><b>${d.users}</b></div>`).join('') : '<p class="course-note">Pas encore de données.</p>';
  const table = (head, rows) => `<div class="course-scroll"><table class="course-table"><thead><tr>${head.map(h => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead><tbody>${rows.join('') || `<tr><td colspan="${head.length}">Pas encore de données.</td></tr>`}</tbody></table></div>`;
  document.getElementById('admin-body').innerHTML = `
    <div class="admin-row" style="margin-bottom:10px;">${[7, 30, 90].map(d => `<button class="btn ${adminState.days === d ? 'btn-primary' : 'btn-secondary'}" onclick="adminState.days=${d}; renderAdmin('stats')">${d} jours</button>`).join('')}</div>
    <p class="course-note">${escapeHtml(s.note)}</p>
    <h3 class="course-sec-title">Utilisateurs par jour</h3>${bars}
    <h3 class="course-sec-title" style="margin-top:16px;">Retour après l'inscription</h3>
    ${table(['Après', 'Comptes concernés', 'Revenus'], ['d1', 'd7', 'd30'].map(k => `<tr><td>${k.slice(1)} jour${k === 'd1' ? '' : 's'}</td><td>${s.retention[k].eligible}</td><td>${s.retention[k].returned} (${adminPct(s.retention[k].returned, s.retention[k].eligible)})</td></tr>`))}
    <h3 class="course-sec-title" style="margin-top:16px;">Écrans consultés</h3>
    ${table(['Écran', 'Vues', 'Personnes'], s.screens.map(r => `<tr><td>${escapeHtml(r.name || '?')}</td><td>${r.n}</td><td>${r.users}</td></tr>`))}
    <h3 class="course-sec-title" style="margin-top:16px;">Sessions de révision</h3>
    ${table(['Type', 'Sessions', 'Durée moyenne', 'Réponses', 'Réussite'], s.sessions.map(r => `<tr><td>${escapeHtml(r.kind || '?')}</td><td>${r.n}</td><td>${r.avg_seconds || 0} s</td><td>${r.answered || 0}</td><td>${adminPct(r.correct || 0, r.answered || 0)}</td></tr>`))}
    <h3 class="course-sec-title" style="margin-top:16px;">Cartes les plus ratées</h3>
    ${table(['Carte', 'Erreurs', 'Personnes'], s.hardest.map(r => `<tr><td>${escapeHtml(adminCardLabel(r.card))}</td><td>${r.misses}</td><td>${r.users}</td></tr>`))}
    <h3 class="course-sec-title" style="margin-top:16px;">Erreurs techniques</h3>
    ${table(['Message', 'Fois'], s.errors.map(r => `<tr><td>${escapeHtml(r.msg || '?')}</td><td>${r.n}</td></tr>`))}
    <p class="course-note">Accueil terminé (nouveaux) : ${s.onboarding}</p>`;
}
