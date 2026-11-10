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
const SYNC_ME_REFRESH_MS = 600000;
const TERMS_VERSION = '2026-11';   // version des conditions d'utilisation et de la politique de confidentialité
const CONSENT_VERSION = 'c1';      // version du texte de consentement aux statistiques

let syncAuth = null;        // { url, username, token, lastSyncAt }
let syncMe = null;          // profil du compte : droits d'accès, rôle, consentement (copie gardée pour le hors ligne)
let syncMeAt = 0;
let syncLastUser = '';      // pour préremplir l'écran de connexion après une session expirée
let syncRunning = false;
let syncAgain = false;
let syncApplying = false;
let syncTimer = null;
let syncLastRunAt = 0;
let syncMessage = { text:'', ok:true };

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

function syncLoadMe(){
  try{ const raw = localStorage.getItem('letzlift:sync-me'); syncMe = raw ? JSON.parse(raw) : null; }catch(e){ syncMe = null; }
}
function syncSaveMe(){
  try{
    if(syncMe) localStorage.setItem('letzlift:sync-me', JSON.stringify(syncMe));
    else localStorage.removeItem('letzlift:sync-me');
  }catch(e){}
}
// Droit d'accès à un module (ex. 'course') : décidé par le serveur, gardé en copie pour le hors ligne.
function hasEntitlement(name){
  return !!(syncMe && Array.isArray(syncMe.entitlements) && syncMe.entitlements.includes(name));
}
function syncIsAdmin(){ return !!(syncMe && syncMe.role === 'admin'); }

async function syncRefreshMe(force){
  if(!syncAuth) return;
  if(!force && Date.now() - syncMeAt < SYNC_ME_REFRESH_MS) return;
  try{
    const res = await syncClient(syncAuth.url, syncAuth.token).me();
    if(res.ok && res.body.me){
      const before = JSON.stringify(syncMe && [syncMe.entitlements, syncMe.role]);
      syncMe = res.body.me; syncMeAt = Date.now(); syncSaveMe();
      // Droits ou rôle différents de ceux déjà affichés (première connexion sur cet appareil, droit accordé) : on redessine l'écran
      if(before !== JSON.stringify([syncMe.entitlements, syncMe.role])) syncRefreshView();
      if(typeof telemetryStart === 'function') telemetryStart();
      if(syncMe.analyticsConsent === null && !authGateIsOpen()) authGateShowConsent();
    }
  }catch(e){ /* hors ligne : on garde la copie */ }
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
      getLocal: syncLocalData, validate: syncValidate, apply: syncApply,
    });
    syncAuth.lastSyncAt = Date.now();
    syncSaveAuth();
    syncRefreshMe(false);
    syncMessage = { text: r.applied ? 'Synchronisé : les données des autres appareils ont été fusionnées.' : 'Synchronisé.', ok:true };
    if(r.applied) syncRefreshView();
  }catch(e){
    syncMessage = { text: syncErrorText(e), ok:false };
    if(e && e.code === 'auth'){ syncLastUser = syncAuth.username; syncAuth = null; syncMe = null; syncSaveAuth(); syncSaveMe(); authGateShow('Session expirée : reconnecte-toi.', false); }
    else if(e && e.code === 'suspended'){ syncAuth = null; syncMe = null; syncSaveAuth(); syncSaveMe(); authGateShow(e.message, false); }
  } finally {
    syncRunning = false;
    if(syncAgain){ syncAgain = false; scheduleSync(2000); }
    const active = document.querySelector('.view.active');
    if(active && active.id === 'view-parametres') renderParametres();
  }
}

function syncStartup(){
  syncLoadAuth();
  syncLoadMe();
  if(syncAuth){ syncNow(); syncRefreshMe(true); }
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
  syncMe = null;
  syncSaveAuth();
  syncSaveMe();
  clearTimeout(syncTimer);
  if(typeof telemetryReset === 'function') telemetryReset();
  syncClient(url, token).logout().catch(() => {});
  authGateShow();
}

// ---------- écran Paramètres ----------
function syncField(id){ const el = document.getElementById(id); return el ? el.value : ''; }
function syncSetMessage(text, ok){ syncMessage = { text, ok }; renderParametres(); }

