/* ============================================================
   COURS DE LUXEMBOURGEOIS (ACD, A1.1 – A1.2) — données des leçons
   Un fichier par leçon (lesson-NN.js), chacun ajoute sa leçon à COURSE_LESSONS.

   Les textes luxembourgeois sont ceux des documents du cours, avec les règles du n appliquées
   (lettres barrées retirées). Les traductions françaises sont des PROPOSITIONS à valider
   (voir docs/course/VALIDATION.md). Les documents du cours étant réédités à chaque séance, chaque
   élément n'est listé que dans la leçon où il apparaît pour la première fois.

   Formats compacts (normalisés par js/lib/course.js) :
     words    [lu, genre, fr, {cat, pron, note, ref}]   genre : 'm' | 'f' | 'n' | null (adjectif, verbe…)
     phrases  [lu, fr, contexte?, note?]                contexte : 'formel' | 'informel' | …
     letters  [lettre, nom]                             nom de la lettre en luxembourgeois
     numbers  [valeur, lu]
     colors   [lu, fr, hex]                             hex : teinte de la case dans le document du cours
     pairs    [lu1, lu2, fr1, fr2]                      contraires
     sections blocs d'affichage de la fiche (voir js/course.js)
   Balisage dans les cellules : {m|texte} masculin (bleu), {f|…} féminin (rouge), {n|…} neutre (vert),
   {r|…} forme irrégulière, {g|…} forme régulière, {u|…} souligné, {s|…} lettre barrée (non écrite).
   ============================================================ */
const COURSE_LESSONS = [];
