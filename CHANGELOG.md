# Changelog

Les versions suivent le numéro affiché dans l'application (pastille en haut à gauche).

## 1.35.0 — Code de récupération du mot de passe

Un mot de passe oublié n'est plus définitif, sans e-mail ni nom de domaine.

- **Code de récupération** personnel (`LZR-XXXXX-XXXXX-XXXXX`) donné **une seule fois** à la création du compte, sur un
  écran dédié (case « J'ai noté mon code » obligatoire). Seule son empreinte est stockée côté serveur.
- **« Mot de passe oublié ? »** sur l'écran de connexion : identifiant + code + nouveau mot de passe. Une récupération
  réussie déconnecte tous les appareils, lève un éventuel verrouillage, et remet un **nouveau code** (l'ancien est consommé).
- **Paramètres** : créer ou renouveler son code (mot de passe actuel exigé ; l'ancien code cesse de fonctionner). Les
  comptes existants voient un rappel sur l'accueil jusqu'à ce qu'ils en aient un.
- **Administration** : *Actions → Code de récupération* remet un nouveau code à quelqu'un qui a perdu à la fois son mot
  de passe et son code.
- Sécurité : 75 bits d'entropie, 5 essais par compte et par 15 minutes, 15 par adresse et par heure, même message
  d'erreur dans tous les cas d'échec, aucune trace du code dans le journal d'administration ni sur l'appareil.
- **Serveur version 3** : nouvelle colonne en base (`worker/migrations/003_recuperation.sql`, à exécuter AVANT de coller le
  nouveau `worker.mjs`) ; `/api/health` affiche `version: 3`. Détail pas à pas dans `worker/README.md`.

## 1.34.0 — Révisions du cours : plus de variété, un compteur, deux modes

- **Deux modes** : *Révision générale* (page Cours : toutes les leçons, d'abord ce qui est à revoir, puis la suite
  dans l'ordre du professeur) et *Réviser cette leçon* (une seule leçon). Nouveau : *Entraînement libre*, qui tire
  des cartes déjà vues sans toucher au calendrier de révision, pour ne plus tomber sur « Tout est à jour ».
- **Quatre nouveaux formats** en plus du choix du sens et de la saisie : *sens inverse* (du français au
  luxembourgeois, en choix multiple), *phrase à trous* (de préférence sur un article ou un n, avec l'explication
  de la règle), *mots à remettre dans l'ordre*, et *mini-dialogue* (choisir la bonne réplique, hors calendrier de
  révision). Le format change d'une carte à l'autre ; deux fois le même de suite est évité.
- **Compteur** « Question 7 / 20 », étiquette Nouveau / À revoir / Entraînement / Dialogue, série de bonnes
  réponses, et un bilan de fin avec l'avancement de chaque leçon (cartes vues, acquises, à revoir).
- Sons et confettis de fin de session comme ailleurs dans l'appli.
- **Couleurs des genres dans les exercices** : l'article des noms prend la couleur du genre (bleu masculin,
  rouge féminin, vert neutre, comme dans les fiches) dans le mot montré, les réponses proposées et la correction,
  avec une petite légende. Pas de couleur là où le genre est justement la question (exercices « Genre et n »,
  phrases à trous). Réglage dans Paramètres, « Couleurs des genres » (actif par défaut) pour s'entraîner sans indice.
  Aussi dans la carte de vocabulaire « Choisis la bonne traduction » et la liste du vocabulaire.
- **Noms colorés dans les phrases** : les noms de genre connu à l'intérieur des phrases (« Wéi ass Ären **Numm** ? »,
  « Hutt Dir eng **Fro** ? ») prennent aussi leur couleur, sans rien saisir à la main : une table de 184 noms à genre
  sûr (mots du cours et vocabulaire) est repérée dans le texte ; la ponctuation et le texte d'origine ne changent pas.
  69 % des phrases du cours en contiennent au moins un. Appliqué aux questions, aux réponses proposées, aux mots à
  remettre dans l'ordre, aux mini-dialogues, à la correction et à la fiche de la leçon. Dans une phrase à trous
  dont le trou est un article ou un verbe sensible au n, les noms ne sont pas colorés avant la réponse (la couleur
  donnerait le genre) ; la phrase complète s'affiche en couleurs après.
- Les choix d'une phrase à trous s'écrivent tous avec la même casse (« Ären » est toujours en majuscule : sinon la
  casse trahissait la bonne réponse).
- Nouveau module pur `js/lib/course-ex.js` (tests sur toutes les cartes du cours).

## 1.33.2 — Clavier dans les exercices du cours

- Les exercices du module Cours (révision de leçon, exercices sur la règle du n) se pilotent maintenant au
  clavier : les **flèches** déplacent la sélection, Entrée valide, et les touches **1 à 4** choisissent directement
  une réponse (aussi dans les sessions et les jeux à choix multiple). Les touches chiffres ne sont pas
  détournées quand on tape dans un champ de saisie. Réglage inchangé : Paramètres, « Flèches du clavier ».
- Nouveau module pur `js/lib/keynav.js`, avec tests.

## 1.33.1 — Le bon article : le temps de lire la correction

- Le jeu « Le bon article » n'enchaîne plus tout seul : après chaque réponse, la correction reste à l'écran
  jusqu'à « Continuer » (ou Entrée), et **le chrono est figé pendant ce temps**. Le score ne compte que le
  temps de réflexion ; le record reste comparable d'une partie à l'autre.

## 1.33.0 — Genre des noms et règle du n

Le gros point faible des apprenants : deux difficultés, travaillées ensemble et diagnostiquées séparément.

- **Trois genres.** Le vocabulaire distingue maintenant le masculin, le féminin et le neutre (l'ancien code
  « c », masculin ou neutre, est conservé et reste valide). 122 genres ajoutés ou précisés, vérifiés mot à mot
  dans le dictionnaire officiel (LOD) ; 6 mots à homonymes restent sans exercice en attendant une relecture
  (A, Wand, Buch, Buedzëmmer, Post, Iddi). Comparaison complète dans `docs/course/GENRES-LOD.md`.
- **Nouvelles questions** (cartes de genre des sessions de vocabulaire et jeu « Le bon article ») : en / e / eng,
  keen / kee / keng, den / de / d', et « Ech hunn / hu … » qui teste le n deux fois. Chaque réponse est
  expliquée (« Stull est masculin… commence par S, pas une lettre de UNITED ZOHA : le n tombe → e Stull »).
- **Erreurs classées** « genre » ou « n », comptées séparément (`sessionStats.ruleStats`). L'écran Niveau montre
  les deux taux ; les questions suivantes insistent sur la règle la moins bien réussie.
- **Article en couleur** (bleu masculin, rouge féminin, vert neutre, comme dans le cours) dans la liste du
  vocabulaire et après chaque réponse dans les sessions.
- **Le jeu « Le bon article » est ouvert dès le niveau 1** et la carte « Genre et n » apparaît sur l'accueil.
- Un seul moteur pour la règle du n (`js/lib/nrule.js`) : la copie écrite à la main dans les sessions est supprimée.
- Administration du vocabulaire : le formulaire propose masculin, féminin, neutre.
- Nouveaux modules `js/lib/genre-n.js` et `js/genre.js`, avec tests.

## 1.32.0 — Sons, tampons de passeport, Roudi qui réagit, version ordinateur

- **Sons et animations** : petit son de réussite ou d'erreur, fanfare et confettis en fin de session
  (selon le score), Roudi qui rebondit dans la barre du haut. Sons synthétisés (aucun fichier), à couper
  dans Paramètres ; confettis et rebond coupés si l'appareil demande moins de mouvement.
- **Passeport de tampons** (écran Niveau) : 17 tampons calculés à partir de la progression (étapes du
  parcours, séries de 3, 7, 14 et 30 jours, 20 à 200 mots, mots acquis, sessions). Les nouveaux tampons
  sont fêtés à la fin d'une session. Aucune donnée nouvelle n'est enregistrée : seule la liste des
  tampons déjà fêtés reste sur l'appareil.
- **Roudi qui réagit** : phrase d'accueil adaptée (matin, soir, série, jour déjà fait, reprise après
  3 jours ou plus d'absence) et message de fin de session selon le score, toujours encourageant.
- **Version ordinateur** : navigation principale dans la barre du haut (elle n'existait pas sur grand
  écran), accueil en deux colonnes (billet du jour à gauche, semaine et voyage à droite), billet en
  forme de vrai ticket, parcours d'accueil dans une carte centrée.
- Nouveaux modules `js/lib/stamps.js` et `js/feedback.js`, avec tests.

## 1.31.0 — Nouvel accueil et parcours d'accueil (téléphone d'abord)

Deuxième et troisième étapes de la refonte visuelle, pensées d'abord pour le téléphone.

- **Parcours d'accueil en quatre étapes**, avec Roudi qui parle : prénom, motif (fonction publique,
  nationalité, scolarité des enfants, quotidien, curiosité) et rythme (5, 10 ou 15 minutes), niveau
  (débutant ou test de placement), puis une première session de cinq mots. Deux nouveaux champs de
  profil, `goal` (motif) et `sessionMinutes` (déjà existant) ; les sauvegardes et la synchronisation
  restent compatibles.