function syncLastText(){
  if(!syncAuth || !syncAuth.lastSyncAt) return 'jamais';
  return new Date(syncAuth.lastSyncAt).toLocaleString('fr-LU', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' });
}

function syncSavedUrl(){
  try{ return localStorage.getItem('letzlift:sync-url') || ''; }catch(e){ return ''; }
}

function syncCardHtml(){
  const msg = syncMessage.text ? `<div class="feedback ${syncMessage.ok ? 'correct' : 'wrong'}" aria-live="polite">${escapeHtml(syncMessage.text)}</div>` : '';
  if(!syncAuth){
    return `<div class="settings-card">
      <div class="settings-title">Compte et synchronisation</div>
      <div class="settings-desc">Tu utilises l'app sans connexion : ta progression reste sur cet appareil. Connecte-toi pour la retrouver sur tous tes appareils.</div>
      ${msg}
      <button class="btn btn-primary" onclick="authGateShow()">Se connecter</button>
    </div>`;
  }
  const consent = syncMe ? syncMe.analyticsConsent : null;
  const hasRecovery = !!(syncMe && syncMe.hasRecovery);
  const recoveryBlock = syncRecoveryShown ? `
      <div class="recovery-new">
        <div><strong>Ton nouveau code de récupération</strong> : note-le maintenant, il ne sera plus affiché. L'ancien code ne fonctionne plus.</div>
        <div class="recovery-box"><code id="sync-recovery-code">${escapeHtml(syncRecoveryShown)}</code></div>
        <div class="cta-row"><button class="btn btn-secondary" onclick="syncCopyRecovery()">Copier</button><button class="btn btn-primary" onclick="syncRecoveryDone()">J'ai noté mon code</button></div>
      </div>` : '';
  return `<div class="settings-card">
      <div class="settings-title">Compte et synchronisation</div>
      <div class="settings-desc">Connecté : <strong>${escapeHtml(syncAuth.username)}</strong> · dernière synchronisation : ${escapeHtml(syncLastText())}. Ta progression est fusionnée entre tes appareils automatiquement.</div>
      ${msg}
      ${recoveryBlock}
      <div class="cta-row" style="margin-top:10px;">
        <button class="btn btn-primary" onclick="syncNow()" ${syncRunning ? 'disabled' : ''}>${syncRunning ? 'Synchronisation…' : 'Synchroniser maintenant'}</button>
        <button class="btn btn-secondary" onclick="syncDisconnectLocal()">Se déconnecter</button>
        ${syncIsAdmin() ? `<button class="btn btn-secondary" onclick="switchView('admin')">Administration</button>` : ''}
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
          <div class="settings-desc"><strong>Code de récupération</strong> : ${hasRecovery ? "tu en as un. Si tu oublies ton mot de passe, il te permet d'en choisir un nouveau. Tu peux en créer un nouveau (l'ancien cesse alors de fonctionner)." : "tu n'en as pas encore. Sans lui, un mot de passe oublié ne peut pas être récupéré par toi-même."} Saisis ton mot de passe actuel ci-dessus, puis :</div>
          <div class="cta-row"><button class="btn btn-secondary" onclick="syncNewRecoveryCode()">${hasRecovery ? 'Créer un nouveau code' : 'Créer mon code de récupération'}</button></div>
          <div class="settings-desc">Changer le mot de passe déconnecte les autres appareils. Supprimer le compte efface la copie du serveur et les statistiques collectées (pas ta progression sur cet appareil). Pour supprimer, saisis le mot de passe actuel.</div>
        </div>
      </details>
    </div>
    <div class="settings-card">
      <div class="settings-title">Confidentialité</div>
      <div class="settings-desc">Statistiques d'usage : ${consent === true ? '<strong>acceptées</strong>' : consent === false ? '<strong>refusées</strong>' : '<strong>pas encore choisies</strong>'}. Elles servent à améliorer l'app (écrans consultés, durée des sessions, mots souvent ratés, erreurs). Tu peux changer d'avis à tout moment : refuser supprime ce qui a été collecté.</div>
      <div class="cta-row">
        <button class="btn btn-secondary" onclick="syncSetConsent(true)" ${consent === true ? 'disabled' : ''}>Accepter les statistiques</button>
        <button class="btn btn-secondary" onclick="syncSetConsent(false)" ${consent === false ? 'disabled' : ''}>Refuser les statistiques</button>
      </div>
      <div class="settings-desc" style="margin-top:10px;">
        <a href="legal/confidentialite.html" target="_blank" rel="noopener">Politique de confidentialité</a> ·
        <a href="legal/cgu.html" target="_blank" rel="noopener">Conditions d'utilisation</a> ·
        <a href="legal/mentions.html" target="_blank" rel="noopener">Mentions légales</a>
      </div>
    </div>`;
}

async function syncSetConsent(analytics){
  if(!syncAuth) return;
  try{
    const res = await syncClient(syncAuth.url, syncAuth.token).consent(analytics, CONSENT_VERSION);
    if(!res.ok){ syncSetMessage((res.body && res.body.error) || 'Échec.', false); return; }
    syncMe = res.body.me; syncMeAt = Date.now(); syncSaveMe();
    if(analytics){ if(typeof telemetryStart === 'function') telemetryStart(); }
    else if(typeof telemetryReset === 'function') telemetryReset();
    syncSetMessage(analytics ? 'Merci : les statistiques d’usage sont activées.' : 'Statistiques refusées : ce qui avait été collecté est supprimé.', true);
  }catch(e){ syncSetMessage(syncErrorText(e), false); }
}

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
  if(!confirm('Supprimer le compte, la copie du serveur et les statistiques collectées ? Ta progression sur cet appareil est conservée.')) return;
  try{
    const res = await syncClient(syncAuth.url, syncAuth.token).deleteAccount(password);
    if(res.ok){
      syncAuth = null; syncMe = null; syncSaveAuth(); syncSaveMe();
      if(typeof telemetryReset === 'function') telemetryReset();
      authGateShow('Compte supprimé. Ta progression reste sur cet appareil.', true);
    } else syncSetMessage((res.body && res.body.error) || 'Échec.', false);
  }catch(e){ syncSetMessage(syncErrorText(e), false); }
}

