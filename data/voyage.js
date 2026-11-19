/* ============================================================
   DONNÉES — MON VOYAGE (module pilote : parcours en unités)
   Une unité = une situation de la vie réelle, environ 10 minutes : écouter la scène, découvrir les mots, comprendre
   une règle, produire, bilan. Le son (voix de synthèse de la Sproochmaschinn, Zenter fir d'Lëtzebuerger Sprooch) est
   réservé aux comptes qui ont le droit « audio ». Les phrases sont à faire relire par la professeure.
   `audio` : nom du fichier dans assets/audio/voyage/<unité>/<nom>.mp3 (voir tools/voyage-audio.json).
   ============================================================ */
const VOYAGE_UNITS = [
  {
    id: 'courses', n: 1, title: 'Faire ses courses', minutes: 10,
    summary: 'Demander ce qu’on veut, le prix, et payer.',
    scene: {
      title: 'Au marché',
      lines: [
        { who: 'v', lu: 'Moien ! Wat kann ech fir Iech maachen ?', fr: 'Bonjour ! Que puis-je faire pour vous ?', audio: 'd1' },
        { who: 'c', lu: 'Moien ! Ech hätt gär e Kéis an eng Fläsch Mëllech.', fr: 'Bonjour ! Je voudrais un fromage et une bouteille de lait.', audio: 'd2' },
        { who: 'v', lu: 'Soss nach eppes ?', fr: 'Autre chose ?', audio: 'd3' },
        { who: 'c', lu: 'Jo, e Brout, wannechgelift. Wéi vill kascht dat ?', fr: 'Oui, un pain, s’il vous plaît. Combien ça coûte ?', audio: 'd4' },
        { who: 'v', lu: 'Dat mécht siwen Euro fofzeg.', fr: 'Ça fait sept euros cinquante.', audio: 'd5' },
        { who: 'c', lu: 'Hei, wannechgelift. Äddi !', fr: 'Voilà, s’il vous plaît. Au revoir !', audio: 'd6' }
      ]
    },
    cards: [
      { art: 'e', g: 'm', lu: 'Kéis', fr: 'le fromage', audio: 'w-keis', ex: 'Ech hätt gär e Kéis.', exFr: 'Je voudrais un fromage.', exAudio: 'w-hatt' },
      { art: 'eng', g: 'f', lu: 'Mëllech', fr: 'le lait', audio: 'w-mellech', ex: 'Ech hätt gär eng Fläsch Mëllech.', exFr: 'Je voudrais une bouteille de lait.', exAudio: 'c4' },
      { art: 'e', g: 'n', lu: 'Brout', fr: 'le pain', audio: 'w-brout', ex: 'Ech hätt gär e Brout, wannechgelift.', exFr: 'Je voudrais un pain, s’il vous plaît.', exAudio: 'c2' },
      { art: 'eng', g: 'f', lu: 'Fläsch', fr: 'la bouteille', audio: 'w-flaesch', ex: 'Ech hätt gär eng Fläsch Mëllech.', exFr: 'Je voudrais une bouteille de lait.', exAudio: 'c4' },
      { lu: 'Ech hätt gär …', fr: 'Je voudrais …', audio: 'w-hatt-debut', ex: 'Ech hätt gär e Kéis.', exFr: 'Je voudrais un fromage.', exAudio: 'w-hatt' },
      { lu: 'Wéi vill kascht dat ?', fr: 'Combien ça coûte ?', audio: 'w-vill', ex: 'Wéi vill kascht e Brout ?', exFr: 'Combien coûte un pain ?', exAudio: 'x-vill' },
      { lu: 'Soss nach eppes ?', fr: 'Autre chose ?', audio: 'w-soss' },
      { lu: 'wannechgelift', fr: 's’il vous plaît', audio: 'w-wgl', ex: 'E Kaffi, wannechgelift.', exFr: 'Un café, s’il vous plaît.', exAudio: 'x-kaffi' }
    ],
    rule: {
      title: '« e » ou « en » ?',
      intro: 'Devant un nom masculin ou neutre, « un » s’écrit en ou e. Tout dépend de la première lettre du mot qui suit.',
      examples: [
        { art: 'e', g: 'm', word: 'Kéis', letter: 'K', keep: false },
        { art: 'e', g: 'n', word: 'Brout', letter: 'B', keep: false },
        { art: 'en', g: 'm', word: 'Apel', letter: 'A', keep: true }
      ],
      letters: 'UNITEDZOHA',
      tip: 'Astuce de Roudi : retiens UNITED ZOHA. Si la lettre est dans le mot, garde le n.'
    },
    exercises: [
      { before: 'Ech hätt gär', after: 'Kéis.', answer: 'e', fr: 'Je voudrais un fromage.', why: 'K n’est pas dans UNITED ZOHA : on écrit e, sans n.', audio: 'w-hatt' },
      { before: 'Ech hätt gär', after: 'Brout, wannechgelift.', answer: 'e', fr: 'Je voudrais un pain, s’il vous plaît.', why: 'B n’est pas dans UNITED ZOHA : on écrit e, sans n.', audio: 'c2' },
      { before: 'Ech hätt gär', after: 'Apel.', answer: 'en', fr: 'Je voudrais une pomme.', why: 'A est dans UNITED ZOHA : on garde le n, donc en.', audio: 'c3' },
      { before: 'Ech hätt gär eng', after: 'Mëllech.', answer: 'Fläsch', fr: 'Je voudrais une bouteille de lait.', why: 'Fläsch est féminin : eng Fläsch.', audio: 'c4' }
    ],
    // mots de vocabulaire qui entrent dans les révisions espacées à la fin de l'unité
    words: ['Kéis', 'Mëllech', 'Brout', 'Fläsch', 'wannechgelift']
  }
];
// Unités annoncées dans le parcours (pas encore construites)
const VOYAGE_SOON = ['Poser des questions', 'Ma famille', 'Ma journée'];
