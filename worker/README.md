# Serveur LetzLift (comptes, synchronisation, statistiques, administration)

Un Cloudflare Worker et une base D1. Le code source est dans `src/worker.mjs` ; **le fichier à coller dans
Cloudflare est `worker.mjs`**, produit par `node tools/build-worker.mjs` (il embarque la bibliothèque de
fusion `js/lib/sync-merge.js`). Un test vérifie qu'il est à jour.

## Ce que fait le serveur

- **Comptes** : identifiant + mot de passe, création sur **clé d'accès individuelle** (usage unique, remise
  par l'administrateur), conditions et âge (16 ans) enregistrés avec leur version.
- **Mot de passe oublié sans e-mail** : un **code de récupération** personnel (`LZR-XXXXX-XXXXX-XXXXX`) est donné à
  l'inscription, une seule fois. Il permet de choisir un nouveau mot de passe, puis il est remplacé par un nouveau code.
- **Synchronisation** : l'app envoie ses données, le serveur les **fusionne** avec sa copie et renvoie le résultat.
- **Droits d'accès** par compte : modules (ex. `course`), formule (`free` / `premium`), période d'essai.
- **Statistiques d'usage** : seulement pour les comptes qui les ont acceptées ; événements minimaux, jamais de texte saisi.
- **Administration** (comptes de rôle `admin`) : clés, comptes, statistiques. Journal des actions.

## Mettre à jour vers la version 3 (code de récupération) — votre cas actuel

**Dans cet ordre : d'abord la base, ensuite le code.** (Si vous collez le code avant la migration, les créations de compte échouent.)

1. **Migration** : Cloudflare → D1 → votre base → *Console* → collez les **deux lignes** de
   `migrations/003_recuperation.sql` → *Execute*. Vérification : `SELECT username, recovery_hash FROM users;`
   doit afficher vos comptes avec `NULL` dans la deuxième colonne (pas encore de code).
2. **Code** : Workers & Pages → votre Worker → *Edit code* → tout sélectionner, coller le contenu de `worker.mjs` → *Deploy*.
3. Vérification : `https://<votre-worker>.workers.dev/api/health?essai=1` doit afficher `{"ok":true,"version":3}`.
4. Fusionnez la version de l'application correspondante (GitHub). Les comptes existants verront un rappel pour
   créer leur code (Paramètres → Mot de passe et compte → *Créer mon code de récupération*).

Un compte qui a perdu **à la fois** son mot de passe et son code : administration → Comptes → *Actions* →
*Code de récupération* ; transmettez le code affiché à la personne, qui choisit alors un nouveau mot de passe depuis
« Mot de passe oublié ? ».

## Mettre à jour une base existante (version 1 → 2)

À faire dans cet ordre ; l'ancienne version de l'app continue de fonctionner pendant la mise à jour.

1. **Migration** (les fichiers SQL ne contiennent volontairement aucun commentaire : la console D1 peut coller le texte sur une seule ligne) : Cloudflare → D1 → votre base → *Console* → collez tout le contenu de
   `migrations/002_comptes_v2.sql` → *Execute*. Votre compte et sa progression sont conservés ; le plus ancien
   compte devient administrateur et reçoit le module Cours. Vérification : `SELECT username, role FROM users;`
2. **Code** : Workers & Pages → votre Worker → *Edit code* → tout sélectionner, coller le contenu de
   `worker.mjs` → *Deploy*. La liaison `DB` reste en place.
3. **Nettoyage** (facultatif) : Settings → Variables and Secrets → supprimez `INVITE_CODE` (plus utilisé).
   Vous pouvez ajouter un secret `RATE_SALT` (texte aléatoire long) : il sale l'empreinte des adresses IP.
4. Fusionnez ensuite la version de l'application correspondante (GitHub) : les écrans d'inscription et
   d'administration apparaissent.

Test rapide : ouvrir `https://<votre-worker>.workers.dev/api/health` doit afficher `{"ok":true,"version":2}` (puis 3 après la mise à jour ci-dessus).

## Installation neuve

1. D1 → créer une base → *Console* → coller `schema.sql` → *Execute*.
2. Coller `worker.mjs` dans un Worker, ajouter la liaison D1 `DB`.
3. Générer une clé de départ : `node tools/bootstrap-sql.mjs LZ-VOTRE-CLE1 votre-identifiant`, puis exécuter le
   premier bloc SQL affiché dans la console D1.
4. Créer votre compte dans l'app avec cette clé, puis exécuter le second bloc SQL (il vous donne le rôle admin).

## Utiliser l'administration

Connecté avec un compte admin : Paramètres → **Administration**.
- *Clés d'accès* : « Pour qui ? », droits (module Cours, essai en jours, durée de validité) → *Créer la clé*.
  La clé s'affiche **une seule fois** : copiez-la et transmettez-la. Seule son empreinte est stockée.
- *Comptes* : suspendre ou rétablir, formule premium, essai, module Cours, nouveau code de récupération, supprimer.
- *Statistiques* : utilisateurs par jour, retour après inscription, écrans, sessions, cartes les plus ratées, erreurs.

## Sécurité et données personnelles

- Mot de passe : PBKDF2-SHA256 (100 000 itérations, sel aléatoire), jamais stocké ni renvoyé en clair.
- Connexion : verrouillage de 15 minutes après 5 échecs ; 30 essais par 10 minutes et par adresse ; même
  message pour un compte inconnu et un mauvais mot de passe.
- **Adresses IP : jamais stockées**, seulement une empreinte salée (au plus une heure) pour limiter les essais.
- Jetons de session : 256 bits, stockés hachés, 90 jours, 10 par compte au maximum ; un changement de mot de
  passe déconnecte les autres appareils ; un compte suspendu est refusé immédiatement.
- Identifiant interne opaque (`users.id`) : c'est lui, et non le pseudonyme, qui relie les statistiques.
- Retrait du consentement ou suppression du compte : les événements du compte sont effacés ; événements purgés
  au bout d'environ 13 mois.
- Accès réservé à l'origine du site (CORS) ; 1,5 Mo de données par compte au maximum ; actions d'administration
  consignées dans `admin_log`.
- **Récupération du mot de passe** : code personnel de 15 caractères (75 bits), seule son **empreinte** (liée au
  compte) est stockée, jamais le code. 5 essais par compte et par 15 minutes, 15 par adresse et par heure ; même
  message d'erreur pour un code faux, un compte inconnu ou un compte sans code. Une récupération réussie
  déconnecte tous les appareils, lève le verrouillage de connexion et remplace le code par un nouveau.
  La récupération **par e-mail** viendra avec un nom de domaine.
- Limites connues : XP et statistiques fusionnés par le plus grand compteur (pas par somme) ; un mot
  personnel supprimé sur un appareil peut revenir depuis un autre.

## Tests

`npm test` couvre le serveur (`tests/worker.test.js`, sur une base SQLite qui imite D1, migration de la
version 1 comprise), la fusion (`tests/sync-merge.test.js`), le client (`tests/sync-core.test.js`,
`tests/auth-gate.test.js`) et la cohérence du fichier à coller.