// Enregistre le jeton et le profil reçus après une connexion, une création de compte ou une récupération.
function syncStoreAuthResponse(url, username, body){
  syncAuth = { url, username: body.username || username, token: body.token, lastSyncAt: 0 };
  syncSaveAuth();
  syncLastUser = syncAuth.username;
  syncMe = body.me || null; syncMeAt = Date.now(); syncSaveMe();
}

// Connexion ou création de compte : enregistre le jeton, mais ne synchronise pas (à l'appelant).
// Renvoie { ok, recoveryCode? } ou { ok:false, message, network } (network : serveur injoignable).
async function syncAuthenticate(kind, url, username, password, extra){
  try{
    const client = syncClient(url, null);
    const res = kind === 'register'
      ? await client.register({ username, password, key: extra.key, acceptTerms:true, age16:true, termsVersion:TERMS_VERSION, analytics: extra.analytics, consentVersion:CONSENT_VERSION })
      : await client.login(username, password);
    if(!res.ok || !res.body.token) return { ok:false, message:(res.body && res.body.error) || 'Connexion impossible.', network:false };
    syncStoreAuthResponse(url, username, res.body);
    return { ok:true, recoveryCode: res.body.recoveryCode || null };
  }catch(e){
    return { ok:false, message:syncErrorText(e), network:!(e && e.code) };
  }
}

// Mot de passe oublié : le code de récupération permet d'en choisir un nouveau. Renvoie le nouveau code à noter.
async function syncRecover(url, username, code, newPassword){
  try{
    const res = await syncClient(url, null).recover(username, code, newPassword);
    if(!res.ok || !res.body.token) return { ok:false, message:(res.body && res.body.error) || 'Récupération impossible.', network:false };
    syncStoreAuthResponse(url, username, res.body);
    return { ok:true, recoveryCode: res.body.recoveryCode || null };
  }catch(e){
    return { ok:false, message:syncErrorText(e), network:!(e && e.code) };
  }
}

