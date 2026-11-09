/* ============================================================
   STATISTIQUES D'USAGE
   Actives seulement si le compte est connecté ET a accepté les statistiques (choix libre, modifiable
   dans Paramètres ; refuser supprime ce qui a été collecté). Événements minimaux : ouverture de
   l'app, écran consulté, fin de session (type, durée, nombre de réponses, identifiants des cartes
   ratées), accueil terminé, erreur technique. Jamais de texte saisi, jamais de contenu personnel.
   Envoi groupé toutes les 30 secondes, à la fermeture de la page et par lots de 20.
   ============================================================ */
const TELEMETRY_FLUSH_MS = 30000;
const TELEMETRY_BATCH = 20;
let telemetryQueue = [];
let telemetryTimer = null;
let telemetryOpened = false;

function telemetryEnabled(){
  return !!(syncAuth && syncMe && syncMe.analyticsConsent === true);
}

function telemetryAppVersion(){
  const pill = document.querySelector('.version-pill');
  const text = pill ? String(pill.textContent || '') : '';
  return text.replace(/^v/, '').slice(0, 12) || 'inconnue';
}

function track(name, props){
  if(!telemetryEnabled()) return;
  telemetryQueue.push({ name, ts:Date.now(), props: props || {} });
  if(telemetryQueue.length >= TELEMETRY_BATCH){ telemetryFlush(); return; }
  if(!telemetryTimer) telemetryTimer = setTimeout(() => { telemetryTimer = null; telemetryFlush(); }, TELEMETRY_FLUSH_MS);
}

async function telemetryFlush(onClose){
  clearTimeout(telemetryTimer); telemetryTimer = null;
  if(!telemetryEnabled()){ telemetryQueue = []; return; }
  while(telemetryQueue.length){
    const batch = telemetryQueue.splice(0, 50);
    try{
      if(onClose){
        // à la fermeture de la page : requête « keepalive », qui survit au déchargement
        fetch(syncAuth.url + '/api/events', { method:'POST', keepalive:true, credentials:'omit',
          headers:{ 'Content-Type':'application/json', 'Authorization':'Bearer ' + syncAuth.token }, body:JSON.stringify({ events:batch }) });
      } else {
        const res = await syncClient(syncAuth.url, syncAuth.token).events(batch);
        if(res.status === 401) return;
      }
    }catch(e){ return; } // hors ligne : ces événements sont perdus, sans conséquence
  }
}

// Appelée dès que le profil du compte est connu : une seule ouverture par chargement de page.
function telemetryStart(){
  if(!telemetryEnabled() || telemetryOpened) return;
  telemetryOpened = true;
  track('app_open', { v: telemetryAppVersion() });
}

// Déconnexion, suppression du compte ou refus des statistiques : on oublie tout ce qui n'est pas parti.
function telemetryReset(){
  telemetryQueue = [];
  clearTimeout(telemetryTimer); telemetryTimer = null;
  telemetryOpened = false;
}

function telemetrySessionEnd(kind, startedAt, answered, correct, wrongIds){
  track('session_end', {
    kind,
    seconds: startedAt ? Math.round((Date.now() - startedAt) / 1000) : 0,
    answered: answered || 0, correct: correct || 0,
    wrong: (wrongIds || []).slice(0, 20),
  });
}

document.addEventListener('visibilitychange', () => { if(document.hidden) telemetryFlush(true); });
window.addEventListener('pagehide', () => telemetryFlush(true));
window.addEventListener('error', e => track('error', { msg: String(e && e.message || 'erreur') }));
window.addEventListener('unhandledrejection', e => track('error', { msg: String(e && e.reason && e.reason.message || e && e.reason || 'promesse rejetée') }));
