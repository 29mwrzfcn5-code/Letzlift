const DESCRIPTION_SCENES = [
  { id:'bureau', title:'Bureau',
    img:'assets/img/bureau.jpg',
    sentences:[
      {lu:'Den Ordinateur ass grau.', fr:'L\'ordinateur est gris.', correct:true},
      {lu:'D\'Fra huet brong Hoer.', fr:'La femme a les cheveux bruns.', correct:true},
      {lu:'Op der Wand hänkt en eidele Whiteboard.', fr:'Un tableau blanc vide est accroché au mur.', correct:true},
      {lu:'Dobaussen ass et Dag.', fr:'Dehors, il fait jour.', correct:true},
      {lu:'D\'Kaffistas ass blo.', fr:'La tasse de café est bleue.', correct:false},
      {lu:'Den Dësch ass aus Glas.', fr:'La table est en verre.', correct:false},
      {lu:'Et gëtt keng Fënster am Raum.', fr:'Il n\'y a pas de fenêtre dans la pièce.', correct:false},
      {lu:'All dräi Leit stinn.', fr:'Les trois personnes sont debout.', correct:false},
      {lu:'D\'Fra sëtzt op engem Sofa.', fr:'La femme est assise sur un canapé.', correct:false},
      {lu:'Am Raum ass en Hond.', fr:'Il y a un chien dans la pièce.', correct:false},
    ]
  },
  { id:'petitdej', title:'Petit-déjeuner',
    img:'assets/img/petitdej.jpg',
    sentences:[
      {lu:'D\'Fra dréngt Kaffi.', fr:'La femme boit du café.', correct:true},
      {lu:'D\'Fra huet e giele Pullover un.', fr:'La femme porte un pull jaune.', correct:true},
      {lu:'Op der Plack leien zwee Stécker Brout.', fr:'Il y a deux tranches de pain sur l\'assiette.', correct:true},
      {lu:'D\'Rideaue si gréng.', fr:'Les rideaux sont verts.', correct:true},
      {lu:'D\'Fra ësst Ierbëssen.', fr:'La femme mange des petits pois.', correct:false},
      {lu:'D\'Konfitür ass gréng.', fr:'La confiture est verte.', correct:false},
      {lu:'D\'Fra sëtzt dobaussen am Gaart.', fr:'La femme est assise dehors dans le jardin.', correct:false},
      {lu:'D\'Kaffistas ass schwaarz.', fr:'La tasse de café est noire.', correct:false},
      {lu:'Et si keng Fënsteren am Raum.', fr:'Il n\'y a pas de fenêtres dans la pièce.', correct:false},
      {lu:'D\'Fra liest eng Zeitung.', fr:'La femme lit un journal.', correct:false},
    ]
  },
  { id:'arret', title:'Arrêt de bus',
    img:'assets/img/arret.jpg',
    sentences:[
      {lu:'D\'Fra huet e roude Prabbeli.', fr:'La femme a un parapluie rouge.', correct:true},
      {lu:'Et reent.', fr:'Il pleut.', correct:true},
      {lu:'Den Vëlo ass blo.', fr:'Le vélo est bleu.', correct:true},
      {lu:'De Mann sëtzt op der Bänk an der Arrêt.', fr:'L\'homme est assis sur le banc de l\'arrêt.', correct:true},
      {lu:'D\'Sonn schéngt.', fr:'Le soleil brille.', correct:false},
      {lu:'De Mann steet um Vëlo.', fr:'L\'homme se tient debout sur le vélo.', correct:false},
      {lu:'D\'Fra huet kee Prabbeli.', fr:'La femme n\'a pas de parapluie.', correct:false},
      {lu:'Den Vëlo ass rout.', fr:'Le vélo est rouge.', correct:false},
      {lu:'De Buttek huet eng gréng Enseigne.', fr:'Le magasin a une enseigne verte.', correct:false},
      {lu:'D\'Fra dréit e bloe Mantel.', fr:'La femme porte un manteau bleu.', correct:false},
    ]
  },
  { id:'restaurant', title:'Restaurant',
    img:'assets/img/restaurant.jpg',
    sentences:[
      {lu:'De Mann huet e Baart.', fr:'L\'homme a une barbe.', correct:true},
      {lu:'D\'Fra drénkt roude Wäin.', fr:'La femme boit du vin rouge.', correct:true},
      {lu:'Op den Dësch steet eng Kaerz.', fr:'Il y a une bougie sur la table.', correct:true},
      {lu:'De Kelner dréit eng schwaarz Schierz.', fr:'Le serveur porte un tablier noir.', correct:true},
      {lu:'D\'Fra ësst Zalot.', fr:'La femme mange une salade.', correct:false},
      {lu:'De Mann drénkt Béier.', fr:'L\'homme boit de la bière.', correct:false},
      {lu:'D\'Fra huet schwaarz Hoer.', fr:'La femme a les cheveux noirs.', correct:false},
      {lu:'Et gëtt keen Dësch am Restaurant.', fr:'Il n\'y a pas de table dans le restaurant.', correct:false},
      {lu:'De Kelner sëtzt um Dësch.', fr:'Le serveur est assis à table.', correct:false},
      {lu:'D\'Fra dréit e giele Pullover.', fr:'La femme porte un pull jaune.', correct:false},
    ]
  },
  { id:'salon', title:'Salon familial',
    img:'assets/img/salon.jpg',
    sentences:[
      {lu:'D\'Kand spillt mat gielen Klëtzer.', fr:'L\'enfant joue avec des blocs jaunes.', correct:true},
      {lu:'D\'Kaz ass wäiss.', fr:'Le chat est blanc.', correct:true},
      {lu:'D\'Fra sëtzt op engem bloe Sofa.', fr:'La femme est assise sur un canapé bleu.', correct:true},
      {lu:'Den Teppech ass gro.', fr:'Le tapis est gris.', correct:true},
      {lu:'D\'Kand spillt mat engem Ball.', fr:'L\'enfant joue avec un ballon.', correct:false},
      {lu:'D\'Kaz ass schwaarz.', fr:'Le chat est noir.', correct:false},
      {lu:'D\'Televisioun ass ugeschalt.', fr:'La télévision est allumée.', correct:false},
      {lu:'D\'Fra läit am Bett.', fr:'La femme est allongée dans un lit.', correct:false},
      {lu:'Den Teppech ass rout.', fr:'Le tapis est rouge.', correct:false},
      {lu:'Am Raum ass kee Sofa.', fr:'Il n\'y a pas de canapé dans la pièce.', correct:false},
    ]
  },
  { id:'supermarche', title:'Supermarché',
    img:'assets/img/supermarche.jpg',
    sentences:[
      {lu:'De Mann huet keng Hoer.', fr:'L\'homme n\'a pas de cheveux.', correct:true},
      {lu:'Den Trolley ass rout.', fr:'Le chariot est rouge.', correct:true},
      {lu:'D\'Fra dréit eng violett Jackett.', fr:'La femme porte une veste violette.', correct:true},
      {lu:'Do stinn vill Fläsche mat Wäin am Regal.', fr:'Il y a beaucoup de bouteilles de vin sur l\'étagère.', correct:true},
      {lu:'D\'Fra huet kuerz Hoer.', fr:'La femme a les cheveux courts.', correct:false},
      {lu:'Den Trolley ass eidel.', fr:'Le chariot est vide.', correct:false},
      {lu:'De Mann dréit eng rout Kap.', fr:'L\'homme porte une casquette rouge.', correct:false},
      {lu:'D\'Fra kaaft Brout.', fr:'La femme achète du pain.', correct:false},
      {lu:'Den Uebstregal ass eidel.', fr:'Le rayon des fruits est vide.', correct:false},
      {lu:'Den Kuerf um Buedem ass blo.', fr:'Le panier par terre est bleu.', correct:false},
    ]
  },
  { id:'medecin', title:'Cabinet médical',
    img:'assets/img/medecin.jpg',
    sentences:[
      {lu:'D\'Dokteschin huet gro Hoer.', fr:'La médecin a les cheveux gris.', correct:true},
      {lu:'D\'Patientin huet e gréngen Pullover un.', fr:'La patiente porte un pull vert.', correct:true},
      {lu:'D\'Dokteschin schafft mat engem Ordinateur.', fr:'La médecin travaille avec un ordinateur.', correct:true},
      {lu:'Un der Wand hänkt e Squelette-Plakat.', fr:'Une affiche de squelette est accrochée au mur.', correct:true},
      {lu:'D\'Patientin läit op enger Bar.', fr:'La patiente est allongée sur une table d\'examen.', correct:false},
      {lu:'D\'Dokteschin huet schwaarz Hoer.', fr:'La médecin a les cheveux noirs.', correct:false},
      {lu:'Et gi keng Medikamenter am Raum.', fr:'Il n\'y a pas de médicaments dans la pièce.', correct:false},
      {lu:'D\'Patientin dréit e roude Rock.', fr:'La patiente porte une jupe rouge.', correct:false},
      {lu:'D\'Dokteschin dréit keng Blouse.', fr:'La médecin ne porte pas de blouse.', correct:false},
      {lu:'D\'Patientin schléift.', fr:'La patiente dort.', correct:false},
    ]
  },
  { id:'parc', title:'Au parc',
    img:'assets/img/parc.jpg',
    sentences:[
      {lu:'D\'Fra sëtzt op enger gréngter Bänk.', fr:'La femme est assise sur un banc vert.', correct:true},
      {lu:'De Mann leeft mat Kopfhörer.', fr:'L\'homme court avec des écouteurs.', correct:true},
      {lu:'D\'Kand spillt mat engem bloe Ball.', fr:'L\'enfant joue avec un ballon bleu.', correct:true},
      {lu:'D\'Buch ass rout.', fr:'Le livre est rouge.', correct:true},
      {lu:'D\'Fra liest op engem Vëlo.', fr:'La femme lit sur un vélo.', correct:false},
      {lu:'Et reent.', fr:'Il pleut.', correct:false},
      {lu:'De Mann sëtzt op enger Bänk.', fr:'L\'homme est assis sur un banc.', correct:false},
      {lu:'D\'Kand spillt mam Hond.', fr:'L\'enfant joue avec un chien.', correct:false},
      {lu:'Den Himmel ass gro.', fr:'Le ciel est gris.', correct:false},
      {lu:'D\'Kand huet blond Hoer.', fr:'L\'enfant a les cheveux blonds.', correct:false},
    ]
  },
];