// Nouveau code de récupération depuis les Paramètres (mot de passe actuel exigé) ; l'ancien cesse de fonctionner.
let syncRecoveryShown = null; // code affiché une seule fois dans la carte Compte
async function syncNewRecoveryCode(){
  if(!syncAuth) return;
  const password = syncField('sync-old-pass');
  if(!password){ syncSetMessage('Saisis ton mot de passe actuel pour créer un nouveau code.', false); return; }
  try{
    const res = await syncClient(syncAuth.url, syncAuth.token).newRecoveryCode(password);
    if(!res.ok || !res.body.recoveryCode){ syncSetMessage((res.body && res.body.error) || 'Échec.', false); return; }
    syncRecoveryShown = res.body.recoveryCode;
    if(res.body.me){ syncMe = res.body.me; syncMeAt = Date.now(); syncSaveMe(); }
    syncMessage = { text:'', ok:true };
    renderParametres();
  }catch(e){ syncSetMessage(syncErrorText(e), false); }
}
function syncRecoveryDone(){ syncRecoveryShown = null; syncMessage = { text:'Code noté : garde-le en lieu sûr, il ne sera plus affiché.', ok:true }; renderParametres(); }
function syncCopyText(text, onDone){
  if(navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => onDone(true), () => onDone(false));
  else onDone(false);
}
function syncCopyRecovery(){ syncCopyText(syncRecoveryShown || '', ok => syncSetMessage(ok ? 'Code copié.' : 'Copie impossible : recopie le code à la main.', ok)); }

// ---------- écran de connexion à l'ouverture ----------
// L'app s'ouvre sur cet écran tant qu'aucun compte n'est connecté ; une fois connecté, le jeton est
// conservé (90 jours) et l'app s'ouvre directement. Si le serveur est injoignable, un lien permet de
// continuer hors connexion pour cette fois seulement. C'est une porte d'accès au compte de
// synchronisation, pas un coffre-fort : la progression reste lisible dans le navigateur de l'appareil.
// Modes : 'login' | 'register' (identifiants + clé) | 'consent' (conditions + choix des statistiques)
//         | 'ask' (compte existant sans choix enregistré) | 'recover' (mot de passe oublié : identifiant, code, nouveau mot de passe)
//         | 'recovery' (le code de récupération à noter, après une création de compte ou une récupération).
let gateMode = 'login';
let gateMessage = { text:'', ok:false };
let gateBusy = false;
let gateOffline = false;  // le serveur n'a pas répondu : on propose de continuer sans connexion
let gateDraft = { user:'', pass:'', pass2:'', key:'', url:'', code:'' };
let gateRecoveryNote = 'register'; // 'register' | 'recover' : texte de l'écran « recovery »
let gateRecoveryCode = null;   // code de récupération à noter (écran « recovery »), jamais conservé ensuite

const CONSENT_TEXT = `Pour améliorer LetzLift, nous aimerions mesurer comment l'application est utilisée : les écrans consultés, la durée et le résultat des sessions de révision, les mots les plus souvent ratés et les erreurs techniques.
Ces données sont rattachées à ton compte sous un identifiant technique (elles sont pseudonymisées, pas anonymes). Elles ne contiennent aucun texte que tu saisis, ne sont ni vendues ni partagées avec des régies publicitaires, et sont conservées 13 mois au maximum.
L'application fonctionne exactement de la même façon quel que soit ton choix. Tu peux changer d'avis à tout moment dans Paramètres : refuser supprime ce qui a été collecté.`;

function authGateIsOpen(){
  const g = document.getElementById('auth-gate');
  return !!(g && g.classList.contains('open'));
}

function authGateOpen(){
  const g = document.getElementById('auth-gate');
  if(!g) return;
  gateBusy = false;
  renderAuthGate();
  g.classList.add('open');
  const app = document.getElementById('app');
  if(app){ app.setAttribute('inert', ''); app.setAttribute('aria-hidden', 'true'); }
  const first = document.getElementById('gate-user') || document.getElementById('gate-first');
  if(first) first.focus();
}

function authGateShow(text, ok){
  if(text !== undefined) gateMessage = { text, ok:!!ok };
  gateMode = 'login';
  gateDraft.user = gateDraft.user || syncLastUser;
  authGateOpen();
}

function authGateShowConsent(){
  gateMode = 'ask';
  gateMessage = { text:'', ok:false };
  authGateOpen();
}

function authGateHide(){
  const g = document.getElementById('auth-gate');
  if(g){ g.classList.remove('open'); g.innerHTML = ''; } // vide l'écran (le code de récupération ne reste pas dans la page)
  const app = document.getElementById('app');
  if(app){ app.removeAttribute('inert'); app.removeAttribute('aria-hidden'); }
  gateDraft = { user:'', pass:'', pass2:'', key:'', url:'', code:'' };
  gateRecoveryCode = null;
  gateMessage = { text:'', ok:false };
  gateOffline = false;
  gateMode = 'login';
}

