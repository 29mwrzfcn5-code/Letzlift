/* ============================================================
   MINI-JEU — TIMELINE
   Un texte narratif court, six moments-clés à remettre dans l'ordre chronologique.
   Réutilise le mécanisme de puces cliquables de "Remise en ordre" (scramble-chips/placed),
   sur des variables d'état dédiées pour ne pas interférer avec pdPlaced/pdTarget.
   Un seul texte pour l'instant (validation du concept) — structure prête pour en accueillir d'autres.
   ============================================================ */
const TIMELINE_TEXTS = [
  {
    id: 'nadia_journee',
    title: 'Journée de Nadia',
    lines: [
      { lu:"Nadia steet um sechs Auer op.", fr:"Nadia se lève à six heures." },
      { lu:"Si duscht sech a kämmt sech.", fr:"Elle se douche et se coiffe." },
      { lu:"Ëm hallwer siwen ësst si Kaffi a Brout.", fr:"À six heures et demie, elle prend du café et du pain." },
      { lu:"Ëm siwe Auer hëlt si de Bus an d'Aarbecht.", fr:"À sept heures, elle prend le bus pour aller au travail." },
      { lu:"Am Büro liest si als éischt hir E-Mailen.", fr:"Au bureau, elle lit d'abord ses e-mails." },
      { lu:"Ëm néng Auer huet si eng Reunioun mat hire Kolleegen.", fr:"À neuf heures, elle a une réunion avec ses collègues." },
      { lu:"Duerno schafft si un hirem Projet bis Mëttes.", fr:"Ensuite, elle travaille sur son projet jusqu'à midi." },
      { lu:"Ëm zwielef Auer iesst si an der Kantine mat enger Kolleegin.", fr:"À midi, elle mange à la cantine avec une collègue." },
      { lu:"Nom Mëttegiessen mécht si eng kleng Paus.", fr:"Après le déjeuner, elle fait une petite pause." },
      { lu:"Am Nomëtteg ruft si e Client un.", fr:"Dans l'après-midi, elle appelle un client." },
      { lu:"Ëm véier Auer trëfft si sech mam Chef fir en Update.", fr:"À seize heures, elle retrouve son chef pour un point d'avancement." },
      { lu:"Ëm fënnef Auer fiert si mam Bus heem.", fr:"À dix-sept heures, elle rentre en bus." },
      { lu:"Doheem kacht si den Owend fir sech an hire Mann.", fr:"À la maison, elle cuisine le dîner pour elle et son mari." },
      { lu:"Ëm aacht Auer kucken si zesummen e Film.", fr:"À vingt heures, ils regardent un film ensemble." },
      { lu:"Ëm zéng Auer geet si schlofen.", fr:"À vingt-deux heures, elle va se coucher." },
    ],
    events: [
      { lu:"Nadia steet op.", fr:"Nadia se lève." },
      { lu:"Si ësst Kaffi a Brout.", fr:"Elle prend du café et du pain." },
      { lu:"Reunioun mat de Kolleegen.", fr:"Réunion avec les collègues." },
      { lu:"Mëttegiessen an der Kantine.", fr:"Déjeuner à la cantine." },
      { lu:"Update mam Chef.", fr:"Point d'avancement avec le chef." },
      { lu:"Si kuckt en Film den Owend.", fr:"Elle regarde un film le soir." },
    ]
  }
];

let tlText = null;
let tlPlaced = [];
let tlShowFr = false;

function startTimelineGame(){
  tlText = TIMELINE_TEXTS[Math.floor(Math.random() * TIMELINE_TEXTS.length)];
  tlPlaced = [];
  tlShowFr = false;
  switchView('timeline');
  renderTimelineGame();
}

function toggleTimelineFr(){
  tlShowFr = !tlShowFr;
  renderTimelineGame();
}