/* ============================================================
   MINI-JEU — DECRIS L'IMAGE (comprehension, niveau avance)
   ============================================================ */
let imgdIndex = 0;
let imgdTotal = 0;
let imgdOrder = [];
let imgdScoreTotal = 0; // somme des classifications correctes sur toute la partie
let imgdCurrentChecked = new Set();
let imgdCurrentSceneShuffled = [];

function startImageDescGame(){
  imgdIndex = 0;
  imgdScoreTotal = 0;
  imgdOrder = [...DESCRIPTION_SCENES].sort(()=>Math.random()-0.5);
  imgdTotal = imgdOrder.length;
  switchView('imagedesc');
  nextImageDescScene();
}

function nextImageDescScene(){
  const container = document.getElementById('imagedesc-container');
  if(imgdIndex >= imgdTotal){
    const xp = Math.round(imgdScoreTotal / 2); // 1 XP tous les 2 bons classements (vrai coché / faux laissé de coté)
    addArcadeXP(xp);
    markMiniGameCompleted('imagedesc');
    container.innerHTML = `
      <div class="end-screen">
        <div class="num">${imgdScoreTotal}/${imgdTotal*10}</div>
        <p>phrases bien classées. +${xp} XP Arcade.</p>
        <div class="cta-row" style="justify-content:center;">
          <button class="btn btn-primary" onclick="switchView('home')">Accueil</button>
          <button class="btn btn-secondary" onclick="startImageDescGame()">Rejouer</button>
        </div>
      </div>`;
    return;
  }
  const scene = imgdOrder[imgdIndex];
  imgdCurrentChecked = new Set();
  const shuffled = scene.sentences.map((s,i)=>({...s, origIdx:i})).sort(()=>Math.random()-0.5);
  container.innerHTML = `
    <div class="session-card" style="max-width:560px;">
      <div class="game-header" style="width:100%;"><span>${imgdIndex+1}/${imgdTotal}</span><span>${scene.title}</span></div>
      <img src="${scene.img}" alt="${scene.title}" style="width:100%; border-radius:12px; margin-bottom:14px;">
      <div class="sentence-fr" style="margin-bottom:10px;">Coche les phrases qui décrivent bien l'image (plusieurs bonnes réponses).</div>
      <div id="imgd-options" style="display:flex; flex-direction:column; gap:8px; text-align:left;">
        ${shuffled.map((s,i) => `
          <label class="imgd-opt" id="imgd-opt-${i}" style="display:flex; gap:10px; align-items:flex-start; padding:10px 12px; border:1px solid var(--line); border-radius:10px; cursor:pointer;">
            <input type="checkbox" data-origidx="${s.origIdx}" onchange="toggleImgdOption(${i})" style="margin-top:3px;">
            <span>${s.lu}</span>
          </label>`).join('')}
      </div>
      <button class="btn btn-primary" style="margin-top:16px;" onclick="submitImageDesc()">Valider</button>
      <div class="feedback" id="imgd-feedback"></div>
      <div class="continue-wrap" id="continue-wrap-imgd"></div>
    </div>`;
  imgdCurrentSceneShuffled = shuffled;
}

