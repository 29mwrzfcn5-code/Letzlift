# Changelog

Les versions suivent le numéro affiché dans l'application (pastille en haut à gauche).

## 1.25.0 — Cours : leçon 6 (personnes, pays, nationalités)

- **Leçon 6 (27 octobre)** : « Wien ass dat ? / Ech mengen… / Ech si sécher », les pays, « Vu wou kënnt … ? »,
  les nationalités au masculin et au féminin (avec les prononciations données dans la fiche : Lëtzebuerg,
  Lëtzebuerger, Lëtzebuergerin), la présentation complète, op ≠ zou. 60 cartes de plus (391 au total).
- Leçon 4 complétée avec les couleurs claires de la fiche (hellbrong, hellgréng, hellgro, hellblo).
- Règle du n : 5 exercices de plus (Wie sidd Dir ?, Ech si sécher…) ; les exercices sur les prénoms ne sont
  proposés que lorsque la leçon 1 est dans la sélection.
- Fiche de validation des traductions mise à jour.

## 1.24.1 — Règle du n corrigée dans le parcours régulier

17 phrases d'exemple du vocabulaire (v116, v134, v167, v204, v209, v226, v228, v270, v272, v292, v302,
v309, v317) et du small talk (« Den nächste Zuch », « den nächste Supermarché », « D'Nopere si ganz »,
« Wie mécht haut d'Iessen ? », « Mäin Handy-Akku ») ne suivaient pas la règle UNITED ZOHA.
Corrigées d'après le cours (ex. « Den Himmel », « de ganzen Dag », « e Glas », « Ech hunn haut »).

## 1.24.0 — Module Cours (leçons 1 à 5 du cours de l'ACD)

Nouvel écran « 📚 Cours » (bouton sur l'accueil), séparé du vocabulaire : ses propres cartes, sa propre
progression, aucun effet sur les XP, les séries ou les statistiques du vocabulaire.

- **Fiches de leçon** reprenant le cours (alphabet, présentation, objets m/f/n, verbes, couleurs, contraires,
  nombres) avec les codes couleur du prof : bleu masculin, rouge féminin, vert neutre, lettres barrées.
- **Révision espacée** (même système de boîtes que le vocabulaire) sur ~330 cartes : mots avec article,
  phrases, lettres, nombres, couleurs, contraires ; choix multiple pour les cartes neuves, saisie ensuite.
- **Exercices sur la règle du n** (UNITED ZOHA), générés par un moteur testé sur les formes du cours.
- Sauvegarde : champ optionnel `courseProgress` (clé `letzlift:course-progress`) ; les sauvegardes
  antérieures s'importent toujours.
- Traductions françaises proposées à valider : docs/course/VALIDATION.md.
- Les nouvelles bibliothèques s'exposent sous `LetzNRule` et `LetzCourse` (pas de noms globaux génériques).

## 1.23.0 — Ergonomie tactile iPhone (étape A1)

Réglages limités aux écrans étroits (≤ 640 px) et aux appareils tactiles : le rendu sur ordinateur est
identique (8 écrans comparés au pixel près à 1280 px).

- **Zoom de Safari au focus** : tous les champs de saisie et menus passent à 16 px sur écran étroit
  (ils étaient à 13–14 px).
- **Clavier** : correction automatique, majuscule automatique et correcteur orthographique coupés sur
  les champs de réponse et de recherche, le formulaire de vocabulaire (sinon iOS « corrige » ou
  met une majuscule à un mot luxembourgeois) ; majuscule par mot sur le prénom ; touche « Go » du
  clavier sur les réponses ; le champ en cours de saisie est ramené dans la zone visible quand le
  clavier s'ouvre.
- **Zones de toucher de 44 px** : boutons, menus, champs, logo, avatar, interrupteur, curseur, lien de
  retour et pastilles de défi.
- **Retour visuel au toucher** (appui = léger rétrécissement) à la place des états « survol » ; pas de
  zoom au double toucher ; pas de halo gris ; le texte de l'interface ne se sélectionne plus par appui
  long (les champs de saisie, si).
- **Infobulles au toucher** : les pastilles série et jetons et les badges s'ouvrent d'un toucher
  (elles n'apparaissaient qu'au survol de la souris).

## 1.22.1 — Import CSV plus sûr, note de « kënnen »

### Corrigé
- **Import CSV** : un mot *nouveau* sans phrase d'exemple (l'écran disait pourtant que c'était
  facultatif) faisait planter environ une carte sur deux (« à compléter » et « Remise en ordre »
  lisent la phrase). Les mots nouveaux sont maintenant validés comme dans le formulaire (phrase avec
  exactement un `___`, traduction de la phrase, genre `f` ou `c`, pas de guillemet droit ni
  d'antislash dans le mot, sa traduction et sa catégorie) ; ceux qui ne passent pas sont refusés et
  comptés dans le message d'import. Corriger un mot existant reste possible avec une seule colonne.
  Le texte d'aide de l'écran est mis à jour.

### Contenu
- Note du mot v83 (« kënnen ») : `ka -> Exception` devient `ka → Exception`. La flèche ASCII contenait
  un `>`, refusé par la règle commune à l'import CSV et aux sauvegardes : ce mot ne pouvait pas être
  corrigé dans le formulaire. `tools/verify-split.js` déclare cette seule modification de contenu.

## 1.22.0 — Formulaire de vocabulaire, bouton Restaurer, texte d'onboarding

### Ajouté
- **Formulaire « Ajouter un mot »** (Paramètres, Vocabulaire, Gérer le vocabulaire) : ajout d'un mot
  sans toucher au code ni passer par un tableur. Identifiant automatique `persoN`, prise en compte
  immédiate. Contrôles de saisie (`js/lib/vocab-entry.js`, testés) : champs obligatoires, phrase avec
  exactement un `___`, pas de `<` ni `>`, pas de guillemet droit ni d'antislash dans le mot, sa
  traduction et sa catégorie (ils finissent dans des attributs HTML), genre `f` ou `c`, 300 caractères
  maximum, avertissement en cas de doublon. Toute saisie affichée est échappée.
- Recherche et correction de n'importe quel mot (y compris d'origine, avec « Rétablir l'original »),
  suppression en deux temps d'un mot ajouté (sa progression est supprimée avec lui, sinon la
  sauvegarde exportée ensuite serait refusée à l'import).
- **Télécharger mes mots** : CSV des seuls mots ajoutés ou modifiés, réimportable avec l'import
  existant. Les mots personnels ne sont toujours pas dans la sauvegarde JSON (format inchangé).

### Corrigé
- **« Restaurer une sauvegarde » (Paramètres)** ne faisait rien tant que l'écran Niveau n'avait pas été
  ouvert une fois (le champ fichier n'existait que là). Il est maintenant créé à la demande, et le
  résultat s'affiche sur place, sous les boutons des Paramètres, qui se rafraîchissent.

### Modifié
- **Texte d'onboarding** : « ce fichier… cet ordinateur » remplacé par un texte valable pour l'app
  installée (progression sur l'appareil, sauvegarde et restauration pour changer d'appareil, ne pas
  vider les données de l'app).
- CSS : seules des classes nouvelles (`.va-*`) sont ajoutées à la fin de `styles.css`.

## 1.21.0 — Application installable et utilisable hors ligne

- `manifest.webmanifest` : nom LetzLift, affichage `standalone`, fond `#EDE8DC` et couleur d'accent
  `#1F5C56` (les valeurs de `--bg` et `--accent` du CSS ; un test vérifie la concordance).
- Icônes 192 et 512 px et `apple-touch-icon` 180 px, générées par `tools/make-icons.js` (sans
  dépendance) aux couleurs de l'app, avec le motif de la barre du haut.
- Balises iOS : `apple-mobile-web-app-capable`, titre, style de barre d'état, `theme-color`.
- Service worker (`sw.js`) : précache de tout l'app shell (49 fichiers), cache nommé d'après le
  numéro de version (l'ancien est supprimé à l'activation), polices Google en
  stale-while-revalidate, repli sur l'app hors ligne. Un test vérifie que `VERSION` de `sw.js`, la
  pastille et `package.json` concordent, et qu'aucun fichier de l'app n'est oublié du précache.
- `js/pwa.js` enregistre le service worker uniquement en https ou sur localhost : en double-clic
  (`file://`) rien n'est enregistré et la console reste vide, l'app fonctionne comme avant.
- Workflow GitHub Actions (`.github/workflows/pages.yml`) : tests à chaque push et pull request,
  publication sur GitHub Pages à chaque push sur `main` (seulement les fichiers de l'app).
- `README.md` : installation sur iPhone et procédure de migration des données.
- Aucune modification du contenu pédagogique, du CSS, des clés de stockage ni du format de sauvegarde.

## 1.20.0 — Dates locales, logique pure testée, prénom

### Corrigé
- **Bug des dates** : « aujourd'hui » utilisait `new Date().toISOString()` (date UTC). Au Luxembourg,
  entre minuit et 1 h (hiver) ou 2 h (été), l'app croyait être encore la veille : objectif du jour,
  défi, série, bilan hebdomadaire, rappel de sauvegarde et nom du fichier de sauvegarde étaient
  décalés. `todayStr()` renvoie maintenant la date locale du navigateur. Les calculs d'écart, de
  lundi de semaine et d'ajout de jours restent faits sur des dates calendaires (UTC pur sur chaîne),
  donc insensibles aux changements d'heure.
- L'heure de la sauvegarde (`exportedAt`) reste un instant UTC dans le fichier (format inchangé) ;
  la date affichée à la restauration est convertie en date locale.
- **Série et minuit** : si l'app restait ouverte à travers minuit, l'objectif du jour basculait mais
  pas la série avant le rechargement. La série suit maintenant le changement de jour, et l'app
  bascule aussi quand elle revient au premier plan après minuit.
- **Prénom** : un prénom contenant `<` ou `>` était accepté, puis rendait la sauvegarde exportée
  impossible à réimporter. Ces caractères sont refusés à la saisie (écran d'accueil et Paramètres),
  retirés d'un prénom déjà enregistré au chargement, et retirés d'une sauvegarde importée qui en
  contiendrait (donc les sauvegardes v1.18.0 concernées s'importent désormais).
- Une date enregistrée « dans le futur » (horloge ou fuseau changé, voyage) ne casse plus la série
  et ne déclenche plus de remise à zéro de la journée.

### Données existantes calculées en UTC
Rien n'est réécrit. `lastActiveDate`, `dailyState.date`, `dailyHistory[].date`,
`lastWeeklyReviewWeek` et `lastBackupExportAt` restent des chaînes `YYYY-MM-DD` et sont lues telles
quelles. Au Luxembourg la date locale est toujours supérieure ou égale à la date UTC du même instant,
donc une ancienne valeur n'est jamais « dans le futur » : au pire, une activité faite entre minuit et
1 h/2 h et enregistrée sous la veille compte pour un jour de plus une seule fois (série +1), jamais
pour un jour de moins. Les échéances de révision (`dueAt`) sont des instants en millisecondes,
non concernés.

### Interne
- Logique pure extraite dans `js/lib/` (`dates`, `srs`, `xp`, `streak`, `text`) : IIFE + `module.exports`
  conditionnel, sans module ES, utilisable dans le navigateur (fonctions globales) et dans Node.
- Tests `node:test` (`npm test`) : minuit local, changements d'heure (29 mars et 25 octobre 2026),
  série qui continue ou se casse, jetons de pause, vacances, passage d'une boîte à l'autre, XP et
  niveaux, import d'une sauvegarde produite par la v1.18.0, données UTC existantes.
- `tools/verify-split.js` ne contrôle plus « mêmes lignes de JS qu'en v1.19.0 » (le code a changé
  volontairement) ; les contrôles de données, d'images, de CSS, de HTML et de handlers restent.

## 1.19.0 — Découpage du fichier unique (aucun changement de comportement)

- `letzlift.html` (fichier unique de 753 Ko) est découpé en `index.html`, `css/styles.css`,
  `data/` (vocabulaire, grammaire, small talk) et `js/` (stockage, profil et sauvegarde, répétition
  espacée, XP / séries / badges, bilan hebdomadaire, écrans, sessions de vocabulaire, test de
  placement, un fichier par mini-jeu). Scripts classiques, sans module : l'app s'ouvre toujours en
  double-clic (`file://`) et les fonctions appelées par `onclick` restent globales.
- Les 8 images JPEG (base64 dans le code) sont extraites vers `assets/img/` et référencées par chemin.
- L'original est conservé dans `archive/letzlift-v1.18.0.html`.
- Aucune modification du contenu pédagogique, du CSS, du HTML (hors numéro de version), des clés de
  stockage ni du format de sauvegarde. Les fonctions ont été déplacées sans être modifiées.
- Ajout de `docs/AUDIT.md` (audit de la v1.18.0) et de `tools/verify-split.js` (preuve que les
  données, les images, le CSS, le HTML et les handlers inline sont identiques avant/après).
