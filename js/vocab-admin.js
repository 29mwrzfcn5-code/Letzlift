/* ============================================================
   VOCABULAIRE — AJOUTER, CORRIGER, SUPPRIMER UN MOT (v1.22.0)
   Formulaire de l'écran « Enrichir / modifier ». Il alimente la même surcouche que l'import CSV
   (vocabOverlay, clé letzlift:vocab-overlay) : aucun nouveau format, aucune modification du code
   pour ajouter un mot. Les règles de saisie sont dans js/lib/vocab-entry.js (testées sous Node).

   - Ajout : identifiant automatique « persoN », prise en compte immédiate (le mot entre dans les
     prochaines sessions comme n'importe quel nouveau mot).
   - Correction : n'importe quel mot, y compris du vocabulaire d'origine (la correction est une
     surcouche ; « Rétablir l'original » la retire, effet au prochain rechargement de l'app).
   - Suppression : seulement pour les mots que tu as ajoutés. La progression du mot est supprimée
     avec lui : la validation d'import des sauvegardes refuse un identifiant de mot inconnu.
   - Toute saisie affichée passe par escapeHtml().
   ============================================================ */

// Identifiants du vocabulaire d'origine, relevés AVANT que la surcouche ne soit appliquée
// (ce fichier est chargé avant init() / loadState()).
const BUILTIN_VOCAB_IDS = new Set(VOCAB.map(v => v.id));

const VA_EMPTY_DRAFT = { lu:'', fr:'', cat:'', g:'', sentence:'', sentenceFr:'', note:'' };
let vocabAdminState = {
  editingId: null,          // id du mot en cours de correction, ou null pour un ajout
  draft: { ...VA_EMPTY_DRAFT },
  errors: {},
  duplicates: [],           // mots existants avec le même luxembourgeois, à confirmer
  duplicateAckFor: null,    // luxembourgeois (normalisé) pour lequel l'ajout a été confirmé
  message: null,            // { text, ok }
  search: '',
  deleteAsk: null,          // id en attente de confirmation de suppression
};

function vaIsCustomWord(id){ return !BUILTIN_VOCAB_IDS.has(id); }

function vaCategories(){
  return [...new Set(VOCAB.map(v => v.cat))].sort((a,b) => a.localeCompare(b, 'fr'));
}

function vaWordRow(v, extraActions){
  const custom = vaIsCustomWord(v.id);
  const modified = !custom && !!vocabOverlay[v.id];
  return `<li>
      <div class="va-word"><strong>${escapeHtml(v.lu)}</strong> = ${escapeHtml(v.fr)}${custom ? '<span class="va-badge">à toi</span>' : modified ? '<span class="va-badge">modifié</span>' : ''}
        <small>${escapeHtml(v.cat)}</small></div>
      <div class="va-actions">${extraActions}</div>
    </li>`;
}

function vaField(id, label, value, opts){
  opts = opts || {};
  const err = vocabAdminState.errors[opts.key || id];
  const input = opts.select
    ? `<select class="settings-select" id="va-${id}">${opts.select}</select>`
    : `<input type="text" class="settings-input" id="va-${id}" value="${escapeHtml(value)}" autocomplete="off" maxlength="${VOCAB_FIELD_MAX_LEN}"${opts.list ? ` list="${opts.list}"` : ''}${opts.placeholder ? ` placeholder="${escapeHtml(opts.placeholder)}"` : ''}>`;
  return `<label class="va-field${err ? ' invalid' : ''}"><span>${label}</span>${input}${opts.hint ? `<div class="va-hint">${opts.hint}</div>` : ''}${err ? `<span class="va-error">${escapeHtml(err)}</span>` : ''}</label>`;
}