function gateLegalLinks(){
  return `<a href="legal/cgu.html" target="_blank" rel="noopener">conditions d'utilisation</a> et la <a href="legal/confidentialite.html" target="_blank" rel="noopener">politique de confidentialité</a>`;
}

function renderAuthGate(){
  const g = document.getElementById('auth-gate');
  if(!g) return;
  const msg = gateMessage.text ? `<div class="feedback ${gateMessage.ok ? 'correct' : 'wrong'}" role="alert">${escapeHtml(gateMessage.text)}</div>` : '';
  const consentParas = CONSENT_TEXT.split('\n').map(t => `<p class="auth-desc">${escapeHtml(t)}</p>`).join('');
  const two = (fnTrue, fnFalse, label) => `
      <button type="button" class="btn btn-primary" id="gate-first" onclick="${fnTrue}" ${gateBusy ? 'disabled' : ''}>Accepter les statistiques${label}</button>
      <button type="button" class="btn btn-primary" onclick="${fnFalse}" ${gateBusy ? 'disabled' : ''}>Refuser les statistiques${label}</button>`;
  let body;
  if(gateMode === 'consent'){
    body = `
      <h1 id="gate-title" class="auth-title">Avant de commencer</h1>
      <label class="auth-check"><input type="checkbox" id="gate-terms"> <span>J'ai au moins 16 ans et j'accepte les ${gateLegalLinks()}.</span></label>
      <h2 class="auth-sub">Statistiques d'usage</h2>
      ${consentParas}
      ${msg}
      ${two("gateRegister(true)", "gateRegister(false)", ' et créer mon compte')}
      <button type="button" class="auth-link" onclick="gateBackToRegister()">Retour</button>`;
  } else if(gateMode === 'ask'){
    body = `
      <h1 id="gate-title" class="auth-title">Statistiques d'usage</h1>
      ${consentParas}
      <p class="auth-desc"><a href="legal/confidentialite.html" target="_blank" rel="noopener">Politique de confidentialité</a></p>
      ${msg}
      ${two("gateAnswerConsent(true)", "gateAnswerConsent(false)", '')}
      <button type="button" class="auth-link" onclick="gateConsentLater()">Plus tard</button>`;
  } else if(gateMode === 'recovery'){
    body = `
      <h1 id="gate-title" class="auth-title">Ton code de récupération</h1>
      <p class="auth-desc">${gateRecoveryNote === 'recover' ? "Ton mot de passe est changé. Voici ton <strong>nouveau</strong> code : l'ancien ne fonctionne plus." : "Ton compte est créé. Voici ton code de récupération."} Si tu oublies ton mot de passe, ce code te permettra d'en choisir un nouveau. Il n'est affiché qu'<strong>une seule fois</strong> : note-le sur papier ou dans un gestionnaire de mots de passe.</p>
      <div class="recovery-box"><code id="gate-recovery-code">${escapeHtml(gateRecoveryCode || '')}</code></div>
      <button type="button" class="btn btn-secondary" onclick="gateRecoveryCopy()">Copier le code</button>
      <label class="auth-check"><input type="checkbox" id="gate-saved"> <span>J'ai noté mon code de récupération.</span></label>
      ${msg}
      <button type="button" class="btn btn-primary" id="gate-first" onclick="gateRecoveryContinue()">Continuer</button>`;
  } else if(gateMode === 'recover'){
    const needUrl = !SYNC_DEFAULT_URL && !syncSavedUrl();
    body = `
      <h1 id="gate-title" class="auth-title">Mot de passe oublié</h1>
      <p class="auth-desc">Saisis ton identifiant, le code de récupération reçu à la création de ton compte (« LZR-… »), et choisis un nouveau mot de passe (10 caractères minimum). Pas de code ? Demande-en un nouveau à la personne qui t'a donné ta clé d'accès.</p>
      <form id="gate-form" onsubmit="gateRecoverSubmit(event); return false;">
        ${needUrl ? `<input type="text" class="settings-input" id="gate-url" name="server" placeholder="Adresse du serveur (https://….workers.dev)" value="${escapeHtml(gateDraft.url)}" autocomplete="url" autocapitalize="off" autocorrect="off" spellcheck="false" inputmode="url">` : ''}
        <input type="text" class="settings-input" id="gate-user" name="username" placeholder="Identifiant" value="${escapeHtml(gateDraft.user)}" autocomplete="username" autocapitalize="off" autocorrect="off" spellcheck="false" maxlength="32">
        <input type="text" class="settings-input" id="gate-code" name="code" placeholder="Code de récupération (LZR-XXXXX-XXXXX-XXXXX)" value="${escapeHtml(gateDraft.code)}" autocomplete="off" autocapitalize="characters" autocorrect="off" spellcheck="false" maxlength="40">
        <input type="password" class="settings-input" id="gate-pass" name="password" placeholder="Nouveau mot de passe" value="${escapeHtml(gateDraft.pass)}" autocomplete="new-password" autocapitalize="off" autocorrect="off" spellcheck="false" maxlength="128">
        <input type="password" class="settings-input" id="gate-pass2" name="password2" placeholder="Confirme le nouveau mot de passe" value="${escapeHtml(gateDraft.pass2)}" autocomplete="new-password" autocapitalize="off" autocorrect="off" spellcheck="false" maxlength="128">
        ${msg}
        <button type="submit" class="btn btn-primary" id="gate-submit" ${gateBusy ? 'disabled' : ''}>${gateBusy ? 'Un instant…' : 'Changer mon mot de passe'}</button>
      </form>
      <button type="button" class="auth-link" onclick="gateBackToLogin()">Retour à la connexion</button>`;
  } else {
    const register = gateMode === 'register';
    const needUrl = !SYNC_DEFAULT_URL && !syncSavedUrl();
    body = `
      <h1 id="gate-title" class="auth-title">${register ? 'Créer ton compte' : 'Moien !'}</h1>
      <p class="auth-desc">${register
        ? "Choisis un identifiant et un mot de passe (10 caractères minimum), et saisis la clé d'accès qu'on t'a donnée. À la fin, tu recevras un code de récupération à noter : c'est lui qui te permettra de changer de mot de passe si tu l'oublies."
        : "Moi, c'est Roudi. Je t'aide à parler luxembourgeois, un mot après l'autre. Connecte-toi pour retrouver ta progression."}</p>
      <form id="gate-form" onsubmit="gateSubmit(event); return false;">
        ${needUrl ? `<input type="text" class="settings-input" id="gate-url" name="server" placeholder="Adresse du serveur (https://….workers.dev)" value="${escapeHtml(gateDraft.url)}" autocomplete="url" autocapitalize="off" autocorrect="off" spellcheck="false" inputmode="url">` : ''}
        <input type="text" class="settings-input" id="gate-user" name="username" placeholder="Identifiant" value="${escapeHtml(gateDraft.user)}" autocomplete="username" autocapitalize="off" autocorrect="off" spellcheck="false" maxlength="32">
        <input type="password" class="settings-input" id="gate-pass" name="password" placeholder="Mot de passe" value="${escapeHtml(gateDraft.pass)}" autocomplete="${register ? 'new-password' : 'current-password'}" autocapitalize="off" autocorrect="off" spellcheck="false" maxlength="128">
        ${register ? `
        <input type="password" class="settings-input" id="gate-pass2" name="password2" placeholder="Confirme le mot de passe" value="${escapeHtml(gateDraft.pass2)}" autocomplete="new-password" autocapitalize="off" autocorrect="off" spellcheck="false" maxlength="128">
        <input type="text" class="settings-input" id="gate-key" name="key" placeholder="Clé d'accès (LZ-XXXXX-XXXXX)" value="${escapeHtml(gateDraft.key)}" autocomplete="off" autocapitalize="characters" autocorrect="off" spellcheck="false" maxlength="40">` : ''}
        ${msg}
        <button type="submit" class="btn btn-primary" id="gate-submit" ${gateBusy ? 'disabled' : ''}>${gateBusy ? 'Un instant…' : (register ? 'Continuer' : 'Se connecter')}</button>
      </form>
      <button type="button" class="auth-link" onclick="gateToggleMode()">${register ? "J'ai déjà un compte" : "Pas encore de compte ? J'ai une clé d'accès"}</button>
      ${register ? '' : '<button type="button" class="auth-link" onclick="gateShowRecover()">Mot de passe oublié ?</button>'}
      ${gateOffline ? '<button type="button" class="auth-link" onclick="gateContinueOffline()">Serveur injoignable : continuer sans connexion (cette fois)</button>' : ''}`;
  }
  const withLand = gateMode === 'login' || gateMode === 'register' || gateMode === 'recover';
  const hero = withLand
    ? `<div class="auth-hero" aria-hidden="true"><svg class="auth-land" viewBox="0 0 390 360" preserveAspectRatio="xMidYMax slice"><use href="#luxland"/></svg><span class="auth-brand">LetzLift</span><svg class="auth-roudi" viewBox="0 0 150 150"><use href="#roudi"/></svg></div>`
    : `<div class="auth-hero small" aria-hidden="true"><svg class="auth-roudi" viewBox="0 0 150 150"><use href="#roudi"/></svg><span class="auth-brand">LetzLift</span></div>`;
  g.innerHTML = `<div class="auth-card" role="dialog" aria-modal="true" aria-labelledby="gate-title">${hero}<div class="auth-body">${body}</div></div>`;
}

