# Serveur de synchronisation LetzLift

Un Cloudflare Worker (`worker.mjs`, un seul fichier, aucune dépendance) et une base D1 (`schema.sql`).
Il stocke, par compte, la dernière sauvegarde envoyée par l'app ; la fusion entre appareils se fait
dans l'app (`js/lib/sync-merge.js`). Gratuit pour cet usage.

## Mise en place (une seule fois, depuis le tableau de bord Cloudflare)

1. **Base de données** : Storage & Databases → D1 → *Create database* → nom `letzlift-sync`.
   Onglet *Console* : collez le contenu de `schema.sql` et exécutez (si la console refuse plusieurs
   instructions d'un coup, exécutez-les une par une).
2. **Worker** : Workers & Pages → ouvrez votre Worker (ou *Create* → *Start with Hello World!*) →
   *Edit code* → remplacez tout par le contenu de `worker.mjs` → *Deploy*.
3. **Liaison à la base** : Settings → Bindings → *Add* → *D1 database* → nom de variable **`DB`** →
   choisissez `letzlift-sync` → *Deploy*.
4. **Code d'invitation** : Settings → Variables and Secrets → *Add* → type **Secret**, nom
   **`INVITE_CODE`**, valeur de votre choix (celle à saisir dans l'app pour créer un compte).
   Sans ce secret, les inscriptions sont fermées.
5. **Adresse** : celle du Worker (`https://….workers.dev`). Dans LetzLift : Paramètres → Compte et
   synchronisation → collez l'adresse, choisissez un identifiant et un mot de passe (10 caractères
   minimum), saisissez le code d'invitation → *Créer le compte*. Sur les autres appareils : *Se connecter*.

Variable facultative `ALLOWED_ORIGINS` : origines autorisées à appeler le serveur, séparées par des
virgules (défaut : `https://29mwrzfcn5-code.github.io`).

## Sécurité

- Mot de passe : PBKDF2-SHA256 (100 000 itérations, sel aléatoire), jamais stocké en clair ni renvoyé.
- Connexion : verrouillage de 15 minutes après 5 échecs sur un compte ; 30 essais par 10 minutes et par
  adresse ; même message d'erreur pour un compte inconnu et un mauvais mot de passe.
- Jetons de session : aléatoires (256 bits), stockés hachés, valables 90 jours, 10 par compte au maximum.
  Un changement de mot de passe déconnecte les autres appareils.
- Accès réservé à l'origine du site (CORS) ; 1,5 Mo de données par compte au maximum.
- **Pas de récupération de mot de passe** (aucune adresse e-mail n'est stockée) : en cas d'oubli, il faut
  créer un nouveau compte et restaurer une sauvegarde téléchargée depuis l'app.
- Limites connues : la fusion garde le plus grand compteur (XP, statistiques) au lieu de les additionner ;
  un mot personnel supprimé sur un appareil peut revenir depuis un autre.

## Tests

`npm test` couvre le serveur (`tests/worker.test.js`, sur une base SQLite qui imite D1), la fusion
(`tests/sync-merge.test.js`) et le cycle complet avec deux appareils simulés (`tests/sync-core.test.js`).
