/* ============================================================
   COMPTE ET SYNCHRONISATION ENTRE APPAREILS
   La logique (fusion, cycle récupérer → fusionner → envoyer) est dans js/lib/sync-merge.js et
   js/lib/sync-core.js ; le serveur est le Worker de worker/worker.mjs. Ce fichier gère l'état de
   connexion, le déclenchement automatique et l'écran dans Paramètres.
   - Le jeton de connexion reste sur l'appareil (localStorage) ; il n'entre jamais dans une sauvegarde.
   - Tout ce qui vient du serveur est validé avant d'être appliqué ; tout texte affiché passe par escapeHtml().
   - Hors ligne ou serveur indisponible : l'app fonctionne comme avant et réessaie plus tard.
   ============================================================ */
const STORAGE_KEY_SYNC_AUTH = 'letzlift:sync-auth';
const SYNC_DEFAULT_URL = 'https://small-cloud-d182-letzlift-test.9r454kvyfr.workers.dev'; // adresse du Worker de synchronisation
const SYNC_DEBOUNCE_MS = 8000;
const SYNC_MIN_INTERVAL_MS = 60000;

let syncAuth = null;        // { url, username, token, lastSyncAt }
let syncLastUser = '';      // pour préremplir l'écran de connexion après une session expirée
let syncRunning = false;
let syncAgain = false;
let syncApplying = false;
let syncTimer = null;
let syncLastRunAt = 0;
let syncMessage = { text:'', ok:true };
let syncDraft = { url:'', user:'', pass:'', invite:'' }; // saisie conservée quand l'écran se redessine après une erreur

function syncLoadAuth(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY_SYNC_AUTH);
    const v = raw ? JSON.parse(raw) : null;
    syncAuth = (v && typeof v.token === 'string' && typeof v.username === 'string' && LetzSyncCore.normalizeServerUrl(v.url)) ? v : null;
    if(syncAuth) syncLastUser = syncAuth.username;
  }catch(e){ syncAuth = null; }
}
function syncSaveAuth(){
  try{
    if(syncAuth) localStorage.setItem(STORAGE_KEY_SYNC_AUTH, JSON.stringify(syncAuth));
    else localStorage.removeItem(STORAGE_KEY_SYNC_AUTH);
  }catch(e){}
}

function syncFetch(url, init){
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  return fetch(url, { ...init, signal:ctrl.signal, cache:'no-store', credentials:'omit' }).finally(() => clearTimeout(timer));
}
function syncClient(url, token){
  return LetzSyncCore.createClient({ baseUrl:url, token, fetch:syncFetch });
}

function syncLocalData(){
  return JSON.parse(JSON.stringify({ ...buildBackupPayload().data, vocabOverlay }));
}

function syncValidate(data){
  const { vocabOverlay: overlay, ...rest } = data;
  try{ validateBackupPayload({ app:'letzlift', formatVersion:1, data:rest }, Object.keys(rest.vocabProgress || {})); }
  catch(e){ return false; }
  return LetzSyncCore.validOverlay(overlay);
}

async function syncApply(d){
  syncApplying = true; // les enregistrements ci-dessous ne doivent pas relancer une synchronisation
  try{
    const filled = (v, fallback) => (v && Object.keys(v).length) ? v : fallback;
    vocabProgress = d.vocabProgress || {};
    grammarProgress = d.grammarProgress || {};
    sessionStats = filled(d.sessionStats, sessionStats);
    smalltalkProgress = d.smalltalkProgress || {};
    xpState = filled(d.xpState, xpState);
    dailyState = filled(d.dailyState, dailyState);
    gameRecords = d.gameRecords || {};
    userProfile = filled(d.userProfile, userProfile);
    dailyHistory = Array.isArray(d.dailyHistory) ? d.dailyHistory : [];
    courseProgress = d.courseProgress || {};
    vocabOverlay = d.vocabOverlay || {};
    applyVocabOverlay();
    await Promise.all([
      saveVocabProgress(), saveGrammarProgress(), saveStats(), saveSmalltalkProgress(), saveXpState(),
      saveDailyState(), saveGameRecords(), saveProfile(), saveDailyHistory(), saveCourseProgress(), saveVocabOverlay()
    ]);
    ensureDailyState();
    updateStreak();
  } finally { syncApplying = false; }
}

