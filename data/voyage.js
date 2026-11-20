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
        { who: 'c', lu: 'Hei, wannechgelift ! Äddi, e schéinen Dag !', fr: 'Voilà, s’il vous plaît. Au revoir, bonne journée !', audio: 'd6' }
      ]
    },
    cards: [
      { art: 'e', g: 'm', lu: 'Kéis', fr: 'le fromage', audio: 'w-keis', ex: 'Ech hätt gär e Kéis.', exFr: 'Je voudrais un fromage.', exAudio: 'w-hatt' },
      { art: 'eng', g: 'f', lu: 'Mëllech', fr: 'le lait', audio: 'w-mellech', ex: 'Ech hätt gär eng Fläsch Mëllech.', exFr: 'Je voudrais une bouteille de lait.', exAudio: 'c4' },
      { art: 'e', g: 'n', lu: 'Brout', fr: 'le pain', audio: 'w-brout', ex: 'Ech hätt gär e Brout, wannechgelift.', exFr: 'Je voudrais un pain, s’il vous plaît.', exAudio: 'c2' },
      { art: 'eng', g: 'f', lu: 'Fläsch', fr: 'la bouteille', audio: 'w-flaesch', ex: 'Ech hätt gär eng Fläsch Mëllech.', exFr: 'Je voudrais une bouteille de lait.', exAudio: 'c4' },
      { lu: 'Ech hätt gär …', fr: 'Je voudrais …', audio: 'w-hatt', ex: 'Ech hätt gär e Kéis.', exFr: 'Je voudrais un fromage.', exAudio: 'w-hatt' },
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
    // Reconnaître : on écoute (ou on lit, sans le droit audio) puis on choisit la traduction
    recognize: [
      { lu: 'Soss nach eppes ?', audio: 'w-soss', answer: 'Autre chose ?', options: ['Autre chose ?', 'Combien ça coûte ?', 'Au revoir !'] },
      { lu: 'Wéi vill kascht dat ?', audio: 'w-vill', answer: 'Combien ça coûte ?', options: ['Combien ça coûte ?', 'Quelle heure est-il ?', 'Où est la gare ?'] },
      { lu: 'Ech hätt gär e Kéis.', audio: 'w-hatt', answer: 'Je voudrais un fromage.', options: ['Je voudrais un fromage.', 'J’ai un fromage.', 'Je n’aime pas le fromage.'] },
      { lu: 'Dat mécht siwen Euro fofzeg.', audio: 'd5', answer: 'Ça fait sept euros cinquante.', options: ['Ça fait sept euros cinquante.', 'Ça fait neuf euros quinze.', 'C’est gratuit.'] }
    ],
    // Jouer la scène : la vendeuse parle, on choisit la réplique du client
    play: [
      { prompt: { lu: 'Moien ! Wat kann ech fir Iech maachen ?', fr: 'Bonjour ! Que puis-je faire pour vous ?', audio: 'd1' },
        answer: { lu: 'Moien ! Ech hätt gär e Kéis an eng Fläsch Mëllech.', fr: 'Bonjour ! Je voudrais un fromage et une bouteille de lait.', audio: 'd2' },
        wrong: [{ lu: 'Äddi !', fr: 'Au revoir !' }, { lu: 'Dat mécht siwen Euro fofzeg.', fr: 'Ça fait sept euros cinquante.' }],
        why: 'On répond à « Wat kann ech fir Iech maachen ? » en disant ce qu\u2019on veut.' },
      { prompt: { lu: 'Soss nach eppes ?', fr: 'Autre chose ?', audio: 'd3' },
        answer: { lu: 'Jo, e Brout, wannechgelift. Wéi vill kascht dat ?', fr: 'Oui, un pain, s\u2019il vous plaît. Combien ça coûte ?', audio: 'd4' },
        wrong: [{ lu: 'Wat kann ech fir Iech maachen ?', fr: 'Que puis-je faire pour vous ?' }, { lu: 'Dat mécht siwen Euro fofzeg.', fr: 'Ça fait sept euros cinquante.' }],
        why: '« Soss nach eppes ? » : on ajoute quelque chose, ou on demande le prix.' },
      { prompt: { lu: 'Dat mécht siwen Euro fofzeg.', fr: 'Ça fait sept euros cinquante.', audio: 'd5' },
        answer: { lu: 'Hei, wannechgelift ! Äddi, e schéinen Dag !', fr: 'Voilà, s’il vous plaît. Au revoir, bonne journée !', audio: 'd6' },
        wrong: [{ lu: 'Soss nach eppes ?', fr: 'Autre chose ?' }, { lu: 'Ech hätt gär e Kéis.', fr: 'Je voudrais un fromage.' }],
        why: 'Le client paie : « Hei, wannechgelift. », puis il dit au revoir.' }
    ],
    // mots de vocabulaire qui entrent dans les révisions espacées à la fin de l'unité
    words: ['Kéis', 'Mëllech', 'Brout', 'Fläsch', 'wannechgelift']
  },
  {
    id: 'questions', n: 2, title: 'Poser des questions', minutes: 10,
    summary: 'Demander où, quand, qui, comment, et se faire comprendre en ville.',
    scene: {
      title: 'En ville',
      lines: [
        { who: 'c', lu: 'Entschëllegt, wou ass d’Gare ?', fr: 'Excusez-moi, où est la gare ?', audio: 's1' },
        { who: 'v', lu: 'D’Gare ass do, riets.', fr: 'La gare est là, à droite.', audio: 's2' },
        { who: 'c', lu: 'Merci ! Wéini fiert de Zuch op Lëtzebuerg ?', fr: 'Merci ! Quand part le train pour Luxembourg ?', audio: 's3' },
        { who: 'v', lu: 'Ëm dräi Auer.', fr: 'À trois heures.', audio: 's4' },
        { who: 'c', lu: 'Wéi vill kascht en Ticket ?', fr: 'Combien coûte un billet ?', audio: 's5' },
        { who: 'v', lu: 'Dat kascht véier Euro.', fr: 'Ça coûte quatre euros.', audio: 's6' },
        { who: 'c', lu: 'Merci villmools ! Äddi !', fr: 'Merci beaucoup ! Au revoir !', audio: 's7' }
      ]
    },
    cards: [
      { lu: 'Wou ?', fr: 'Où ?', ex: 'Wou ass d’Gare ?', exFr: 'Où est la gare ?', exAudio: 'e-wou' },
      { lu: 'Wéini ?', fr: 'Quand ?', ex: 'Wéini fiert de Zuch ?', exFr: 'Quand part le train ?', exAudio: 'e-weini' },
      { lu: 'Wat ?', fr: 'Quoi ? Que ?', ex: 'Wat ass dat ?', exFr: 'Qu’est-ce que c’est ?', exAudio: 'e-wat' },
      { lu: 'Wien ?', fr: 'Qui ?', ex: 'Wien ass dat ?', exFr: 'Qui est-ce ?', exAudio: 'e-wien' },
      { lu: 'Vu wou ?', fr: 'D’où ?', ex: 'Vu wou kënns du ?', exFr: 'D’où viens-tu ?', exAudio: 'e-vuwou' },
      { lu: 'Wéi ?', fr: 'Comment ?', ex: 'Wéi heeschs du ?', exFr: 'Comment t’appelles-tu ?', exAudio: 'e-wei' },
      { lu: 'Entschëllegt', fr: 'Excusez-moi', ex: 'Entschëllegt, wou ass d’Gare ?', exFr: 'Excusez-moi, où est la gare ?', exAudio: 's1' },
      { art: 'eng', g: 'f', lu: 'Gare', fr: 'la gare', audio: 'w-gare', ex: 'D’Gare ass net wäit.', exFr: 'La gare n’est pas loin.', exAudio: 'e-gare' }
    ],
    rule: {
      title: 'Le verbe juste après',
      intro: 'On met le mot interrogatif en premier, puis le verbe, puis le sujet. Pour une question oui / non, le verbe passe en premier.',
      legend: [{ k: 'q', t: 'mot interrogatif' }, { k: 'v', t: 'verbe' }, { k: 's', t: 'sujet' }],
      rows: [
        { parts: [{ t: 'Wou', k: 'q' }, { t: 'wunns', k: 'v' }, { t: 'du ?', k: 's' }], fr: 'Où habites-tu ?' },
        { parts: [{ t: 'Wéini', k: 'q' }, { t: 'kënns', k: 'v' }, { t: 'du ?', k: 's' }], fr: 'Quand viens-tu ?' },
        { parts: [{ t: 'Wou', k: 'q' }, { t: 'ass', k: 'v' }, { t: 'd’Gare ?', k: 's' }], fr: 'Où est la gare ?' },
        { parts: [{ t: 'Schwätz', k: 'v' }, { t: 'du', k: 's' }, { t: 'Lëtzebuergesch ?', k: 'o' }], fr: 'Parles-tu luxembourgeois ? (oui / non)' }
      ],
      tip: 'Astuce de Roudi : après le mot interrogatif, le verbe vient tout de suite. Ici pas de « est-ce que » : on retourne verbe et sujet.'
    },
    exercises: [
      { before: '', after: 'ass d’Gare ?', answer: 'Wou', fr: 'Où est la gare ?', why: 'Wou = où.', audio: 'e-wou' },
      { before: '', after: 'fiert de Zuch ?', answer: 'Wéini', fr: 'Quand part le train ?', why: 'Wéini = quand.', audio: 'e-weini' },
      { before: '', after: 'kënns du ? — Ech kommen aus Portugal.', answer: 'Vu wou', fr: 'D’où viens-tu ?', why: 'Vu wou = d’où.', audio: 'e-vuwou' },
      { before: '', after: 'heeschs du ?', answer: 'Wéi', fr: 'Comment t’appelles-tu ?', why: 'Wéi = comment.', audio: 'e-wei' }
    ],
    recognize: [
      { lu: 'Wou ass d’Gare ?', audio: 'e-wou', answer: 'Où est la gare ?', options: ['Où est la gare ?', 'Quand part le train ?', 'Combien ça coûte ?'] },
      { lu: 'Wéini fiert de Zuch ?', audio: 'e-weini', answer: 'Quand part le train ?', options: ['Quand part le train ?', 'Où est la gare ?', 'Qui est-ce ?'] },
      { lu: 'Wien ass dat ?', audio: 'e-wien', answer: 'Qui est-ce ?', options: ['Qui est-ce ?', 'Qu’est-ce que c’est ?', 'D’où viens-tu ?'] },
      { lu: 'Wat ass dat ?', audio: 'e-wat', answer: 'Qu’est-ce que c’est ?', options: ['Qu’est-ce que c’est ?', 'Qui est-ce ?', 'Comment t’appelles-tu ?'] }
    ],
    play: [
      { prompt: { lu: 'D’Gare ass do, riets.', fr: 'La gare est là, à droite.', audio: 's2' },
        answer: { lu: 'Merci ! Wéini fiert de Zuch op Lëtzebuerg ?', fr: 'Merci ! Quand part le train pour Luxembourg ?', audio: 's3' },
        wrong: [{ lu: 'Entschëllegt, wou ass d’Gare ?', fr: 'Excusez-moi, où est la gare ?' }, { lu: 'Dat kascht véier Euro.', fr: 'Ça coûte quatre euros.' }],
        why: 'On remercie, puis on pose sa deuxième question : Wéini ?' },
      { prompt: { lu: 'Ëm dräi Auer.', fr: 'À trois heures.', audio: 's4' },
        answer: { lu: 'Wéi vill kascht en Ticket ?', fr: 'Combien coûte un billet ?', audio: 's5' },
        wrong: [{ lu: 'Wéini fiert de Zuch op Lëtzebuerg ?', fr: 'Quand part le train pour Luxembourg ?' }, { lu: 'Entschëllegt, wou ass d’Gare ?', fr: 'Excusez-moi, où est la gare ?' }],
        why: 'On a eu l’heure : il reste le prix, Wéi vill ?' },
      { prompt: { lu: 'Dat kascht véier Euro.', fr: 'Ça coûte quatre euros.', audio: 's6' },
        answer: { lu: 'Merci villmools ! Äddi !', fr: 'Merci beaucoup ! Au revoir !', audio: 's7' },
        wrong: [{ lu: 'Wéi vill kascht en Ticket ?', fr: 'Combien coûte un billet ?' }, { lu: 'Ëm dräi Auer.', fr: 'À trois heures.' }],
        why: 'On a toutes les réponses : on remercie et on dit au revoir.' }
    ],
    words: ['Wou', 'Wéini', 'Wat', 'Wien', 'Wéi', 'Gare', 'Zuch']
  }
];
// Unités annoncées dans le parcours (pas encore construites)
const VOYAGE_SOON = ['Ma famille', 'Ma journée'];
