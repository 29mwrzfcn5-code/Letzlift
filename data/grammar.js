/* ============================================================
   DONNÉES — GRAMMAIRE
   ============================================================ */
const GRAMMAR = [
  {
    id:'g1',
    title:'Le verbe « sinn » (être)',
    eyebrow:'Conjugaison',
    summary:'Le verbe le plus fréquent, entièrement irrégulier — à apprendre par cœur en premier.',
    rule:`
      <p>« Sinn » (être) est irrégulier à toutes les personnes. C'est la base de toute phrase descriptive.</p>
      <table>
        <tr><td>ech sinn</td><td>je suis</td></tr>
        <tr><td>du bass</td><td>tu es</td></tr>
        <tr><td>hie/si/hatt ass</td><td>il/elle est</td></tr>
        <tr><td>mir sinn</td><td>nous sommes</td></tr>
        <tr><td>dir sidd</td><td>vous êtes</td></tr>
        <tr><td>si sinn</td><td>ils/elles sont</td></tr>
      </table>`,
    exercises:[
      {type:'mc', q:'Ech ___ midd haut owend.', options:['sinn','bass','ass'], answer:'sinn'},
      {type:'mc', q:'Du ___ ganz frou.', options:['sinn','bass','sidd'], answer:'bass'},
      {type:'mc', q:'Si (elle) ___ nach am Büro.', options:['sinn','bass','ass'], answer:'ass'},
      {type:'mc', q:'Mir ___ Kolleegen zënter Joren.', options:['sinn','sidd','ass'], answer:'sinn'},
      {type:'mc', q:'Dir ___ ëmmer wëllkomm.', options:['sinn','sidd','ass'], answer:'sidd'},
      {type:'mc', q:'Mir ___ midd no der Aarbecht.', options:['sinn','sidd','ass'], answer:'sinn'},
      {type:'mc', q:'Hatt ___ nach kleng.', options:['sinn','bass','ass'], answer:'ass'},
    ]
  },
  {
    id:'g2',
    title:'Le verbe « hunn » (avoir)',
    eyebrow:'Conjugaison',
    summary:'Deuxième verbe irrégulier essentiel, utilisé aussi comme auxiliaire au parfait.',
    rule:`
      <p>« Hunn » (avoir) sert aussi d'auxiliaire pour former le passé composé (Perfekt) de la plupart des verbes.</p>
      <table>
        <tr><td>ech hunn</td><td>j'ai</td></tr>
        <tr><td>du hues</td><td>tu as</td></tr>
        <tr><td>hie/si/hatt huet</td><td>il/elle a</td></tr>
        <tr><td>mir hunn</td><td>nous avons</td></tr>
        <tr><td>dir hutt</td><td>vous avez</td></tr>
        <tr><td>si hunn</td><td>ils/elles ont</td></tr>
      </table>`,
    exercises:[
      {type:'mc', q:'Ech ___ eng nei Aarbecht.', options:['hunn','hues','huet'], answer:'hunn'},
      {type:'mc', q:'Hien ___ haut vill ze dinn.', options:['hunn','huet','hutt'], answer:'huet'},
      {type:'mc', q:'Mir ___ scho giess.', options:['hunn','hutt','huet'], answer:'hunn'},
      {type:'mc', q:'Du ___ Recht.', options:['hunn','hues','huet'], answer:'hues'},
      {type:'mc', q:'Dir ___ e schéint Haus.', options:['hunn','hues','hutt'], answer:'hutt'},
      {type:'mc', q:'Si (ils) ___ vill Aarbecht.', options:['hunn','hutt','huet'], answer:'hunn'},
      {type:'mc', q:'Ech ___ keng Zäit haut.', options:['hunn','hues','huet'], answer:'hunn'},
    ]
  },
  {
    id:'g3',
    title:"Les articles (nominatif)",
    eyebrow:'Articles',
    summary:"Trois genres et une règle orthographique essentielle : la n-Regel.",
    rule:`
      <p>Le luxembourgeois distingue trois genres. Au nominatif, le féminin prend <strong>eng</strong>. Le masculin et le neutre prennent <strong>e</strong> ou <strong>en</strong> selon la <strong>n-Regel</strong>.</p>
      <table>
        <tr><td>Masculin</td><td>de Mann / e Mann</td></tr>
        <tr><td>Féminin</td><td>d' / eng Fra</td></tr>
        <tr><td>Neutre</td><td>d' / e Kand</td></tr>
        <tr><td>Pluriel</td><td>d'Kanner (pas d'article indéfini)</td></tr>
      </table>
      <p style="margin-top:10px;"><strong>n-Regel :</strong> le <em>n</em> final est conservé devant une voyelle ou devant <strong>d, h, n, t, z</strong> : « en Auto », « en Dokter ». Ailleurs, il tombe : « e Mann », « e Buch ».</p>
      <p style="margin-top:10px;">Au datif (après « bei », « mat », « vun »...), le masculin/neutre devient « dem » et le féminin « der ».</p>`,
    exercises:[
      {type:'mc', q:'___ Haus ass ganz grouss. (le)', options:['Den','D\'','De'], answer:'D\''},
      {type:'mc', q:'Ech hu ___ Bréif kritt. (un, masc.)', options:['e','eng','en'], answer:'e'},
      {type:'mc', q:'Si huet ___ nei Aarbecht. (une, fém.)', options:['e','eng','en'], answer:'eng'},
      {type:'mc', q:'___ Mann schafft am Büro. (le, masc.)', options:['De','D\'','Dem'], answer:'De'},
      {type:'mc', q:'___ Fra schafft am Spidol. (la)', options:['Den','D\'','Dem'], answer:'D\''},
      {type:'mc', q:'Ech kafen ___ Buch. (un, neutre)', options:['e','eng','en'], answer:'e'},
      {type:'mc', q:'Ech hunn ___ Auto. (une voiture)', options:['e','eng','en'], answer:'en'},
    ]
  },
  {
    id:'g4',
    title:"L'ordre des mots (verbe en 2e position)",
    eyebrow:'Syntaxe',
    summary:"Comme en allemand, le verbe conjugué occupe toujours la 2e position de la phrase.",
    rule:`
      <p>Peu importe ce qui commence la phrase (sujet, complément de temps, complément de lieu...), le verbe conjugué reste toujours en 2e position. Le sujet passe alors après le verbe.</p>
      <p style="margin-top:8px;"><strong>Ech ginn haut schaffen.</strong> (Je vais travailler aujourd'hui.)<br>
      <strong>Haut ginn ech schaffen.</strong> (Aujourd'hui, je vais travailler.)</p>
      <p style="margin-top:8px;">Le verbe reste en 2e position, même si « haut » prend la première place.</p>`,
    exercises:[
      {type:'mc', q:'Choisis la phrase correcte pour "Demain, nous allons à la fête."', options:['Muer mir ginn op d\'Fest.','Muer ginn mir op d\'Fest.','Mir muer ginn op d\'Fest.'], answer:'Muer ginn mir op d\'Fest.'},
      {type:'mc', q:'Choisis la phrase correcte pour "Au bureau, je travaille beaucoup."', options:['Am Büro schaffen ech vill.','Am Büro ech schaffen vill.','Schaffen am Büro ech vill.'], answer:'Am Büro schaffen ech vill.'},
      {type:'mc', q:'Choisis la phrase correcte pour "Après le travail, je vais chez ma mère."', options:['No der Aarbecht ech ginn bei meng Mamm.','No der Aarbecht ginn ech bei meng Mamm.','Ech no der Aarbecht ginn bei meng Mamm.'], answer:'No der Aarbecht ginn ech bei meng Mamm.'},
      {type:'mc', q:'Choisis la phrase correcte pour "Ce week-end, nous restons à la maison."', options:['Dëse Weekend bleiwe mir doheem.','Dëse Weekend mir bleiwen doheem.','Bleiwe mir dëse Weekend doheem.'], answer:'Dëse Weekend bleiwe mir doheem.'},
    ]
  },
  {
    id:'g5',
    title:'Les verbes réguliers au présent',
    eyebrow:'Conjugaison',
    summary:'Le schéma régulier en -en, applicable à la majorité des verbes.',
    rule:`
      <p>La majorité des verbes suivent ce modèle (ex. « schaffen », travailler) :</p>
      <table>
        <tr><td>ech schaffen</td><td>je travaille</td></tr>
        <tr><td>du schaffs</td><td>tu travailles</td></tr>
        <tr><td>hie/si/hatt schafft</td><td>il/elle travaille</td></tr>
        <tr><td>mir schaffen</td><td>nous travaillons</td></tr>
        <tr><td>dir schafft</td><td>vous travaillez</td></tr>
        <tr><td>si schaffen</td><td>ils/elles travaillent</td></tr>
      </table>
      <p style="margin-top:10px;">Astuce : « du » et « hien/si/hatt » se ressemblent souvent (schaffs / schafft), attention à la terminaison.</p>`,
    exercises:[
      {type:'mc', q:'Ech ___ (schaffen) am Büro.', options:['schaffen','schaffs','schafft'], answer:'schaffen'},
      {type:'mc', q:'Du ___ (kachen) haut Owend.', options:['kachen','kachs','kacht'], answer:'kachs'},
      {type:'mc', q:'Hatt ___ (spillen) am Gaart.', options:['spillen','spills','spillt'], answer:'spillt'},
      {type:'mc', q:'Mir ___ (léieren) Lëtzebuergesch.', options:['léieren','léiert','léiers'], answer:'léieren'},
      {type:'mc', q:'Si (elle) ___ (kachen) all Dag.', options:['kachen','kachs','kacht'], answer:'kacht'},
      {type:'mc', q:'Dir ___ (schwätzen) ze séier.', options:['schwätzen','schwätzt','schwätzs'], answer:'schwätzt'},
    ]
  },
  {
    id:'g6',
    title:"Dire l'heure",
    eyebrow:'Usage',
    summary:"Essentiel pour le small talk et testé à l'oral du Sproochentest.",
    rule:`
      <p>Pour l'heure pile : <strong>Et ass + chiffre + Auer</strong> (Et ass aacht Auer = il est huit heures).</p>
      <p style="margin-top:8px;">Pour la demi-heure, comme en allemand, on se projette vers l'heure <em>suivante</em> : <strong>hallwer + heure suivante</strong>. 14h30 se dit "hallwer dräi" (littéralement "la moitié vers trois"), pas "hallwer zwee".</p>
      <p style="margin-top:8px;">Pour le quart : <strong>Véierel no</strong> (et quart) et <strong>Véierel vir</strong> (moins le quart).</p>
      <table>
        <tr><td>14:00</td><td>Et ass zwou Auer</td></tr>
        <tr><td>14:15</td><td>Véierel no zwou</td></tr>
        <tr><td>14:30</td><td>hallwer dräi</td></tr>
        <tr><td>14:45</td><td>Véierel vir dräi</td></tr>
      </table>`,
    exercises:[
      {type:'mc', q:'14:30 → ?', options:['hallwer dräi','hallwer véier','Véierel vir dräi'], answer:'hallwer dräi'},
      {type:'mc', q:'8:15 → ?', options:['Véierel no aacht','Véierel vir aacht','hallwer aacht'], answer:'Véierel no aacht'},
      {type:'mc', q:'8:45 → ?', options:['Véierel vir néng','Véierel no aacht','hallwer néng'], answer:'Véierel vir néng'},
      {type:'mc', q:'10:00 → ?', options:['Et ass zéng Auer','Et ass hallwer zéng','Et ass Véierel vir zéng'], answer:'Et ass zéng Auer'},
      {type:'mc', q:'17:30 → ?', options:['hallwer sechs','hallwer siwen','Véierel no fënnef'], answer:'hallwer sechs'},
      {type:'mc', q:'9:15 → ?', options:['Véierel no néng','Véierel vir néng','hallwer néng'], answer:'Véierel no néng'},
      {type:'mc', q:'15:45 → ?', options:['Véierel vir véier','hallwer véier','Véierel no véier'], answer:'Véierel vir véier'},
    ]
  },
  {
    id:'g7',
    title:'Le datif (après mat, bei, vun...)',
    eyebrow:'Cas',
    summary:'Après certaines prépositions, les articles changent de forme.',
    rule:`
      <p>Après les prépositions <strong>mat</strong> (avec), <strong>bei</strong> (chez), <strong>vun</strong> (de), <strong>no</strong> (après), <strong>zu</strong> (à), l'article passe au datif :</p>
      <table>
        <tr><td>Masculin / Neutre</td><td>den/d' → <strong>dem</strong> (mat dem Auto)</td></tr>
        <tr><td>Féminin</td><td>d' → <strong>der</strong> (mat der Kolleegin)</td></tr>
        <tr><td>Pluriel</td><td>d' → <strong>den</strong> (mat den Kanner)</td></tr>
      </table>
      <p style="margin-top:10px;">Les possessifs suivent le même schéma : mäin → <strong>mengem</strong> (m/n), meng → <strong>menger</strong> (f).</p>`,
    exercises:[
      {type:'mc', q:'Ech kommen mat ___ Auto. (le, masc.)', options:['den','dem','der'], answer:'dem'},
      {type:'mc', q:'Mir iessen bei ___ Mamm. (ma)', options:['meng','menger','mengem'], answer:'menger'},
      {type:'mc', q:'Hie kënnt vun ___ Aarbecht. (le travail, fém.)', options:['der','dem','den'], answer:'der'},
      {type:'mc', q:'Ech schwätze mat ___ Kanner. (les)', options:['d\'','den','dem'], answer:'den'},
      {type:'mc', q:'Si wunnt bei ___ Bopa. (son grand-père)', options:['hirem','hirer','hiren'], answer:'hirem'},
      {type:'mc', q:'Ech schwätze mat ___ Kolleegin. (la)', options:['der','dem','den'], answer:'der'},
      {type:'mc', q:'Hie kënnt zu ___ Fest net. (le, neutre)', options:['dem','der','den'], answer:'dem'},
    ]
  },
  {
    id:'g8',
    title:'Le parfait (passé composé)',
    eyebrow:'Conjugaison',
    summary:"Le temps du passé le plus utilisé à l'oral : hunn/sinn + participe.",
    rule:`
      <p>Comme en français et en allemand : auxiliaire (<strong>hunn</strong> ou <strong>sinn</strong>) + participe passé en fin de phrase. Le participe se forme souvent avec <strong>ge- + radical + -t</strong> :</p>
      <table>
        <tr><td>schaffen → geschafft</td><td>Ech hu vill geschafft.</td></tr>
        <tr><td>kafen → kaaft</td><td>Mir hunn e Brout kaaft.</td></tr>
        <tr><td>heemgoen → heemgaangen</td><td>Si ass heemgaangen. (avec sinn)</td></tr>
        <tr><td>kommen → komm</td><td>Hien ass spéit komm. (avec sinn)</td></tr>
      </table>
      <p style="margin-top:10px;">Les verbes de mouvement (goen, kommen, fueren...) prennent <strong>sinn</strong>, la plupart des autres prennent <strong>hunn</strong>.</p>`,
    exercises:[
      {type:'mc', q:'Ech ___ gëschter vill geschafft.', options:['hunn','sinn','hues'], answer:'hunn'},
      {type:'mc', q:'Si ___ spéit heemgaangen.', options:['huet','ass','hunn'], answer:'ass'},
      {type:'mc', q:'Mir hunn e Kuch ___. (kafen)', options:['kaaft','gekaaft','kafen'], answer:'kaaft'},
      {type:'mc', q:'Hien ___ mam Zuch komm.', options:['huet','ass','hutt'], answer:'ass'},
      {type:'mc', q:'Dir ___ gutt giess?', options:['hutt','sidd','hunn'], answer:'hutt'},
      {type:'mc', q:'Ech hu mäi Kaffi ___. (drénken)', options:['gedronk','drénken','gedronken'], answer:'gedronk'},
      {type:'mc', q:'Si (elles) ___ zesumme giess.', options:['hunn','sinn','hutt'], answer:'hunn'},
    ]
  },
  {
    id:'g9',
    title:"L'impératif",
    eyebrow:'Conjugaison',
    summary:'Donner une instruction ou une invitation : trois formes selon la personne.',
    rule:`
      <p>Trois formes d'impératif :</p>
      <table>
        <tr><td>du → radical seul</td><td><strong>Kuck!</strong> (Regarde !)</td></tr>
        <tr><td>dir → radical + t</td><td><strong>Kuckt!</strong> (Regardez !)</td></tr>
        <tr><td>mir → verbe + mir</td><td><strong>Kucke mer!</strong> (Regardons !)</td></tr>
      </table>
      <p style="margin-top:10px;">Exemples utiles : <strong>Kommt eran!</strong> (Entrez !), <strong>Waart kuerz!</strong> (Attends un instant !), <strong>Setz dech!</strong> (Assieds-toi !)</p>`,
    exercises:[
      {type:'mc', q:'(du, kommen) ___ eran!', options:['Komm','Kommt','Komme mer'], answer:'Komm'},
      {type:'mc', q:'(dir, waarden) ___ w.e.g. kuerz!', options:['Waart','Waarden','Waarde mer'], answer:'Waart'},
      {type:'mc', q:'(mir, goen) ___ heem!', options:['Gi mer','Gitt','Gank'], answer:'Gi mer'},
      {type:'mc', q:'(du, sëtzen) ___ dech!', options:['Setz','Setzt','Sëtze mer'], answer:'Setz'},
      {type:'mc', q:'(dir, kommen) ___ eran!', options:['Kommt','Komm','Komme mer'], answer:'Kommt'},
      {type:'mc', q:'(du, opmaachen) ___ d\'Fënster!', options:['Maach op','Maacht op','Opmaachen'], answer:'Maach op'},
    ]
  },
  {
    id:'g10',
    title:'Les possessifs',
    eyebrow:'Pronoms',
    summary:'Mon, ton, son... accordés au genre du nom possédé.',
    rule:`
      <p>Le possessif s'accorde avec le <em>nom possédé</em> (pas le possesseur) :</p>
      <table>
        <tr><td>mon / ma</td><td>mäin (m/n) / meng (f, pl)</td></tr>
        <tr><td>ton / ta</td><td>däin / deng</td></tr>
        <tr><td>son / sa (à lui)</td><td>säin / seng</td></tr>
        <tr><td>son / sa (à elle)</td><td>hiren / hir</td></tr>
        <tr><td>notre</td><td>eisen / eis</td></tr>
        <tr><td>votre</td><td>ären / är</td></tr>
      </table>`,
    exercises:[
      {type:'mc', q:'___ Papp schafft zu Esch. (mon)', options:['Mäin','Meng','Mengem'], answer:'Mäin'},
      {type:'mc', q:'___ Schwëster wunnt zu Metz. (ma)', options:['Mäin','Meng','Menger'], answer:'Meng'},
      {type:'mc', q:'___ Auto ass rout. (son, à elle)', options:['Säin','Hiren','Hir'], answer:'Hiren'},
      {type:'mc', q:'___ Kanner spillen dobaussen. (nos)', options:['Eisen','Eis','Eisem'], answer:'Eis'},
      {type:'mc', q:'___ Kand geet an d\'Schoul. (ton)', options:['Däin','Deng','Denger'], answer:'Däin'},
      {type:'mc', q:'___ Kanner spillen dobaussen. (vos)', options:['Äre','Är','Ärem'], answer:'Är'},
    ]
  },
  {
    id:'g11',
    title:"L'accusatif (surtout les pronoms)",
    eyebrow:'Cas',
    summary:"Bonne nouvelle : les articles ne changent pas à l'accusatif — mais les pronoms personnels, si.",
    rule:`
      <p>Contrairement à l'allemand, les articles luxembourgeois ne changent <strong>pas</strong> entre le nominatif (sujet) et l'accusatif (objet direct) : « den Dësch » reste « den Dësch », qu'il soit sujet ou objet.</p>
      <p>En revanche, les pronoms personnels ont bien une forme différente à l'accusatif :</p>
      <table>
        <tr><td>ech → <strong>mech</strong></td><td>je → me</td></tr>
        <tr><td>du → <strong>dech</strong></td><td>tu → te</td></tr>
        <tr><td>hien → <strong>en</strong></td><td>il → le</td></tr>
        <tr><td>si → <strong>si</strong></td><td>elle → la (forme identique)</td></tr>
        <tr><td>hatt → <strong>et</strong></td><td>il/elle (neutre) → le/la</td></tr>
        <tr><td>mir → <strong>eis</strong></td><td>nous → nous</td></tr>
        <tr><td>dir → <strong>iech</strong></td><td>vous → vous</td></tr>
      </table>
      <p style="margin-top:10px;">Exemple : « Ech kennen <strong>dech</strong> gutt. » (Je te connais bien.)</p>`,
    exercises:[
      {type:'mc', q:'Ech kennen ___ scho laang. (toi)', options:['dech','du','dir'], answer:'dech'},
      {type:'mc', q:'Si gesäit ___ all Dag. (moi)', options:['ech','mech','mir'], answer:'mech'},
      {type:'mc', q:'Mir treffen ___ muer. (lui)', options:['hien','en','hie'], answer:'en'},
      {type:'mc', q:'Kanns du ___ hëllefen? (nous)', options:['mir','eis','mat eis'], answer:'eis'},
      {type:'mc', q:'Ech gesinn ___ net am Büro. (vous)', options:['dir','iech','Dir'], answer:'iech'},
      {type:'mc', q:'D\'Kand freet no ___. (elle)', options:['si','hatt','et'], answer:'si'},
    ]
  },
  {
    id:'g12',
    title:'La négation (net / keen, keng)',
    eyebrow:'Négation',
    summary:"« net » nie un verbe ou un adjectif ; « keen/keng » remplace l'article devant un nom.",
    rule:`
      <p><strong>net</strong> nie une action, un état ou un adjectif — placé après le verbe conjugué (et l'éventuel objet) :</p>
      <p>« Ech sinn net midd. » (Je ne suis pas fatigué.) · « Ech verstinn dat net. » (Je ne comprends pas ça.)</p>
      <p style="margin-top:10px;"><strong>keen/kee</strong> (masculin/neutre, selon la n-Regel) et <strong>keng</strong> (féminin/pluriel) remplacent l'article indéfini devant un nom — on ne dit jamais « net en/eng » devant un nom :</p>
      <table>
        <tr><td>keen / kee (masc./neutre)</td><td>Ech hu <strong>keen</strong> Auto, mee <strong>kee</strong> Vëlo.</td></tr>
        <tr><td>keng (fém.)</td><td>Si huet <strong>keng</strong> Zäit. (Elle n'a pas de temps.)</td></tr>
        <tr><td>keng (pluriel)</td><td>Ech hu <strong>keng</strong> Bicher. (Je n'ai pas de livres.)</td></tr>
      </table>`,
    exercises:[
      {type:'mc', q:'Ech sinn ___ midd. (pas)', options:['kee','net','keng'], answer:'net'},
      {type:'mc', q:'Ech hu ___ Auto. (pas de, masc.)', options:['net','keen','keng'], answer:'keen'},
      {type:'mc', q:'Si huet ___ Zäit haut. (pas de, fém.)', options:['kee','keng','net'], answer:'keng'},
      {type:'mc', q:'Mir verstinn dat ___.', options:['kee','net','keng'], answer:'net'},
      {type:'mc', q:'Ech hu ___ Bicher doheem. (pas de, plur.)', options:['kee','keng','net'], answer:'keng'},
      {type:'mc', q:'Hie kënnt haut ___.', options:['net','kee','keng'], answer:'net'},
    ]
  },
  {
    id:'g13',
    title:'Les verbes séparables (heemfueren, ophalen...)',
    eyebrow:'Syntaxe',
    summary:"À l'infinitif tout est collé — conjugué en phrase principale, le préfixe part à la fin.",
    rule:`
      <p>Beaucoup de verbes luxembourgeois sont formés d'un préfixe + un verbe de base (<strong>heem</strong>+fueren, <strong>op</strong>+halen, <strong>un</strong>+fänken...). À l'infinitif, tout reste collé en un seul mot.</p>
      <p>Mais conjugué dans une phrase principale, le préfixe se détache et part <strong>à la fin</strong> de la phrase :</p>
      <table>
        <tr><td>heemfueren</td><td>Ech fueren muer <strong>heem</strong>. (Je rentre demain.)</td></tr>
        <tr><td>ophalen</td><td>Hal <strong>op</strong>! (Arrête !)</td></tr>
        <tr><td>ufänken</td><td>Mir fänken elo <strong>un</strong>. (Nous commençons maintenant.)</td></tr>
      </table>
      <p style="margin-top:10px;">Après un verbe modal (wëllen, kënnen...), l'infinitif reste collé : « Ech wëll <strong>heemfueren</strong>. » (Je veux rentrer.)</p>`,
    exercises:[
      {type:'mc', q:'Wéini fiert Dir ___? (rentrez-vous)', options:['heem','heemfueren'], answer:'heem'},
      {type:'mc', q:'___, w.e.g.! (Arrête !)', options:['Hal op','Ophalen'], answer:'Hal op'},
      {type:'mc', q:'Mir ___ elo. (commençons)', options:['fänken un','ufänken'], answer:'fänken un'},
      {type:'mc', q:'Ech wëll haut spéit ___. (rentrer, après « wëll »)', options:['heemfueren','heem fueren'], answer:'heemfueren'},
      {type:'mc', q:'Wéini ___? (commencez-vous, ufänken)', options:['fänkt Dir un','Dir fänkt un'], answer:'fänkt Dir un'},
    ]
  },
  {
    id:'g14',
    title:'Les verbes modaux (kënnen, wëllen, mussen, sollen)',
    eyebrow:'Conjugaison',
    summary:"Toujours suivis d'un infinitif en fin de phrase — indispensables pour nuancer une demande.",
    rule:`
      <p>Les verbes modaux expriment la capacité, la volonté ou l'obligation. Ils s'accompagnent presque toujours d'un <strong>infinitif rejeté en fin de phrase</strong> : « Ech <strong>kann</strong> Lëtzebuergesch <strong>schwätzen</strong>. » (Je peux parler luxembourgeois.)</p>
      <table>
        <tr><td><strong>kënnen</strong> (pouvoir/savoir)</td><td><strong>wëllen</strong> (vouloir)</td></tr>
        <tr><td>ech kann</td><td>ech wëll</td></tr>
        <tr><td>du kanns</td><td>du wëlls</td></tr>
        <tr><td>hien/si/hatt kann</td><td>hien/si/hatt wëll</td></tr>
        <tr><td>mir kënnen</td><td>mir wëllen</td></tr>
        <tr><td>dir kënnt</td><td>dir wëllt</td></tr>
        <tr><td>si kënnen</td><td>si wëllen</td></tr>
      </table>
      <table style="margin-top:10px;">
        <tr><td><strong>mussen</strong> (devoir, obligation)</td><td><strong>sollen</strong> (être censé, obligation plus douce)</td></tr>
        <tr><td>ech muss</td><td>ech soll</td></tr>
        <tr><td>du muss</td><td>du solls</td></tr>
        <tr><td>hien/si/hatt muss</td><td>hien/si/hatt soll</td></tr>
        <tr><td>mir mussen</td><td>mir sollen</td></tr>
        <tr><td>dir musst</td><td>dir sollt</td></tr>
        <tr><td>si mussen</td><td>si sollen</td></tr>
      </table>
      <p style="margin-top:10px;">Astuce : « mussen » = obligation ferme (il le faut), « sollen » = ce qui est attendu/recommandé (tu devrais).</p>`,
    exercises:[
      {type:'mc', q:'Ech ___ Franséisch a Lëtzebuergesch schwätzen. (peux)', options:['kann','kanns','kënnen'], answer:'kann'},
      {type:'mc', q:'Du ___ dat gutt maachen. (peux)', options:['kann','kanns','kënnt'], answer:'kanns'},
      {type:'mc', q:'Mir ___ muer fréi ophalen. (voulons)', options:['wëll','wëlls','wëllen'], answer:'wëllen'},
      {type:'mc', q:'Dir ___ w.e.g. pünktlech sinn. (devez)', options:['muss','musst','mussen'], answer:'musst'},
      {type:'mc', q:'Si (elle) ___ dat nach haut fäerdeg maachen. (est censée)', options:['soll','solls','sollen'], answer:'soll'},
      {type:'mc', q:'Ech ___ e Kaffi, wannechgelift. (veux)', options:['wëll','wëlls','wëllt'], answer:'wëll'},
      {type:'mc', q:'Si (ils) ___ muer schaffen. (doivent)', options:['muss','musst','mussen'], answer:'mussen'},
    ]
  },
];