- **Nouvel accueil** : un « billet du jour » (départ, arrivée, mots à revoir et nouveaux mots) avec un
  seul grand bouton, la semaine en cours, et un **parcours de village en village** (Schengen, Vianden,
  Echternach, Clervaux, Luxembourg-Ville) qui avance avec les mots vus. Les étiquettes sont placées
  alternativement au-dessus et en dessous pour ne jamais se chevaucher.
- **Mini-jeux** : ils s'ouvrent à 20 mots vus (compteur « 12 / 20 » avant). Les règles de déblocage par
  niveau restent ensuite les mêmes.
- **Barre du bas** avec icônes, et masquée pendant le parcours d'accueil.
- Nouveau module `js/lib/journey.js` (logique du parcours et de la semaine), avec tests.

## 1.30.0 — Thème Roudi : un look chaleureux, des boutons en relief

Première étape de la refonte visuelle (la suite : parcours d'accueil, nouvel accueil, pages internes).

- **Roudi**, la mascotte : le lion rouge du Luxembourg, dessiné une seule fois (symbole `#roudi` de
  `index.html`) et utilisé dans la barre du haut, l'écran de connexion et les icônes de l'app.
- **Nouvelle palette** (crème, rouge, bleu ciel, or) et **nouvelles polices hébergées** (Baloo 2 pour les
  titres, Nunito pour le texte) : plus aucune requête vers un service extérieur.
- **Boutons et cartes « en relief »** : une ombre pleine en bas, qui s'écrase quand on appuie. Appliqué à
  tous les écrans existants (boutons, cartes, choix de réponses, champs, navigation).
- **Écran de connexion** repensé : paysage du Luxembourg (pont Adolphe, Gëlle Fra), Roudi qui accueille,
  « Moien ! ».
- Icônes de l'app et couleurs du manifeste mises à jour (`tools/make-icons.js` dessine Roudi sans dépendance).
- `tools/verify-split.js` ne compare plus le CSS et le HTML à l'archive d'origine (la refonte les remplace
  volontairement) ; les contrôles sur les données et les fonctions restent.

## 1.29.1 — Droits d'accès visibles dès la première connexion

- Sur un appareil qui venait d'être mis à jour, l'accueil était dessiné avant que le serveur ne réponde : le
  bouton « Cours » n'apparaissait qu'après un changement d'écran. L'écran est maintenant redessiné dès que
  les droits ou le rôle du compte changent (et seulement dans ce cas).

## 1.29.0 — Comptes sur clé individuelle, consentement, administration, statistiques

- **Inscription sur clé d'accès individuelle** (usage unique, fournie par l'administrateur) à la place du code
  d'invitation partagé. Étape « Avant de commencer » : case à cocher (16 ans minimum, conditions d'utilisation,
  politique de confidentialité) et choix des statistiques par deux boutons de même poids, sans choix préselectionné.
  L'app fonctionne de la même façon dans les deux cas. Les comptes existants se voient poser la question une fois.
