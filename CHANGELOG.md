# Changelog

Les versions suivent le numéro affiché dans l'application (pastille en haut à gauche).

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
