# LetzLift
Application d'apprentissage du luxembourgeois (A1), en français. Aucun serveur, aucune dépendance :
tout tourne dans le navigateur, la progression est stockée sur l'appareil.

## Utiliser l'app

- **En local** : ouvrir `index.html` dans un navigateur (double-clic suffisant).
- **En ligne, installable, utilisable hors ligne** : une fois publiée sur GitHub Pages, à l'adresse
  `https://29mwrzfcn5-code.github.io/Letzlift/` (voir « Publication »).

## Installer sur iPhone

1. Ouvrir l'adresse de l'app dans **Safari**.
2. Toucher **Partager** (le carré avec la flèche), puis **Sur l'écran d'accueil**, puis **Ajouter**.
3. Ouvrir LetzLift **depuis l'icône** de l'écran d'accueil. La première ouverture doit se faire avec du
   réseau : l'app télécharge alors tous ses fichiers. Ensuite elle fonctionne sans connexion.

Les polices Google (Fraunces, IBM Plex) sont mises en cache après la première ouverture en ligne ; sans
elles, l'app s'affiche avec les polices du système.

**Mises à jour** : l'app vérifie la présence d'une nouvelle version à chaque ouverture en ligne et la
prend en compte au lancement suivant. Si le numéro de version (pastille en haut à gauche) n'a pas
changé, fermer complètement l'app (balayer vers le haut dans le sélecteur d'apps) et la rouvrir.

## Migrer ses données vers une nouvelle adresse

Le `localStorage` est **lié à l'adresse d'origine** (protocole, domaine, port ; pour un fichier ouvert en
double-clic, c'est même selon le navigateur lié au fichier). Une autre adresse, ou un autre fichier, ou
l'app installée sur l'écran d'accueil, démarre donc **vide**. Sur iPhone, l'app de l'écran d'accueil et
Safari ont chacun leur propre stockage : la progression faite dans un onglet Safari ne se retrouve pas
dans l'icône. La seule façon de la déplacer est la sauvegarde.

**Depuis l'ancien emplacement** (ancien fichier, ancienne adresse, onglet Safari) :

1. Écran **Niveau**, section **Sauvegarde**, **Télécharger une sauvegarde**. Cela produit un fichier
   `letzlift-sauvegarde-AAAA-MM-JJ.json`.
2. Si tu as ajouté ou corrigé du vocabulaire avec l'import de tableur : **Paramètres**, **Vocabulaire**,
   **Gérer le vocabulaire**, **Télécharger le vocabulaire** (fichier CSV). Ces mots personnalisés ne font
   pas partie de la sauvegarde JSON.
3. Envoyer le ou les fichiers vers le nouvel appareil (AirDrop, iCloud Drive, e-mail à soi-même…).
4. **Ne pas supprimer ni vider l'ancien emplacement** avant d'avoir vérifié la suite.

**Sur le nouvel emplacement** (l'app installée, ouverte depuis son icône) :

1. Saisir un prénom et passer l'écran d'accueil (« Non, je débute »).
2. Écran **Niveau**, section **Sauvegarde**, **Restaurer une sauvegarde**, choisir le fichier `.json`.
   La progression, les séries, les badges, l'historique et le prénom de la sauvegarde remplacent ceux de
   la nouvelle installation.
3. Si tu as un CSV : **Paramètres**, **Vocabulaire**, **Gérer le vocabulaire**, **Réimporter le tableur
   modifié**. À faire **avant** de restaurer si la sauvegarde contient des mots que tu as ajoutés toi-même
   (sans eux, la restauration est refusée : « Ce fichier n'est pas une sauvegarde LetzLift valide »).
4. Vérifier le nombre de mots vus, la série et le niveau, puis seulement supprimer l'ancien emplacement.

Les sauvegardes exportées depuis la v1.18.0 ou une version ultérieure s'importent dans toutes les
versions suivantes. Penser à télécharger une sauvegarde de temps en temps : l'app le rappelle d'elle-même.

## Publication (GitHub Pages)

Une seule fois : dans le dépôt GitHub, **Settings**, **Pages**, **Source : GitHub Actions**.
Ensuite, chaque push sur `main` lance `.github/workflows/pages.yml` : tests, puis publication des seuls
fichiers de l'app (`index.html`, `sw.js`, `manifest.webmanifest`, `css/`, `js/`, `data/`, `assets/`,
`icons/`). Tous les chemins sont relatifs : l'app marche à la racine comme sous `/Letzlift/`.

## Organisation

- `index.html`, `css/styles.css` : structure et styles
- `data/` : vocabulaire, grammaire, small talk
- `js/lib/` : logique pure testée ; `js/` : reste de l'application (scripts classiques, chargés dans
  l'ordre indiqué par `index.html`, pas de module ES : `file://` doit marcher)
- `assets/img/` : images du jeu « Décris l'image » ; `icons/` : icônes de l'app
- `manifest.webmanifest`, `sw.js`, `js/pwa.js` : installation et hors ligne
- `archive/letzlift-v1.18.0.html` : version d'origine en un seul fichier
- `docs/AUDIT.md` : audit de la v1.18.0
- `tests/`, `tools/` : tests et scripts de vérification
- `CHANGELOG.md`

## Développement

Aucune dépendance : Node (≥ 20) suffit.

```
npm test                        # tests unitaires et de compatibilité (node:test)
node tools/verify-split.js      # données, images, CSS, HTML et handlers identiques à l'archive v1.18.0
node tools/make-icons.js        # régénère les icônes (un test vérifie qu'elles sont à jour)
```

**Publier une nouvelle version** : changer le numéro à **trois endroits**, qui doivent concorder (un test
le vérifie) : la pastille dans `index.html`, `VERSION` dans `sw.js`, `version` dans `package.json`. Changer
`VERSION` est ce qui invalide le cache hors ligne chez les utilisateurs. Si un fichier est ajouté sous
`css/`, `js/`, `data/`, `assets/` ou `icons/`, l'ajouter aussi à la liste `SHELL` de `sw.js` (le test échoue sinon).