function toggleImgdOption(i){
  const cb = document.querySelector(`#imgd-opt-${i} input`);
  if(cb.checked) imgdCurrentChecked.add(i); else imgdCurrentChecked.delete(i);
}

function submitImageDesc(){
  const btn = document.querySelector('#imagedesc-container .btn-primary');
  if(btn) btn.disabled = true;
  document.querySelectorAll('#imgd-options input').forEach(cb => cb.disabled = true);
  let sceneCorrectCount = 0;
  imgdCurrentSceneShuffled.forEach((s,i) => {
    const wasChecked = imgdCurrentChecked.has(i);
    const label = document.getElementById(`imgd-opt-${i}`);
    const isRight = wasChecked === s.correct;
    if(isRight) sceneCorrectCount++;
    label.classList.add(isRight ? 'correct' : 'wrong');
    if(s.correct && !wasChecked) label.style.borderStyle = 'dashed'; // vrai manqué, à repérer visuellement
  });
  imgdScoreTotal += sceneCorrectCount;
  const feedback = document.getElementById('imgd-feedback');
  feedback.className = sceneCorrectCount >= 8 ? 'feedback correct' : (sceneCorrectCount >= 5 ? 'feedback almost' : 'feedback wrong');
  feedback.textContent = `${sceneCorrectCount}/10 phrases bien classées.`;
  showContinueButton('continue-wrap-imgd', () => { imgdIndex++; nextImageDescScene(); });
}