function syncRefreshView(){
  const active = document.querySelector('.view.active');
  if(!active) return;
  if(active.id === 'view-home') renderHome();
  else if(active.id === 'view-parametres') renderParametres();
  else if(active.id === 'view-vocab') renderVocabHub();
  else if(active.id === 'view-course' && typeof courseUI !== 'undefined' && courseUI.screen === 'list') renderCourse();
}

function scheduleSync(delay){
  if(!syncAuth || syncApplying) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => syncNow(), delay === undefined ? SYNC_DEBOUNCE_MS : delay);
}

function syncErrorText(e){
  if(e && e.code) return e.message;
  if(e && (e.name === 'AbortError' || e instanceof TypeError)) return 'Hors ligne ou serveur injoignable : la synchronisation reprendra plus tard.';
  return 'La synchronisation a échoué.';
}

async function syncNow(){
  if(!syncAuth) return;
  if(syncRunning){ syncAgain = true; return; }
  syncRunning = true;
  syncLastRunAt = Date.now();
  try{
    const r = await LetzSyncCore.runSync({
      client: syncClient(syncAuth.url, syncAuth.token),
      getLocal: syncLocalData, merge: LetzSyncMerge.mergeData, validate: syncValidate, apply: syncApply,
    });
    syncAuth.lastSyncAt = Date.now();
    syncSaveAuth();
    syncMessage = { text: r.applied ? 'Synchronisé : les données des autres appareils ont été fusionnées.' : 'Synchronisé.', ok:true };
    if(r.applied) syncRefreshView();
  }catch(e){
    syncMessage = { text: syncErrorText(e), ok:false };
    if(e && e.code === 'auth'){ syncLastUser = syncAuth.username; syncAuth = null; syncSaveAuth(); authGateShow('Session expirée : reconnecte-toi.', false); }
  } finally {
    syncRunning = false;
    if(syncAgain){ syncAgain = false; scheduleSync(2000); }
    const active = document.querySelector('.view.active');
    if(active && active.id === 'view-parametres') renderParametres();
  }
}

function syncStartup(){
  syncLoadAuth();
  if(syncAuth) syncNow();
  document.addEventListener('visibilitychange', () => {
    if(!document.hidden && syncAuth && Date.now() - syncLastRunAt > SYNC_MIN_INTERVAL_MS) syncNow();
  });
  window.addEventListener('online', () => { if(syncAuth) syncNow(); });
}

// Déconnexion de cet appareil seulement (la copie du serveur est conservée).
function syncDisconnectLocal(){
  if(!syncAuth) return;
  const { url, token } = syncAuth;
  syncLastUser = syncAuth.username;
  syncAuth = null;
  syncSaveAuth();
  clearTimeout(syncTimer);
  syncClient(url, token).logout().catch(() => {});
  authGateShow();
}

// ---------- écran Paramètres ----------
function syncField(id){ const el = document.getElementById(id); return el ? el.value : ''; }
function syncCaptureDraft(){
  if(!document.getElementById('sync-user')) return;
  syncDraft = { url:syncField('sync-url'), user:syncField('sync-user'), pass:syncField('sync-pass'), invite:syncField('sync-invite') };
}
function syncSetMessage(text, ok){ syncCaptureDraft(); syncMessage = { text, ok }; renderParametres(); }

