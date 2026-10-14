// Parseur CSV minimal (guillemets, virgules et retours à la ligne à l'intérieur d'un champ,
// guillemets doublés "" comme guillemet littéral) — un simple split(',') casserait sur toute
// phrase d'exemple contenant une virgule, ce qui est fréquent dans les nôtres.
function parseCsv(text){
  if(text.charCodeAt(0) === 0xFEFF) text = text.slice(1); // BOM ajouté par notre propre export
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for(let i = 0; i < text.length; i++){
    const c = text[i];
    if(inQuotes){
      if(c === '"'){
        if(text[i+1] === '"'){ field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else {
      if(c === '"') inQuotes = true;
      else if(c === ','){ row.push(field); field = ''; }
      else if(c === '\r'){ /* ignoré, \n gère le saut de ligne */ }
      else if(c === '\n'){ row.push(field); rows.push(row); row = []; field = ''; }
      else field += c;
    }
  }
  if(field !== '' || row.length){ row.push(field); rows.push(row); }
  return rows.filter(r => !(r.length === 1 && r[0] === ''));
}

const VOCAB_FIELD_MAX_LEN = 300;
function triggerImportVocab(){
  const input = document.getElementById('vocab-import-input');
  if(input) input.click();
}

// id déjà dans VOCAB → met à jour l'entrée (Object.assign dans applyVocabOverlay) ; id absent →
// ajoute un mot entièrement nouveau. Jamais de suppression : une ligne retirée du CSV avant
// réimport laisse simplement le mot correspondant inchangé.
async function handleImportVocabFile(input){
  const file = input.files && input.files[0];
  input.value = ''; // permet de réimporter le même fichier (même nom) une seconde fois si besoin
  if(!file) return;
  const status = document.getElementById('vocab-import-status');
  const report = (msg, ok) => { if(status){ status.textContent = msg; status.className = ok ? 'feedback correct' : 'feedback wrong'; } };

  if(file.size > MAX_BACKUP_FILE_BYTES){ report('Fichier trop volumineux.', false); return; }
  let text;
  try{ text = await file.text(); }
  catch(e){ report('Impossible de lire ce fichier.', false); return; }

  const rows = parseCsv(text);
  if(rows.length < 2){ report('Fichier vide ou illisible.', false); return; }

  const header = rows[0].map(h => h.trim());
  const idx = {
    id: header.indexOf('ID'), lu: header.indexOf('Luxembourgeois'), fr: header.indexOf('Français'),
    cat: header.indexOf('Catégorie'), g: header.indexOf('Genre'),
    sentence: header.indexOf('Phrase (LU)'), sentenceFr: header.indexOf('Phrase (FR)'), note: header.indexOf('Note'),
  };
  if(idx.id === -1 || idx.lu === -1 || idx.fr === -1){
    report('Colonnes attendues introuvables (ID, Luxembourgeois, Français) — le fichier vient-il bien du bouton "Télécharger le vocabulaire" ?', false);
    return;
  }

  const hasUnsafeChars = s => /[<>]/.test(s);
  const existingIds = new Set(VOCAB.map(v => v.id));
  let updated = 0, added = 0, skipped = 0;

  for(let i = 1; i < rows.length; i++){
    const r = rows[i];
    const id = (r[idx.id] || '').trim();
    const lu = (r[idx.lu] || '').trim();
    const fr = (r[idx.fr] || '').trim();
    const cat = (r[idx.cat] || '').trim() || 'Divers';
    const g = (r[idx.g] || '').trim();
    const sentence = (r[idx.sentence] || '').trim();
    const sentenceFr = (r[idx.sentenceFr] || '').trim();
    const note = (r[idx.note] || '').trim();
    const allFields = [id, lu, fr, cat, g, sentence, sentenceFr, note];

    if(!id || !lu || !fr){ skipped++; continue; }
    if(allFields.some(v => v.length > VOCAB_FIELD_MAX_LEN)){ skipped++; continue; }
    if(allFields.some(hasUnsafeChars)){ skipped++; continue; } // caractères < ou > refusés, même garde-fou que l'import de sauvegarde

    const entry = { lu, fr, cat };
    if(g) entry.g = g;
    if(sentence) entry.sentence = sentence;
    if(sentenceFr) entry.sentenceFr = sentenceFr;
    if(note) entry.note = note;

    vocabOverlay[id] = entry;
    if(existingIds.has(id)) updated++; else added++;
  }

  applyVocabOverlay();
  await saveVocabOverlay();

  let msg = `${updated} mot${updated>1?'s':''} modifié${updated>1?'s':''}, ${added} ajouté${added>1?'s':''}`;
  if(skipped) msg += `, ${skipped} ligne${skipped>1?'s':''} ignorée${skipped>1?'s':''} (champ manquant, trop long ou caractère non autorisé)`;
  report(msg + '.', true);
  if(typeof renderVocabEnrich === 'function') renderVocabEnrich();
}

// Export du vocabulaire en tableur (v1.17.0). CSV plutôt que .xlsx : le fichier reste un seul
// HTML autonome, sans dépendance externe à charger juste pour ce bouton — un CSV s'ouvre nativement
// dans Excel, Google Sheets ou Numbers, ce qui couvre le besoin réel sans alourdir l'app.
function csvEscape(value){
  const s = (value ?? '').toString().replace(/"/g, '""');
  return /[",\n]/.test(s) ? `"${s}"` : s;
}
function exportVocabSpreadsheet(statusElId){
  const headers = ['ID', 'Luxembourgeois', 'Français', 'Catégorie', 'Genre', 'Phrase (LU)', 'Phrase (FR)', 'Note'];
  const rows = VOCAB.map(v => [v.id, v.lu, v.fr, v.cat, v.g || '', v.sentence || '', v.sentenceFr || '', v.note || '']);
  // \uFEFF (BOM UTF-8) : sans ça, Excel sur Windows affiche mal les caractères accentués/spéciaux
  // du luxembourgeois (ë, é, etc.) à l'ouverture directe d'un CSV.
  const csv = '\uFEFF' + [headers, ...rows].map(row => row.map(csvEscape).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `letzlift-vocabulaire-${todayStr()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  const status = document.getElementById(statusElId || 'settings-export-status');
  if(status){ status.textContent = `${VOCAB.length} mots exportés.`; status.className = 'feedback correct'; }
}

function renderVocabEnrich(){
  const container = document.getElementById('vocab-enrich-container');
  const overlayCount = Object.keys(vocabOverlay).length;
  container.innerHTML = `
    <p class="list-intro">
      Modifie ou complète le vocabulaire toi-même, via un tableur — utile pour corriger une traduction,
      ajouter des mots spécifiques à ton métier, ou enrichir une phrase d'exemple.
    </p>

    <div class="settings-card">
      <div class="settings-title">1. Télécharger</div>
      <div class="settings-desc">Le vocabulaire actuel (${VOCAB.length} mots), au format tableur.</div>
      <button class="btn btn-secondary" onclick="exportVocabSpreadsheet('vocab-enrich-dl-status')">Télécharger le vocabulaire</button>
      <div class="feedback" id="vocab-enrich-dl-status"></div>
    </div>

    <div class="settings-card">
      <div class="settings-title">2. Modifier dans un tableur</div>
      <div class="settings-desc" style="margin-bottom:10px;">
        Ouvre le fichier dans Excel, Google Sheets ou Numbers, puis :
      </div>
      <ul style="font-size:13px; color:var(--ink-soft); line-height:1.7; margin:0 0 4px; padding-left:20px;">
        <li><strong>Pour corriger un mot existant</strong> : modifie la ligne, mais ne touche <strong>jamais</strong> à la colonne ID — c'est elle qui permet de retrouver le mot au réimport. La changer créerait un doublon au lieu d'une correction.</li>
        <li><strong>Pour ajouter un mot</strong> : ajoute une ligne en bas, avec un ID que tu inventes et qui n'existe pas encore (ex. <code>perso1</code>, <code>perso2</code>...). Seuls Luxembourgeois, Français et une Catégorie sont obligatoires — Genre, Phrase (LU)/(FR) et Note peuvent rester vides.</li>
        <li><strong>Le trou dans la phrase d'exemple</strong> : exactement trois traits bas, <code>___</code>, à l'endroit où le mot doit être deviné (ex. <code>Ech ginn an d'___.</code>). Sans ça, l'exercice s'affiche sans trou visible — pas d'erreur bloquante, mais l'exercice perd son sens. Une seule occurrence est remplacée : n'en mets pas deux dans la même phrase.</li>
        <li><strong>Pour retirer un mot</strong> : ce n'est pas possible par ce biais — supprimer une ligne avant de réimporter laisse simplement le mot correspondant inchangé, il ne disparaît pas. Dis-le-moi si tu veux vraiment enlever un mot.</li>
      </ul>
      <div class="settings-desc" style="margin-top:8px;">Les caractères <code>&lt;</code> et <code>&gt;</code> ne sont pas acceptés dans les champs (sécurité) — une ligne qui en contient est ignorée au réimport, sans bloquer les autres.</div>
    </div>

    <div class="settings-card">
      <div class="settings-title">3. Réimporter</div>
      <div class="settings-desc">
        Ton fichier modifié reste sur cet appareil, dans ce navigateur — comme ta progression.
        Il ne se transmet pas automatiquement si tu partages le fichier LetzLift à quelqu'un d'autre.
        ${overlayCount ? `<br><strong>${overlayCount} mot${overlayCount>1?'s':''} actuellement enrichi${overlayCount>1?'s':''}</strong> sur cet appareil.` : ''}
      </div>
      <button class="btn btn-primary" onclick="triggerImportVocab()">Réimporter le tableur modifié</button>
      <input type="file" id="vocab-import-input" accept=".csv,text/csv" style="display:none;" onchange="handleImportVocabFile(this)">
      <div class="feedback" id="vocab-import-status"></div>
    </div>
  `;
}