function gateCaptureDraft(){
  if(!document.getElementById('gate-user')) return;
  gateDraft = { user:syncField('gate-user'), pass:syncField('gate-pass'), pass2:syncField('gate-pass2'), key:syncField('gate-key'), url:syncField('gate-url'), code:syncField('gate-code') };
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

function gateShowRecover(){
  gateCaptureDraft();
  gateMode = 'recover';
  gateMessage = { text:'', ok:false };
  gateDraft.pass = ''; gateDraft.pass2 = '';
  renderAuthGate();
  const first = document.getElementById('gate-code') || document.getElementById('gate-user');
  if(first) first.focus();
}

function gateBackToLogin(){
  gateCaptureDraft();
  gateMode = 'login';
  gateMessage = { text:'', ok:false };
  gateDraft.pass = ''; gateDraft.pass2 = ''; gateDraft.code = '';
  renderAuthGate();
}

// Écran « recovery » : on montre le code une fois, puis on continue vers l'app.
function gateShowRecovery(code, note){
  gateBusy = false;
  gateRecoveryCode = code;
  gateRecoveryNote = note;
  gateMode = 'recovery';
  gateMessage = { text:'', ok:false };
  gateDraft = { user:'', pass:'', pass2:'', key:'', url:'', code:'' };
  renderAuthGate();
}
function gateRecoveryCopy(){
  syncCopyText(gateRecoveryCode || '', ok => { gateMessage = { text: ok ? 'Code copié.' : 'Copie impossible : recopie le code à la main.', ok }; renderAuthGate(); });
}
async function gateRecoveryContinue(){
  const saved = document.getElementById('gate-saved');
  if(!saved || !saved.checked){
    gateMessage = { text:'Coche la case une fois ton code noté.', ok:false };
    renderAuthGate();
    return;
  }
  gateRecoveryCode = null;
  await gateEnter();
}

async function gateRecoverSubmit(e){
  if(e && e.preventDefault) e.preventDefault();
  if(gateBusy) return;
  gateCaptureDraft();
  const username = gateDraft.user.trim().toLowerCase();
  const url = gateServerUrl();
  if(!url) return gateFail('Adresse du serveur invalide : elle doit commencer par https://.');
  if(!username || !gateDraft.code.trim()) return gateFail('Saisis ton identifiant et ton code de récupération.');
  if(gateDraft.pass.length < 10) return gateFail('Nouveau mot de passe : au moins 10 caractères.');
  if(gateDraft.pass !== gateDraft.pass2) return gateFail('Les deux mots de passe ne sont pas identiques.');
  try{ localStorage.setItem('letzlift:sync-url', url); }catch(err){}
  gateBusy = true;
  gateMessage = { text:'', ok:false };
  renderAuthGate();
  const r = await syncRecover(url, username, gateDraft.code.trim(), gateDraft.pass);
  if(!r.ok){ gateMode = 'recover'; return gateFail(r.message, r.network); }
  if(r.recoveryCode) gateShowRecovery(r.recoveryCode, 'recover');
  else await gateEnter();
}

function gateBackToRegister(){
  gateMode = 'register';
  gateMessage = { text:'', ok:false };
  renderAuthGate();
}

function gateFail(text, network){
  gateBusy = false;
  gateMessage = { text: network ? 'Serveur injoignable (hors ligne ?). Réessaie, ou continue sans connexion.' : text, ok:false };
  gateOffline = !!network;
  renderAuthGate();
}

function gateServerUrl(){
  return LetzSyncCore.normalizeServerUrl(SYNC_DEFAULT_URL || syncSavedUrl() || gateDraft.url);
}

async function gateSubmit(e){
  if(e && e.preventDefault) e.preventDefault();
  if(gateBusy) return;
  gateCaptureDraft();
  const username = gateDraft.user.trim().toLowerCase();
  const password = gateDraft.pass;
  const url = gateServerUrl();
  if(!url) return gateFail('Adresse du serveur invalide : elle doit commencer par https://.');
  if(!username || !password) return gateFail('Saisis un identifiant et un mot de passe.');
  if(gateMode === 'register'){
    if(!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(username)) return gateFail('Identifiant : 3 à 32 caractères (lettres minuscules, chiffres, point, tiret, tiret bas).');
    if(password.length < 10) return gateFail('Mot de passe : au moins 10 caractères.');
    if(password !== gateDraft.pass2) return gateFail('Les deux mots de passe ne sont pas identiques.');
    if(!gateDraft.key.trim()) return gateFail('Saisis la clé d’accès qu’on t’a donnée.');
    gateMessage = { text:'', ok:false };
    gateMode = 'consent'; // étape suivante : conditions d'utilisation et choix des statistiques
    renderAuthGate();
    const first = document.getElementById('gate-first');
    if(first) first.focus();
    return;
  }
  try{ localStorage.setItem('letzlift:sync-url', url); }catch(err){}
  gateBusy = true;
  gateMessage = { text:'', ok:false };
  renderAuthGate();
  const r = await syncAuthenticate('login', url, username, password, {});
  if(!r.ok) return gateFail(r.message, r.network);
  await gateEnter();
}

async function gateRegister(analytics){
  if(gateBusy) return;
  const terms = document.getElementById('gate-terms');
  if(!terms || !terms.checked){
    gateMessage = { text:'Coche la case pour confirmer ton âge et accepter les conditions.', ok:false };
    renderAuthGate();
    return;
  }
  const url = gateServerUrl();
  if(!url) return gateFail('Adresse du serveur invalide : elle doit commencer par https://.');
  try{ localStorage.setItem('letzlift:sync-url', url); }catch(err){}
  gateBusy = true;
  gateMessage = { text:'', ok:false };
  renderAuthGate();
  const r = await syncAuthenticate('register', url, gateDraft.user.trim().toLowerCase(), gateDraft.pass, { key:gateDraft.key.trim(), analytics });
  if(!r.ok){
    gateBusy = false;
    gateMode = 'register';
    return gateFail(r.message, r.network);
  }
  if(r.recoveryCode) gateShowRecovery(r.recoveryCode, 'register'); // le compte est créé : on montre le code avant d'entrer
  else await gateEnter();
}

// Connexion réussie : on ferme l'écran, on fait la première fusion avec la copie du serveur, puis l'accueil.
async function gateEnter(){
  authGateHide();
  await syncNow();
  switchView('home');
  if(typeof telemetryStart === 'function') telemetryStart();
  if(syncMe && syncMe.analyticsConsent === null) authGateShowConsent();
}

async function gateAnswerConsent(analytics){
  if(gateBusy || !syncAuth) return;
  gateBusy = true;
  renderAuthGate();
  try{
    const res = await syncClient(syncAuth.url, syncAuth.token).consent(analytics, CONSENT_VERSION);
    if(!res.ok){ gateBusy = false; gateMessage = { text:(res.body && res.body.error) || 'Échec.', ok:false }; renderAuthGate(); return; }
    syncMe = res.body.me; syncMeAt = Date.now(); syncSaveMe();
    authGateHide();
    if(analytics && typeof telemetryStart === 'function') telemetryStart();
  }catch(e){
    gateBusy = false;
    gateMessage = { text:syncErrorText(e), ok:false };
    renderAuthGate();
  }
}

function gateConsentLater(){
  authGateHide(); // pas de collecte tant que le choix n'est pas fait ; la question reviendra à la prochaine ouverture
}

function gateContinueOffline(){
  authGateHide(); // pas de jeton : l'écran reviendra à la prochaine ouverture
}

function syncGateStartup(){
  syncLoadAuth();
  syncLoadMe(); // droits d'accès gardés en copie : le premier affichage de l'accueil en a besoin
  if(!syncAuth) authGateShow();
}