function renderTimelineGame(){
  const container = document.getElementById('timeline-container');
  const shuffled = tlText.events.map((e,i)=>({...e, idx:i})).sort(()=>Math.random()-0.5);
  container.innerHTML = `
    <div class="session-card">
      <div class="hint" style="margin-bottom:10px;">Timeline · ${tlText.title}</div>
      <div class="sentence-fr" style="margin-bottom:12px;">Lis le texte, puis remets les six moments dans l'ordre chronologique.</div>
      <div class="timeline-text" id="timeline-text">
        ${tlText.lines.map(l => `<p>${l.lu}${tlShowFr ? `<br><span class="timeline-fr">${l.fr}</span>` : ''}</p>`).join('')}
      </div>
      <button class="btn btn-ghost" style="margin:10px 0 18px;" onclick="toggleTimelineFr()">${tlShowFr ? 'Masquer' : 'Afficher'} la traduction</button>
      <div class="scramble-answer" id="timeline-answer"></div>
      <div class="scramble-chips" id="timeline-chips">
        ${shuffled.map(e => `<button class="scramble-chip" id="tl-chip-${e.idx}" onclick="placeTimelineChip(${e.idx})">${e.lu}</button>`).join('')}
      </div>
      <div class="feedback" id="timeline-feedback"></div>
      <div class="continue-wrap" id="continue-wrap-timeline"></div>
    </div>`;
  // Ré-affiche les puces déjà placées si on revient d'un simple bascule de traduction
  tlPlaced.forEach(p => {
    const chip = document.getElementById(`tl-chip-${p.idx}`);
    if(chip) chip.classList.add('used');
  });
  if(tlPlaced.length){
    const answerZone = document.getElementById('timeline-answer');
    tlPlaced.forEach(p => {
      const span = document.createElement('button');
      span.className = 'placed';
      span.textContent = p.lu;
      span.onclick = () => unplaceTimelineChip(p.idx);
      span.id = `tl-placed-${p.idx}`;
      answerZone.appendChild(span);
    });
  }
}

function placeTimelineChip(idx){
  const chip = document.getElementById(`tl-chip-${idx}`);
  if(chip.classList.contains('used')) return;
  chip.classList.add('used');
  tlPlaced.push({ idx, lu: tlText.events[idx].lu });
  const answerZone = document.getElementById('timeline-answer');
  const span = document.createElement('button');
  span.className = 'placed';
  span.textContent = tlText.events[idx].lu;
  span.onclick = () => unplaceTimelineChip(idx);
  span.id = `tl-placed-${idx}`;
  answerZone.appendChild(span);
  if(tlPlaced.length === tlText.events.length) checkTimelineOrder();
}

function unplaceTimelineChip(idx){
  tlPlaced = tlPlaced.filter(p => p.idx !== idx);
  const placedEl = document.getElementById(`tl-placed-${idx}`);
  if(placedEl) placedEl.remove();
  const chip = document.getElementById(`tl-chip-${idx}`);
  if(chip) chip.classList.remove('used');
}

function checkTimelineOrder(){
  // Chaque événement a été créé dans l'ordre chronologique (idx 0..5) : la bonne réponse
  // est donc simplement la séquence 0,1,2,3,4,5. Score au prorata des positions correctes,
  // jamais tout-ou-rien — cohérent avec le principe "jamais punitif" du projet.
  document.querySelectorAll('#timeline-chips .scramble-chip').forEach(b => b.disabled = true);
  document.querySelectorAll('#timeline-answer .placed').forEach(b => b.disabled = true);
  let correctCount = 0;
  tlPlaced.forEach((p, position) => {
    const el = document.getElementById(`tl-placed-${p.idx}`);
    if(p.idx === position){ correctCount++; if(el) el.classList.add('correct'); }
    else if(el) el.classList.add('wrong');
  });
  const xp = correctCount * 2;
  addArcadeXP(xp);
  markMiniGameCompleted('timeline');
  // Badge "Buergbrennen" (le feu de fin d'hiver qui marque le passage du temps) : chronologie
  // entièrement correcte, du premier au dernier événement.
  if(correctCount === tlText.events.length && !gameRecords.timelinePerfect){
    gameRecords.timelinePerfect = true; saveGameRecords();
  }
  const feedback = document.getElementById('timeline-feedback');
  feedback.className = correctCount === tlText.events.length ? 'feedback correct' : 'feedback almost';
  feedback.textContent = `${correctCount}/${tlText.events.length} bien placés. +${xp} XP Arcade.`;
  const wrap = document.getElementById('continue-wrap-timeline');
  wrap.innerHTML = `
    <div class="cta-row" style="justify-content:center; margin-top:16px;">
      <button class="btn btn-primary" onclick="switchView('home')">Accueil</button>
      <button class="btn btn-secondary" onclick="startTimelineGame()">Rejouer</button>
    </div>`;
}