- **Statistiques d'usage minimales, avec consentement** (`js/telemetry.js`) : ouverture, écrans consultés, fin de
  session (type, durée, réponses, identifiants des cartes ratées), accueil terminé, erreurs. Jamais de texte saisi.
  Réglage dans Paramètres → Confidentialité ; refuser supprime ce qui a été collecté.
- **Administration** (Paramètres → Administration, comptes admin) : aperçu, création et révocation de clés,
  comptes (suspendre, formule, essai, module Cours, supprimer), statistiques (utilisateurs par jour, retour après
  inscription, écrans, sessions, cartes les plus ratées, erreurs).
- **Droits d'accès par compte** décidés par le serveur (modules, formule, essai). Le module Cours est réservé aux
  comptes qui en ont le droit (le vôtre l'a reçu à la migration).
- **Serveur v2** (`worker/`) : identifiant interne opaque, **fusion des données côté serveur** (les clients
  restent simples), adresses IP jamais stockées (empreinte salée), suspension, journal d'administration.
  Migration de la base existante : `worker/migrations/002_comptes_v2.sql` ; mode d'emploi : `worker/README.md`.
- **Polices hébergées par l'app** (IBM Plex, Fraunces, licence OFL) : plus aucune requête vers Google.
- Pages légales **à relire** : `legal/confidentialite.html`, `legal/cgu.html`, `legal/mentions.html` (champs de
  l'éditeur à compléter).

## 1.28.0 — Écran de connexion à l'ouverture

- L'app s'ouvre sur un écran **Connexion** (identifiant + mot de passe) tant qu'aucun compte n'est
  connecté ; « Créer un compte » ajoute la confirmation du mot de passe et le code d'invitation.
  Une fois connecté, le jeton reste sur l'appareil (90 jours) : l'app s'ouvre directement.
- L'écran revient après « Se déconnecter », une session expirée, une suppression de compte ou une
  réinitialisation des données. Les champs saisis sont conservés après une erreur.
- Serveur injoignable : un lien permet de continuer **sans connexion pour cette fois** (l'écran
  revient à l'ouverture suivante) ; déjà connecté, l'app s'ouvre même hors ligne.
- C'est une porte d'accès au compte de synchronisation, pas un coffre-fort : la progression reste
  lisible dans le navigateur de l'appareil.

## 1.27.0 — Compte et synchronisation entre appareils

- **Compte** (identifiant + mot de passe) créé depuis Paramètres → « Compte et synchronisation ». La
  progression (vocabulaire, cours, grammaire, small talk, XP, séries, records, historique, mots
  personnels) est fusionnée entre tes appareils au démarrage, au retour sur l'app et après chaque
  enregistrement. Rien n'est perdu quand deux appareils ont avancé chacun de leur côté (règles dans
  `js/lib/sync-merge.js`). L'app reste utilisable hors ligne.
- **Serveur** : un Cloudflare Worker + base D1 (`worker/`), avec mot de passe haché, verrouillage après
  5 échecs, jetons de session hachés, inscriptions sur code d'invitation. Mise en place : `worker/README.md`.
- Pas de récupération de mot de passe : prévoir une sauvegarde téléchargée de temps en temps.
- Chaque réponse enregistre maintenant un horodatage (`updatedAt`) sur la carte ; les sauvegardes
  existantes restent valides (champ optionnel). Les mots personnels ont aussi un `updatedAt`.
- La réinitialisation des données déconnecte l'appareil (la copie du serveur est conservée).

## 1.26.0 — Reprise après une pause

- Écran Vocabulaire : quand au moins 20 mots sont en retard de plus de 3 jours, une carte propose
  d'**étaler les retards sur 14 jours** (au moins 10 mots par jour, les boîtes basses et les plus
  anciens d'abord). Seules les échéances changent, jamais les boîtes ; les mots en cours
  d'apprentissage ne sont pas touchés. Bouton **Annuler** tant que la page n'est pas rechargée.
- Logique pure et testée dans `js/lib/resume.js`.

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
