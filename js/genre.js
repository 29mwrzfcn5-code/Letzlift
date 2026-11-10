/* ============================================================
   GENRE DES NOMS ET RÈGLE DU N (v1.33.0) — affichage, questions, suivi des erreurs.
   Logique pure : js/lib/genre-n.js et js/lib/nrule.js. Tout texte de données passe par escapeHtml().
   ============================================================ */

// Couleurs du genre (bleu masculin, rouge féminin, vert neutre) : réglage de Paramètres, actif par défaut.
function genderColorsOn(){ return userProfile.genderColors !== false; }

// Mot avec son article indéfini, l'article en couleur du genre : « e Stull » (bleu), « eng Fra » (rouge), « en Haus » (vert).
// Couleurs coupées : le mot seul, sans article ni couleur (comme avant). forceArticle : garde l'article même sans couleur.
function genderLuHTML(item, forceArticle){
  const g = LetzGenre.certainGender(item);
  if(!g || !(genderColorsOn() || forceArticle)) return escapeHtml(item.lu);
  const art = LetzNRule.indefinite(g, item.lu);
  return `<span class="${genderColorsOn() ? 'g-' + g : ''}">${escapeHtml(art)}</span> ${escapeHtml(item.lu)}`;
}

// Pastille « e Stull · masculin », montrée après la réponse (jamais avant : elle donnerait le mot).
function genderChipHTML(item){
  const g = LetzGenre.certainGender(item);
  if(!g) return '';
  return `<span class="gchip ${genderColorsOn() ? 'g-' + g + '-bg' : ''}">${genderLuHTML(item, true)} · ${LetzGenre.GENDER_LABEL[g]}</span>`;
}

// Petite légende des couleurs, à placer près d'un nom coloré.
function genderLegendHTML(){
  if(!genderColorsOn()) return '';
  return '<div class="g-legend" aria-label="Légende des couleurs"><span class="g-m">masculin</span><span class="g-f">féminin</span><span class="g-n">neutre</span></div>';
}

/* ---------- Suivi : le n et le genre, séparément ---------- */
// Une question teste le n quand sa bonne réponse en dépend : en/e et kee/keen (hors féminin), den/de, hunn/hu.
function questionTestsN(q){
  if(q.kind === 'verb') return true;
  if(q.kind === 'def') return q.gender === 'm';
  return q.gender !== 'f';
}

function recordRuleResult(q, chosen){
  const type = LetzGenre.classify(q, chosen); // null (juste), 'genre' ou 'n'
  const rs = sessionStats.ruleStats || (sessionStats.ruleStats = { n:{ok:0, ko:0}, genre:{ok:0, ko:0} });
  rs.n = rs.n || {ok:0, ko:0}; rs.genre = rs.genre || {ok:0, ko:0};
  if(type === null){ rs.genre.ok++; if(questionTestsN(q)) rs.n.ok++; }
  else if(type === 'genre'){ rs.genre.ko++; }
  else { rs.genre.ok++; rs.n.ko++; }
  saveStats();
  return type;
}

function ruleStatsSummary(){
  const rs = sessionStats.ruleStats || {};
  const one = r => {
    const ok = (r && r.ok) || 0, ko = (r && r.ko) || 0, tot = ok + ko;
    return { ok, ko, total: tot, pct: tot ? Math.round(ok / tot * 100) : null };
  };
  return { n: one(rs.n), genre: one(rs.genre) };
}

/* ---------- Une question de genre / n : affichage et correction ---------- */
function genreQuestionHTML(q, handler){
  const prompt = escapeHtml(q.prompt).replace(/___/g, '<span class="blank">?</span>');
  return `
    <div class="sentence genre-prompt">${prompt}</div>
    <div class="sentence-fr">${escapeHtml(q.hint)}</div>
    <div class="qcm-options genre-options" id="qcm-options">
      ${q.options.map((o, i) => `<button class="qcm-opt genre-opt" onclick="${handler}(this, ${i})">${escapeHtml(o)}</button>`).join('')}
    </div>`;
}

// Marque les boutons après la réponse et renvoie le HTML du retour (explication comprise).
function genreCorrectionHTML(q, chosen, buttons, clicked){
  const correct = chosen === q.answer;
  if(buttons){
    buttons.forEach(b => { b.disabled = true; if(b.textContent === q.answer) b.classList.add('correct'); });
    if(clicked && !correct) clicked.classList.add('wrong');
  }
  const type = correct ? null : LetzGenre.classify(q, chosen);
  const tag = type === 'genre' ? '<span class="rule-tag rt-genre">Erreur de genre</span>' : type === 'n' ? '<span class="rule-tag rt-n">Erreur de n</span>' : '';
  return `${correct ? '<strong>Richteg.</strong> ' : tag + ' '}<strong class="genre-phrase">${escapeHtml(q.phrase)}</strong><span class="genre-why">${escapeHtml(LetzGenre.why(q))}</span>`;
}

// Tire une question pour un mot, en privilégiant la règle la moins bien réussie (parmi les types disponibles).
function genreQuestionForItem(item){
  const kinds = LetzGenre.kindsFor(item);
  if(!kinds.length) return null;
  const s = ruleStatsSummary();
  let kind = kinds[Math.floor(Math.random() * kinds.length)];
  const nWeak = s.n.total >= 5 && s.n.pct !== null && (s.genre.pct === null || s.n.pct < s.genre.pct);
  const genreWeak = s.genre.total >= 5 && s.genre.pct !== null && (s.n.pct === null || s.genre.pct < s.n.pct);
  if(Math.random() < 0.5){
    const preferred = nWeak ? ['verb', 'indef', 'neg'] : genreWeak ? ['def', 'indef'] : [];
    const options = preferred.filter(k => kinds.indexOf(k) !== -1);
    if(options.length) kind = options[Math.floor(Math.random() * options.length)];
  }
  return LetzGenre.question(item, kind, Math.random);
}

// Carte « Tes deux points clés » (écran Niveau).
function rulePanelHTML(){
  const s = ruleStatsSummary();
  const row = (label, r, tip) => {
    const val = r.total ? `${r.pct} % <small>(${r.ok} / ${r.total})</small>` : 'pas encore d\'essai';
    const bar = r.total ? `<div class="rule-bar"><i style="width:${r.pct}%"></i></div>` : '';
    return `<div class="rule-row"><div class="rule-head"><b>${label}</b><span>${val}</span></div>${bar}<p>${tip}</p></div>`;
  };
  return `<div class="rule-panel">
    ${row('Règle du n (UNITED ZOHA)', s.n, 'Le n tombe devant les lettres qui ne sont pas dans UNITED ZOHA.')}
    ${row('Genre des noms', s.genre, 'Masculin : en/e, den/de. Féminin : eng, d\'. Neutre : en/e, d\'.')}
    <div class="cta-row"><button class="btn btn-primary" onclick="startArticleGame()">S'entraîner</button></div>
  </div>`;
}