function renderVocabAdmin(){
  const container = document.getElementById('vocab-admin-container');
  if(!container) return;
  const st = vocabAdminState;
  const d = st.draft;
  const editing = st.editingId !== null;
  const editedWord = editing ? VOCAB.find(v => v.id === st.editingId) : null;

  const genderOptions = [['', 'Ce n’est pas un nom'], ['f', 'Féminin (eng)'], ['c', 'Masculin ou neutre (e / en)']]
    .map(([v, l]) => `<option value="${v}" ${d.g === v ? 'selected' : ''}>${l}</option>`).join('');

  const dupWarning = st.duplicates.length ? `
    <div class="va-warning">
      Un mot « ${escapeHtml(d.lu.trim())} » existe déjà : ${st.duplicates.map(x => `${escapeHtml(x.lu)} = ${escapeHtml(x.fr)}`).join(' ; ')}.
      Si c'est bien un autre sens, valide à nouveau pour l'ajouter quand même.
    </div>` : '';

  const customWords = VOCAB.filter(v => vocabOverlay[v.id] && vaIsCustomWord(v.id));
  const modifiedWords = VOCAB.filter(v => vocabOverlay[v.id] && !vaIsCustomWord(v.id));

  const q = normalize(st.search || '');
  const found = q.length >= 2
    ? VOCAB.filter(v => normalize(v.lu + ' ' + v.fr).includes(q)).slice(0, 8)
    : [];

  const editBtn = v => `<button class="btn btn-secondary" data-id="${escapeHtml(v.id)}" onclick="vocabAdminEdit(this.dataset.id)">Modifier</button>`;
  const customRow = v => vaWordRow(v, st.deleteAsk === v.id
    ? `<button class="btn btn-ghost" onclick="vocabAdminCancelDelete()">Annuler</button>
       <button class="btn btn-primary" style="background:var(--error);" data-id="${escapeHtml(v.id)}" onclick="vocabAdminConfirmDelete(this.dataset.id)">Supprimer pour de bon</button>`
    : `${editBtn(v)}<button class="btn btn-ghost" data-id="${escapeHtml(v.id)}" onclick="vocabAdminAskDelete(this.dataset.id)">Supprimer</button>`);
  const modifiedRow = v => vaWordRow(v, `${editBtn(v)}<button class="btn btn-ghost" data-id="${escapeHtml(v.id)}" onclick="vocabAdminRestore(this.dataset.id)">Rétablir l'original</button>`);

  container.innerHTML = `
    <div class="settings-card" id="va-card">
      <div class="settings-title">${editing ? `Corriger un mot${editedWord ? ` (${escapeHtml(editedWord.id)})` : ''}` : 'Ajouter un mot'}</div>
      <div class="settings-desc">
        ${editing ? 'Modifie les champs puis enregistre.' : 'Le mot est utilisable tout de suite dans les sessions, comme un nouveau mot.'}
        Tes mots restent sur cet appareil et <strong>ne font pas partie de la sauvegarde</strong> : télécharge « mes mots » (plus bas) pour les conserver.
      </div>
      ${st.message ? `<div class="feedback ${st.message.ok ? 'correct' : 'wrong'}" style="margin:0 0 10px;">${escapeHtml(st.message.text)}</div>` : ''}
      ${dupWarning}
      <form onsubmit="vocabAdminSave(); return false;">
        <div class="va-row">
          ${vaField('lu', 'Luxembourgeois *', d.lu, { placeholder: 'ex. Kuerf' })}
          ${vaField('fr', 'Français *', d.fr, { placeholder: 'ex. panier' })}
        </div>
        <div class="va-row">
          ${vaField('cat', 'Catégorie *', d.cat, { list: 'va-cat-list', hint: 'Choisis une catégorie existante ou tape-en une nouvelle.' })}
          ${vaField('g', 'Genre', '', { select: genderOptions, hint: 'Sert à l’exercice « e, en ou eng ? ».' })}
        </div>
        <datalist id="va-cat-list">${vaCategories().map(c => `<option value="${escapeHtml(c)}">`).join('')}</datalist>
        ${vaField('sentence', 'Phrase d’exemple (luxembourgeois) *', d.sentence, { hint: 'Mets <code>___</code> (trois traits bas) à la place du mot. Ex. : <code>Ech hunn e ___.</code>' })}
        ${vaField('sentenceFr', 'Traduction de la phrase *', d.sentenceFr)}
        ${vaField('note', 'Note (facultatif)', d.note)}
        <div class="cta-row">
          <button type="submit" class="btn btn-primary">${editing ? 'Enregistrer' : st.duplicates.length ? 'Ajouter quand même' : 'Ajouter le mot'}</button>
          ${editing || st.duplicates.length ? '<button type="button" class="btn btn-ghost" onclick="vocabAdminCancelEdit()">Annuler</button>' : ''}
        </div>
      </form>

      <div class="va-sub">Corriger un mot existant</div>
      <label class="va-field" style="margin-top:6px;"><span>Chercher (luxembourgeois ou français)</span>
        <input type="text" class="settings-input" id="va-search" value="${escapeHtml(st.search)}" autocomplete="off" oninput="vocabAdminSearch(this.value)" placeholder="au moins 2 lettres">
      </label>
      ${q.length >= 2 ? (found.length ? `<ul class="va-list">${found.map(v => vaWordRow(v, editBtn(v))).join('')}</ul>` : '<div class="va-hint">Aucun mot ne correspond.</div>') : ''}

      ${customWords.length ? `<div class="va-sub">Mes mots (${customWords.length})</div><ul class="va-list">${customWords.map(customRow).join('')}</ul>` : ''}
      ${modifiedWords.length ? `<div class="va-sub">Mots d'origine modifiés (${modifiedWords.length})</div><ul class="va-list">${modifiedWords.map(modifiedRow).join('')}</ul>` : ''}

      <div class="va-sub">Copie de secours</div>
      <div class="settings-desc" style="margin:4px 0 8px;">
        ${customWords.length + modifiedWords.length
          ? `${customWords.length + modifiedWords.length} mot${customWords.length + modifiedWords.length > 1 ? 's' : ''} à toi sur cet appareil. Le fichier se réimporte avec « 3. Réimporter » ci-dessous, sur n'importe quelle installation.`
          : 'Rien à sauvegarder pour l’instant : tu n’as ajouté ni modifié aucun mot.'}
      </div>
      <button class="btn btn-secondary" onclick="exportVocabSpreadsheet('va-export-status', true)" ${customWords.length + modifiedWords.length ? '' : 'disabled'}>Télécharger mes mots</button>
      <div class="feedback" id="va-export-status"></div>
    </div>`;
}

function vaReadDraft(){
  const get = id => { const el = document.getElementById('va-' + id); return el ? el.value : ''; };
  return { lu: get('lu'), fr: get('fr'), cat: get('cat'), g: get('g'), sentence: get('sentence'), sentenceFr: get('sentenceFr'), note: get('note') };
}

function vocabAdminSearch(value){
  vocabAdminState.search = value;
  // le champ de recherche est recréé par le rendu : on garde le curseur et le texte du formulaire en cours
  vocabAdminState.draft = vaReadDraft();
  renderVocabAdmin();
  const el = document.getElementById('va-search');
  if(el){ el.focus(); el.setSelectionRange(value.length, value.length); }
}

async function vocabAdminSave(){
  const st = vocabAdminState;
  st.draft = vaReadDraft();
  st.message = null;
  const res = validateVocabEntry(st.draft);
  st.errors = res.errors;
  if(!res.ok){
    st.duplicates = [];
    st.message = { text: 'Corrige les champs signalés.', ok: false };
    renderVocabAdmin();
    return;
  }
  const editing = st.editingId !== null;
  const key = st.draft.lu.trim().toLowerCase();
  if(!editing){
    const dups = findDuplicateWords(st.draft.lu, VOCAB, null);
    if(dups.length && st.duplicateAckFor !== key){
      st.duplicates = dups;
      st.duplicateAckFor = key; // le prochain clic, sur le même mot, vaut confirmation
      renderVocabAdmin();
      return;
    }
  }
  const id = editing ? st.editingId : nextPersonalId([...VOCAB.map(v => v.id), ...Object.keys(vocabOverlay)]);
  const entry = res.entry;
  if(editing){
    // Object.assign (applyVocabOverlay) ne retire jamais un champ : pour vider le genre ou la
    // note d'un mot existant, on écrit une chaîne vide explicite.
    if(entry.g === undefined) entry.g = '';
    if(entry.note === undefined) entry.note = '';
  }
  vocabOverlay[id] = entry;
  applyVocabOverlay();
  await saveVocabOverlay();
  st.message = { text: editing ? `Mot « ${entry.lu} » enregistré.` : `Mot « ${entry.lu} » ajouté (${id}).`, ok: true };
  st.editingId = null;
  st.draft = { ...VA_EMPTY_DRAFT, cat: st.draft.cat }; // garde la catégorie : on saisit souvent plusieurs mots d'affilée
  st.errors = {}; st.duplicates = []; st.duplicateAckFor = null;
  renderVocabAdmin();
  const lu = document.getElementById('va-lu');
  if(lu) lu.focus();
}

function vocabAdminEdit(id){
  const v = VOCAB.find(x => x.id === id);
  if(!v) return;
  vocabAdminState = { ...vocabAdminState, editingId: id, errors: {}, duplicates: [], duplicateAckFor: null, message: null, deleteAsk: null,
    draft: { lu: v.lu || '', fr: v.fr || '', cat: v.cat || '', g: v.g || '', sentence: v.sentence || '', sentenceFr: v.sentenceFr || '', note: v.note || '' } };
  renderVocabAdmin();
  const card = document.getElementById('va-card');
  if(card) card.scrollIntoView({ block: 'start' });
}

function vocabAdminCancelEdit(){
  vocabAdminState = { ...vocabAdminState, editingId: null, draft: { ...VA_EMPTY_DRAFT }, errors: {}, duplicates: [], duplicateAckFor: null, message: null };
  renderVocabAdmin();
}

function vocabAdminAskDelete(id){
  vocabAdminState.deleteAsk = id;
  vocabAdminState.draft = vaReadDraft();
  renderVocabAdmin();
}
function vocabAdminCancelDelete(){
  vocabAdminState.deleteAsk = null;
  vocabAdminState.draft = vaReadDraft();
  renderVocabAdmin();
}

// Supprime un mot AJOUTÉ PAR TOI (jamais un mot d'origine) et sa progression : sans ça, une
// sauvegarde exportée ensuite contiendrait un identifiant inconnu et serait refusée à l'import.
async function vocabAdminConfirmDelete(id){
  const st = vocabAdminState;
  if(!vaIsCustomWord(id)) return;
  const idx = VOCAB.findIndex(v => v.id === id);
  const word = idx >= 0 ? VOCAB[idx] : null;
  if(idx >= 0) VOCAB.splice(idx, 1);
  delete vocabOverlay[id];
  const hadProgress = !!vocabProgress[id];
  delete vocabProgress[id];
  await saveVocabOverlay();
  if(hadProgress) await saveVocabProgress();
  st.deleteAsk = null;
  if(st.editingId === id){ st.editingId = null; st.draft = { ...VA_EMPTY_DRAFT }; }
  else st.draft = vaReadDraft();
  st.message = { text: word ? `Mot « ${word.lu} » supprimé.` : 'Mot supprimé.', ok: true };
  renderVocabAdmin();
}

// Retire la correction d'un mot d'origine. VOCAB a déjà été modifié en mémoire (Object.assign) et
// l'original n'est pas conservé : le retour à l'original ne se voit qu'au prochain chargement.
async function vocabAdminRestore(id){
  if(vaIsCustomWord(id) || !vocabOverlay[id]) return;
  delete vocabOverlay[id];
  await saveVocabOverlay();
  vocabAdminState.draft = vaReadDraft();
  vocabAdminState.message = { text: 'Correction retirée : le mot d’origine reviendra au prochain rechargement de l’app.', ok: true };
  renderVocabAdmin();
}