function syncLastText(){
  if(!syncAuth || !syncAuth.lastSyncAt) return 'jamais';
  return new Date(syncAuth.lastSyncAt).toLocaleString('fr-LU', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' });
}

function syncCardHtml(){
  const msg = syncMessage.text ? `<div class="feedback ${syncMessage.ok ? 'correct' : 'wrong'}" aria-live="polite">${escapeHtml(syncMessage.text)}</div>` : '';
  if(syncAuth){
    return `<div class="settings-card">
      <div class="settings-title">Compte et synchronisation</div>
      <div class="settings-desc">Connecté : <strong>${escapeHtml(syncAuth.username)}</strong> · dernière synchronisation : ${escapeHtml(syncLastText())}. Ta progression est fusionnée entre tes appareils automatiquement.</div>
      ${msg}
      <div class="cta-row" style="margin-top:10px;">
        <button class="btn btn-primary" onclick="syncNow()" ${syncRunning ? 'disabled' : ''}>${syncRunning ? 'Synchronisation…' : 'Synchroniser maintenant'}</button>
        <button class="btn btn-secondary" onclick="syncDisconnectLocal(); syncSetMessage('Déconnecté. Ta progression reste sur cet appareil.', true)">Se déconnecter</button>
      </div>
      <details style="margin-top:12px;">
        <summary class="settings-desc" style="cursor:pointer;">Mot de passe et compte</summary>
        <div style="display:flex; flex-direction:column; gap:8px; margin-top:8px;">
          <input type="password" class="settings-input" id="sync-old-pass" placeholder="Mot de passe actuel" autocomplete="current-password" autocapitalize="off" autocorrect="off" spellcheck="false">
          <input type="password" class="settings-input" id="sync-new-pass" placeholder="Nouveau mot de passe (10 caractères minimum)" autocomplete="new-password" autocapitalize="off" autocorrect="off" spellcheck="false">
          <div class="cta-row">
            <button class="btn btn-secondary" onclick="syncChangePassword()">Changer le mot de passe</button>
            <button class="btn btn-secondary" style="border-color:var(--error); color:var(--error);" onclick="syncDeleteAccount()">Supprimer le compte</button>
          </div>
          <div class="settings-desc">Changer le mot de passe déconnecte les autres appareils. Supprimer le compte efface la copie du serveur (pas ta progression sur cet appareil). Pour supprimer, saisis le mot de passe actuel.</div>
        </div>
      </details>
    </div>`;
  }
  return `<div class="settings-card">
    <div class="settings-title">Compte et synchronisation</div>
    <div class="settings-desc">Retrouve ta progression sur tous tes appareils. Si tu as déjà de la progression ici et sur le serveur, les deux sont fusionnées. Il n'y a pas de récupération possible si tu oublies ton mot de passe : télécharge de temps en temps une sauvegarde.</div>
    ${msg}
    <div style="display:flex; flex-direction:column; gap:8px; margin-top:8px;">
      <input type="text" class="settings-input" id="sync-url" placeholder="Adresse du serveur (https://….workers.dev)" value="${escapeHtml(syncDraft.url || SYNC_DEFAULT_URL || syncSavedUrl())}" autocomplete="url" autocapitalize="off" autocorrect="off" spellcheck="false" inputmode="url">
      <input type="text" class="settings-input" id="sync-user" placeholder="Identifiant" value="${escapeHtml(syncDraft.user || syncLastUser)}" autocomplete="username" autocapitalize="off" autocorrect="off" spellcheck="false" maxlength="32">
      <input type="password" class="settings-input" id="sync-pass" placeholder="Mot de passe" value="${escapeHtml(syncDraft.pass)}" autocomplete="current-password" maxlength="128" autocapitalize="off" autocorrect="off" spellcheck="false">
      <input type="text" class="settings-input" id="sync-invite" placeholder="Code d'invitation (pour créer le compte)" value="${escapeHtml(syncDraft.invite)}" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" maxlength="100">
      <div class="cta-row">
        <button class="btn btn-primary" onclick="syncLogin()">Se connecter</button>
        <button class="btn btn-secondary" onclick="syncRegister()">Créer le compte</button>
      </div>
    </div>
  </div>`;
}

function syncSavedUrl(){
  try{ return localStorage.getItem('letzlift:sync-url') || ''; }catch(e){ return ''; }
}

function syncReadServer(){
  const url = LetzSyncCore.normalizeServerUrl(syncField('sync-url'));
  if(!url){ syncSetMessage('Adresse du serveur invalide : elle doit commencer par https://.', false); return null; }
  try{ localStorage.setItem('letzlift:sync-url', url); }catch(e){}
  return url;
}

// Connexion ou création de compte : enregistre le jeton, mais ne synchronise pas (à l'appelant).
// Renvoie { ok } ou { ok:false, message, network } (network : serveur injoignable).
async function syncAuthenticate(kind, url, username, password, invite){
  try{
    const client = syncClient(url, null);
    const res = kind === 'register' ? await client.register(username, password, invite) : await client.login(username, password);
    if(!res.ok || !res.body.token) return { ok:false, message:(res.body && res.body.error) || 'Connexion impossible.', network:false };
    syncAuth = { url, username: res.body.username || username, token: res.body.token, lastSyncAt: 0 };
    syncSaveAuth();
    syncLastUser = syncAuth.username;
    return { ok:true };
  }catch(e){
    return { ok:false, message:syncErrorText(e), network:!(e && e.code) };
  }
}

async function syncConnect(kind){
  const url = syncReadServer();
  if(!url) return;
  const username = syncField('sync-user').trim().toLowerCase();
  const password = syncField('sync-pass');
  if(!username || !password){ syncSetMessage('Saisis un identifiant et un mot de passe.', false); return; }
  syncMessage = { text:'Connexion…', ok:true };
  const r = await syncAuthenticate(kind, url, username, password, syncField('sync-invite').trim());
  if(!r.ok){ syncSetMessage(r.message, false); return; }
  syncDraft = { url:'', user:'', pass:'', invite:'' };
  await syncNow();
}
function syncLogin(){ return syncConnect('login'); }
function syncRegister(){ return syncConnect('register'); }

async function syncChangePassword(){
  if(!syncAuth) return;
  const oldPassword = syncField('sync-old-pass'), newPassword = syncField('sync-new-pass');
  if(!oldPassword || !newPassword){ syncSetMessage('Saisis le mot de passe actuel et le nouveau.', false); return; }
  try{
    const res = await syncClient(syncAuth.url, syncAuth.token).changePassword(oldPassword, newPassword);
    syncSetMessage(res.ok ? 'Mot de passe changé. Les autres appareils devront se reconnecter.' : ((res.body && res.body.error) || 'Échec.'), res.ok);
  }catch(e){ syncSetMessage(syncErrorText(e), false); }
}

async function syncDeleteAccount(){
  if(!syncAuth) return;
  const password = syncField('sync-old-pass');
  if(!password){ syncSetMessage('Pour supprimer le compte, saisis le mot de passe actuel.', false); return; }
  if(!confirm('Supprimer le compte et la copie du serveur ? Ta progression sur cet appareil est conservée.')) return;
  try{
    const res = await syncClient(syncAuth.url, syncAuth.token).deleteAccount(password);
    if(res.ok){ syncAuth = null; syncSaveAuth(); syncSetMessage('Compte supprimé. Ta progression reste sur cet appareil.', true); authGateShow('Compte supprimé. Ta progression reste sur cet appareil.', true); }
    else syncSetMessage((res.body && res.body.error) || 'Échec.', false);
  }catch(e){ syncSetMessage(syncErrorText(e), false); }
}

// ---------- écran de connexion à l'ouverture ----------
// L'app s'ouvre sur cet écran tant qu'aucun compte n'est connecté ; une fois connecté, le jeton est
// conservé (90 jours) et l'app s'ouvre directement. Si le serveur est injoignable, un lien permet de
// continuer hors connexion pour cette fois seulement. C'est une porte d'accès au compte de
// synchronisation, pas un coffre-fort : la progression reste lisible dans le navigateur de l'appareil.
let gateMode = 'login';   // 'login' | 'register'
let gateMessage = { text:'', ok:false };
let gateBusy = false;
let gateOffline = false;  // le serveur n'a pas répondu : on propose de continuer sans connexion
let gateDraft = { user:'', pass:'', pass2:'', invite:'', url:'' };

function authGateIsOpen(){
  const g = document.getElementById('auth-gate');
  return !!(g && g.classList.contains('open'));
}

function authGateShow(text, ok){
  const g = document.getElementById('auth-gate');
  if(!g) return;
  if(text !== undefined) gateMessage = { text, ok:!!ok };
  gateBusy = false;
  gateDraft.user = gateDraft.user || syncLastUser;
  renderAuthGate();
  g.classList.add('open');
  const app = document.getElementById('app');
  if(app){ app.setAttribute('inert', ''); app.setAttribute('aria-hidden', 'true'); }
  const first = document.getElementById('gate-user');
  if(first) first.focus();
}

function authGateHide(){
  const g = document.getElementById('auth-gate');
  if(g) g.classList.remove('open');
  const app = document.getElementById('app');
  if(app){ app.removeAttribute('inert'); app.removeAttribute('aria-hidden'); }
  gateDraft = { user:'', pass:'', pass2:'', invite:'', url:'' };
  gateMessage = { text:'', ok:false };
  gateOffline = false;
}

function renderAuthGate(){
  const g = document.getElementById('auth-gate');
  if(!g) return;
  const register = gateMode === 'register';
  const needUrl = !SYNC_DEFAULT_URL && !syncSavedUrl();
  const msg = gateMessage.text ? `<div class="feedback ${gateMessage.ok ? 'correct' : 'wrong'}" role="alert">${escapeHtml(gateMessage.text)}</div>` : '';
  g.innerHTML = `
    <div class="auth-card" role="dialog" aria-modal="true" aria-labelledby="gate-title">
      <div class="auth-brand">LetzLift</div>
      <h1 id="gate-title" class="auth-title">${register ? 'Créer un compte' : 'Connexion'}</h1>
      <p class="auth-desc">${register
        ? "Choisis un identifiant et un mot de passe (10 caractères minimum). Il n'y a pas de récupération possible si tu oublies ton mot de passe : télécharge de temps en temps une sauvegarde."
        : "Connecte-toi pour retrouver ta progression sur cet appareil."}</p>
      <form id="gate-form" onsubmit="gateSubmit(event); return false;">
        ${needUrl ? `<input type="text" class="settings-input" id="gate-url" name="server" placeholder="Adresse du serveur (https://….workers.dev)" value="${escapeHtml(gateDraft.url)}" autocomplete="url" autocapitalize="off" autocorrect="off" spellcheck="false" inputmode="url">` : ''}
        <input type="text" class="settings-input" id="gate-user" name="username" placeholder="Identifiant" value="${escapeHtml(gateDraft.user)}" autocomplete="username" autocapitalize="off" autocorrect="off" spellcheck="false" maxlength="32">
        <input type="password" class="settings-input" id="gate-pass" name="password" placeholder="Mot de passe" value="${escapeHtml(gateDraft.pass)}" autocomplete="${register ? 'new-password' : 'current-password'}" autocapitalize="off" autocorrect="off" spellcheck="false" maxlength="128">
        ${register ? `
        <input type="password" class="settings-input" id="gate-pass2" name="password2" placeholder="Confirme le mot de passe" value="${escapeHtml(gateDraft.pass2)}" autocomplete="new-password" autocapitalize="off" autocorrect="off" spellcheck="false" maxlength="128">
        <input type="text" class="settings-input" id="gate-invite" name="invite" placeholder="Code d'invitation" value="${escapeHtml(gateDraft.invite)}" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" maxlength="100">` : ''}
        ${msg}
        <button type="submit" class="btn btn-primary" id="gate-submit" ${gateBusy ? 'disabled' : ''}>${gateBusy ? 'Un instant…' : (register ? 'Créer le compte' : 'Se connecter')}</button>
      </form>
      <button type="button" class="auth-link" onclick="gateToggleMode()">${register ? "J'ai déjà un compte" : 'Pas encore de compte ? Créer un compte'}</button>
      ${gateOffline ? '<button type="button" class="auth-link" onclick="gateContinueOffline()">Serveur injoignable : continuer sans connexion (cette fois)</button>' : ''}
    </div>`;
}

function gateCaptureDraft(){
  if(!document.getElementById('gate-user')) return;
  gateDraft = { user:syncField('gate-user'), pass:syncField('gate-pass'), pass2:syncField('gate-pass2'), invite:syncField('gate-invite'), url:syncField('gate-url') };
}

function gateToggleMode(){
  gateCaptureDraft();
  gateMode = gateMode === 'login' ? 'register' : 'login';
  gateMessage = { text:'', ok:false };
  gateDraft.pass2 = '';
  renderAuthGate();
  const first = document.getElementById('gate-user');
  if(first) first.focus();
}

function gateFail(text, network){
  gateBusy = false;
  gateMessage = { text: network ? 'Serveur injoignable (hors ligne ?). Réessaie, ou continue sans connexion.' : text, ok:false };
  gateOffline = !!network;
  renderAuthGate();
}

async function gateSubmit(e){
  if(e && e.preventDefault) e.preventDefault();
  if(gateBusy) return;
  gateCaptureDraft();
  const register = gateMode === 'register';
  const username = gateDraft.user.trim().toLowerCase();
  const password = gateDraft.pass;
  const url = LetzSyncCore.normalizeServerUrl(SYNC_DEFAULT_URL || syncSavedUrl() || gateDraft.url);
  if(!url) return gateFail('Adresse du serveur invalide : elle doit commencer par https://.');
  if(!username || !password) return gateFail('Saisis un identifiant et un mot de passe.');
  if(register && password !== gateDraft.pass2) return gateFail('Les deux mots de passe ne sont pas identiques.');
  try{ localStorage.setItem('letzlift:sync-url', url); }catch(err){}
  gateBusy = true;
  gateMessage = { text:'', ok:false };
  renderAuthGate();
  const r = await syncAuthenticate(register ? 'register' : 'login', url, username, password, gateDraft.invite.trim());
  if(!r.ok) return gateFail(r.message, r.network);
  authGateHide();
  await syncNow(); // première fusion avec la copie du serveur
  switchView('home');
}

function gateContinueOffline(){
  authGateHide(); // pas de jeton : l'écran reviendra à la prochaine ouverture
}

function syncGateStartup(){
  syncLoadAuth();
  if(!syncAuth) authGateShow();
}
