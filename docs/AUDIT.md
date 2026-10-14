# Audit de `letzlift.html` (v1.18.0)

Phase 0 : lecture complète du fichier, aucune modification du code.
Les numéros de ligne renvoient à `letzlift.html` tel qu'il est dans le dépôt (6 858 lignes, 753 386 octets).

## 1. Structure actuelle

Un seul fichier, trois blocs.

| Lignes | Contenu |
|---|---|
| 1-8 | `<head>` : charset, viewport (`viewport-fit=cover`), titre, `preconnect` + feuille Google Fonts (Fraunces, IBM Plex Sans, IBM Plex Mono) |
| 9-896 | `<style>` : variables CSS (`:root`, l.10-42), styles, 8 `@media` (720/640/480 px, `prefers-reduced-motion`) |
| 898-1098 | `<body>` : topbar, barre d'onglets basse, 23 `<div class="view" id="view-…">` (une par écran), pied de page, overlay du bilan hebdo |
| 1100-6856 | `<script>` unique (≈ 5 750 lignes) |

Aucun `<link>` ni `<script src>` local. Seule ressource externe : Google Fonts.

### Découpage du `<script>`

| Lignes | Contenu | Remarques |
|---|---|---|
| 1101-1573 | `const VOCAB` (386 mots) | champs : `id, lu, fr, sentence, sentenceFr, cat` + optionnels `note, g, altLu` |
| 1575-1603 | Surcouche vocabulaire : `vocabOverlay`, `applyVocabOverlay()` | **mute `VOCAB` en place** au chargement |
| 1605-1952 | `const GRAMMAR` (14 fiches) | `id, title, eyebrow, summary, rule, exercises` ; `rule` contient du HTML |
| 1954-2200 | `const SMALLTALK` (14 thèmes, 215 phrases) | `id, icon, theme, phrases[{lu, fr}]` |
| 2202-2333 | Clés de stockage, état global, constantes (XP, jetons, défi, timer, niveaux), `MINI_GAMES`, learning steps | |
| 2334-2410 | `BADGES` (36), déblocages par niveau | les `check()` lisent l'état global |
| 2412-2604 | Couche de stockage (`storageGet/Set`), `loadState`, `save*`, import/export CSV du vocabulaire | |
| 2605-2813 | Sauvegarde/restauration JSON, validation, onboarding | |
| 2815-3003 | Moteur XP, objectif du jour, défi du jour, `archiveDay` | |
| 3005-3083 | Chronomètre de temps actif + 3 écouteurs globaux | effets de bord au chargement |
| 3085-3194 | **Dates** (`todayStr`…), `updateStreak`, vacances | |
| 3196-3349 | Bilan hebdomadaire | |
| 3351-3567 | Répétition espacée (Leitner), files de session, détection de relâchement | |
| 3569-3596 | `switchView` + écouteurs des onglets | effet de bord au chargement |
| 3598-4229 | Rendu : accueil, hub vocabulaire, paramètres, liste de vocabulaire | |
| 4231-4336 | Sessions de vocabulaire (4 sortes) | |
| 4338-4650 | Test de placement | |
| 4652-4944 | Comparaison de saisies, cartes de session, réponses | |
| 4946-5014 | Grammaire | |
| 5016-5223 | Jeux : Conjugaison éclair, Vrai/Faux | |
| 5225-5448 | Small Talk + moteur « phrase drill » | |
| 5450-6641 | Jeux : Memory, Intrus, Horloge, Bon article, Décris l'image (+ `DESCRIPTION_SCENES`), Devine la question, Relie les idées, Timeline, Anagramme, Dialogue | |
| 6644-6798 | Écran Niveau (estimation CECRL, stats, badges, sauvegarde) | |
| 6800-6855 | Menu avatar, navigation clavier, `init` | |

### Poids

Les 8 images JPEG en base64 (l.5893, 5908, 5923, 5938, 5953, 5968, 5983, 5998) pèsent ≈ 353 Ko sur 753 Ko. Elles sont uniquement référencées par `DESCRIPTION_SCENES[i].img`, lu à un seul endroit (`nextImageDescScene`, l.6057, `<img src="${scene.img}">`). L'extraction est donc simple.

### Chiffres de référence (pour la vérification de la phase 1)

`VOCAB` : 386 entrées, 386 ids uniques. `GRAMMAR` : 14. `SMALLTALK` : 14 thèmes, 215 phrases. 13 mini-jeux (`MINI_GAMES`).

## 2. État global partagé

Tout est déclaré au niveau supérieur du script (`const`/`let`), donc dans la portée lexicale globale : les attributs `onclick="…"` y accèdent, y compris à des *variables* (ex. `startPhraseDrill(pdSourceItems, {label: pdContextLabel, …})` l.5331 dans un gabarit). Cela continuera de marcher avec plusieurs `<script>` classiques, mais pas avec des modules ES.

### Données persistées (9 clés `letzlift:*` + 1)

| Variable | Clé de stockage | Dans la sauvegarde JSON ? |
|---|---|---|
| `vocabProgress` | `vocab-progress` | oui |
| `grammarProgress` | `grammar-progress` | oui |
| `sessionStats` | `session-stats` | oui |
| `smalltalkProgress` | `smalltalk-progress` | oui |
| `xpState` | `xp` | oui |
| `dailyState` | `daily-state` | oui |
| `gameRecords` | `game-records` | oui |
| `userProfile` | `profile` | oui |
| `dailyHistory` | `daily-history` | oui |
| `vocabOverlay` | `vocab-overlay` | **non** (voir §5) |

Formats utiles :
- `vocabProgress[id] = { box:1-5, dueAt:<ms epoch>, learningStep?:0-3, wrongCount? }`
- `sessionStats` : `streakDays, lastActiveDate('YYYY-MM-DD'), totalReviews, totalSessions, totalDaysActive, pauseTokens, lastTokenAwardStreak, totalActiveSeconds, lastWeeklyReviewWeek('YYYY-MM-DD' du lundi), totalAnswered, totalCorrect, lastBackupExportAt('YYYY-MM-DD'), vacationStart, vacationEnd, pauseTokenJustUsed/JustEarned/EarnedVia`
- `dailyState` : `date('YYYY-MM-DD'), xpToday, newWordsToday, activeSeconds, answeredToday, correctToday, answersToday, miniGamesCompletedToday, challengeRewardedToday, challengeGames, challengeGamesDone`
- `dailyHistory[] = {date, xp, newWords, answered, correct, seconds}` (plafonné à 400 jours)

### Couche de stockage

`storageGet/storageSet` : `window.storage` (artefact claude.ai) s'il existe, sinon `localStorage`, avec `try/catch` partout. `usingLocalStorageBackend()` pilote l'affichage du rappel de sauvegarde et deux textes d'interface.

### État de session (en mémoire, non persisté)

- Vocabulaire : `sessionQueue, sessionIndex, sessionPlannedIds, sessionSeenIds, sessionCredit, sessionAnswered, sessionCorrect, sessionDifficultWords, currentItem, currentMode, sessionKind, difficultRepCount`. **`sessionKind` est lu par `recordAnswer()`** : la répétition espacée dépend donc d'un état d'écran (voir §4).
- Placement : `pl*` (11 variables).
- Jeux : un préfixe par jeu (`flash*, tf*, pd*, mem*, intrus*, clock*, art*, imgd*, intg*, conn*, tl*, ana*, dlg*`). Les `*TimerInterval` sont des `setInterval` globaux.
- Chronomètre : `timerOnExerciseScreen, timerRunningSince, timerIdleId, timerFlushId`.
- Filtres : `vocabListFilters`.

### Effets de bord à l'exécution du script

Ils imposent l'ordre de chargement des fichiers :
1. l.3060-3074 : 4 `addEventListener` sur `document`/`window` (timer, visibilité, `beforeunload`) ;
2. l.3594 : écouteurs sur `.nav-tab` (nécessite que le DOM soit déjà parsé) ;
3. l.6833 : écouteur `keydown` (navigation clavier) ;
4. l.6851 : `init()` auto-exécutée (`loadState` → `switchView('home')` → `maybeShowWeeklyReview`).

Les `<script>` doivent donc rester en fin de `<body>`, et `init` doit être dans le **dernier** fichier chargé.

## 3. Fonctions qui dépendent de la date

### 3.1 Le bug

```js
function todayStr(){ return new Date().toISOString().slice(0,10); }   // l.3085
```

`toISOString()` est en UTC. Au Luxembourg (UTC+1 l'hiver, UTC+2 l'été), entre 00:00 et 01:00 (hiver) ou 02:00 (été), `todayStr()` renvoie encore la **veille**. Conséquences : l'objectif du jour, le défi et les quotas ne se réinitialisent pas à minuit local ; une session faite à 00:30 est comptée sur la veille (la série peut ne pas avancer, ou une journée peut être « avalée »).

Les quatre helpers `daysBetween`, `mondayOf`, `addDaysStr`, `formatDayFR` travaillent en UTC *sur des chaînes `YYYY-MM-DD`* (`T00:00:00Z` + méthodes `getUTC*`) : c'est **correct** en soi (pas de changement d'heure en UTC, donc pas de dérive de 23 h/25 h), à condition de ne leur passer que des dates calendaires. Le défaut est uniquement la *source* de « aujourd'hui ».

### 3.2 Inventaire

| Fonction (ligne) | Usage de la date | Risque |
|---|---|---|
| `todayStr()` (3085) | source de « aujourd'hui », UTC | **bug racine** |
| `daysBetween(a,b)` (3088) | écart entre deux `YYYY-MM-DD` via `Date.UTC` | sain si entrées valides ; renvoie `NaN` si une chaîne est invalide |
| `ensureDailyState()` (2818) | `dailyState.date !== todayStr()` → archive la veille et repart de zéro | change de jour à minuit **UTC** |
| `archiveDay()` (2834) | archive sous `day.date` | hérite de l'erreur précédente |
| `updateStreak()` (3094) | `lastActiveDate`, écart, jours manqués, vacances, jetons | série, jetons, vacances |
| `declareVacation*` (3163-3194) | dates saisies via `<input type="date">` (**locales**) comparées à `todayStr()` (**UTC**) | incohérence entre deux référentiels |
| `mondayOf` / `addDaysStr` / `formatDayFR` (3202-3219) | semaine lundi→dimanche, UTC sur chaîne | sains |
| `aggregateWeek` (3224) | `todayStr()`, bornes de semaine | dépend du bug racine |
| `showWeeklyReview` (3261) | `todayStr()`, jours futurs, `daysBetween` | idem |
| `openCurrentWeekReview`, `maybeShowWeeklyReview` (3325, 3336) | `mondayOf(todayStr())`, `lastWeeklyReviewWeek` | bilan déclenché au mauvais moment la nuit du dimanche au lundi |
| `renderHome` (3672) | rappel de sauvegarde : `daysBetween(lastBackupExportAt, todayStr())` | idem |
| `exportBackup` (2626, 2631) | nom de fichier `new Date().toISOString().slice(0,10)` ; `lastBackupExportAt = todayStr()` | UTC dans les deux cas |
| `exportVocabSpreadsheet` (2656) | nom de fichier via `todayStr()` | UTC |
| `buildBackupPayload` (2615) | `exportedAt: new Date().toISOString()` | **à garder en UTC** : c'est un instant, pas un jour |
| `renderNiveau` (6684) | `aggregateWeek(mondayOf(todayStr()), true)` | dépend du bug racine |
| `handleImportBackupFile` (2785) | affiche `payload.exportedAt.slice(0,10)` | date UTC affichée ; mineur |

### 3.3 Dates en timestamp (pas de chaîne)

`isDue`, `recordAnswer`, `applyPlacementDecision`, `timerFlush` etc. utilisent `Date.now()` et des intervalles en millisecondes (`BOX_INTERVALS_MS` : 5 min, 24 h, 3 j, 7 j, 14 j). Ce sont des instants absolus : ils ne sont **pas** touchés par le bug UTC. Le changement d'heure décale seulement l'heure locale d'échéance de ±1 h (« 1 jour » = 24 h exactes, pas « demain à la même heure »). C'est un choix acceptable, à documenter et à tester plutôt qu'à changer (changer le comportement de la répétition espacée n'est pas demandé).

### 3.4 Autres constats liés au temps

- `updateStreak()` n'est appelée qu'au chargement (`loadState`), après un import et après une réinitialisation. `ensureDailyState()`, elle, est appelée partout et bascule le jour. Si l'app reste ouverte à travers minuit (cas typique d'une PWA rouverte sans rechargement), `dailyState` passe au nouveau jour mais **la série n'est pas mise à jour avant le prochain rechargement**. À traiter en phase 2 (appeler `updateStreak()` quand `ensureDailyState()` change de jour).
- Les `setTimeout` / `setInterval` des jeux (chrono en secondes) utilisent `Date.now()` pour des durées : indépendants du calendrier.

## 4. Points à risque pour un découpage

1. **Ordre de chargement et temporal dead zone.** Les `const`/`let` globaux de scripts différents partagent la portée lexicale globale, mais l'*initialisation* suit l'ordre des `<script>`. Les données (`VOCAB`, `GRAMMAR`, `SMALLTALK`) doivent venir avant tout code qui s'exécute au chargement. Les fonctions déclarées sont hissées seulement *dans leur propre script* : toute exécution à l'initialisation doit venir après la déclaration de ce qu'elle appelle. Mitigation : seuls les effets de bord listés en §2 s'exécutent au chargement ; `init` dans le dernier fichier.
2. **`onclick="…"` : 69 noms de fonctions distincts** dans les attributs (statiques et dans des gabarits JS), plus les lanceurs écrits en chaînes dans `MINI_GAMES[].fn` et `DAILY_CHALLENGE_GAME_LAUNCHERS` (ex. `chooseIntrusLevel()`, `startVocabPhraseDrill()`) : 79 fonctions au total, d'après le script `tools/verify-split.js`. Tous doivent rester globaux. Un script classique le garantit ; un module ES le casserait. La phase 1 ajoute un script de vérification qui extrait ces noms et contrôle leur existence.
3. **Gabarits qui référencent des variables globales** dans des chaînes (`pdSourceItems`, `pdContextLabel`, …) : ne pas renommer ni encapsuler ces variables.
4. **Couplage `sessionKind` ↔ `recordAnswer`** : la logique Leitner lit une variable définie dans la partie « rendu de session ». Pour extraire la répétition espacée en logique pure (phase 2), il faudra passer `sessionKind` en paramètre. En phase 1, on ne change rien : `sessionKind` reste un global.
5. **Mutation de `VOCAB` par la surcouche.** `applyVocabOverlay()` modifie `VOCAB` en place et peut y ajouter des mots. La vérification d'identité des données doit donc comparer `VOCAB` **avant** `applyVocabOverlay()` (ou avec une surcouche vide).
6. **Bornes des blocs de données** : les trois tableaux sont autonomes (aucune référence extérieure), donc déplaçables tels quels, byte pour byte, dans `data/*.js`.
7. **Images** : seules les 8 lignes `img:'data:image/jpeg;base64,…'` changent (remplacées par `img:'assets/img/<id>.jpg'`). Sous `file://`, `<img src>` relatif fonctionne. Les 8 `id` de scène (`bureau`, …) serviront de noms de fichiers.
8. **Polices Google** : chargées par `<link>` externe. Hors ligne et sans service worker, repli sur les polices système (déjà le cas aujourd'hui). À traiter en phase 3.
9. **`window.storage`** (artefact claude.ai) : branche à conserver telle quelle dans `storage.js`.
10. **Chemins relatifs.** Tout en relatif (`css/…`, `js/…`) pour que `file://` et GitHub Pages (sous-chemin `/Letzlift/`) marchent sans configuration.
11. **Commentaires historiques** : très nombreux et utiles (noms de versions, incidents). À déplacer sans les réécrire.
12. **Texte de l'onboarding** (l.3622-3626) : « ce fichier … sur cet ordinateur ». Il deviendra inexact une fois l'app installée. Contenu non pédagogique mais texte d'interface : à signaler plutôt qu'à modifier sans accord (voir §6).

## 5. Constats hors périmètre immédiat (à ne pas corriger sans accord)

- **La surcouche vocabulaire (`letzlift:vocab-overlay`) n'est pas dans la sauvegarde JSON.** Conséquences : (a) un changement d'adresse (phase 3) perd les mots enrichis, même après export/import ; (b) `validateBackupPayload` rejette une sauvegarde dont `vocabProgress` contient un id inexistant dans `VOCAB`, donc une sauvegarde faite avec un mot ajouté par l'utilisateur ne se réimporte pas dans une installation sans la surcouche (« progression vocabulaire invalide »). Le format de sauvegarde est une contrainte absolue ; je propose de documenter la procédure dans le README (export CSV du vocabulaire avant migration, réimport CSV après) plutôt que d'étendre le format.
- `vocabOverlay` : les valeurs sont interdites de `<` et `>` à l'import CSV, ce qui protège les gabarits qui insèrent `v.lu` / `v.fr` sans échappement.
- Les gabarits insèrent `VOCAB`, `GRAMMAR`, `SMALLTALK` sans `escapeHtml` (contenu de confiance, `GRAMMAR.rule` contient volontairement du HTML). Seuls `userProfile.name` (`safeUserName`) et quelques champs saisis sont échappés. Je garde ces échappements tels quels.
- **Bug avéré, présent dans la v1.18.0 (constaté au test de fumée de la phase 1)** : un prénom contenant `<` ou `>` est accepté par `saveSettingsName` / `submitOnboardingName` (affiché correctement grâce à `escapeHtml`), mais `isSafeBackupValue` refuse ces caractères à l'import : la sauvegarde exportée est alors rejetée (« contenu invalide »). Non corrigé en phase 1 (aucun changement de comportement) ; correctif possible en phase 2 côté saisie du prénom, sans toucher au format de sauvegarde.
- `confirmResetData` ne réinitialise pas `userProfile` ni `vocabOverlay` (comportement existant).

## 6. Questions pour toi

1. Texte d'onboarding « ce fichier … cet ordinateur » : on le laisse tel quel en phase 1, et on décide en phase 3 s'il faut l'adapter à l'app installée ?
2. Surcouche vocabulaire absente de la sauvegarde : OK pour la traiter par la procédure CSV dans le README, sans toucher au format ?

## 7. Arborescence proposée

```
index.html                  # structure HTML seule, <link> CSS + <script> classiques, version v1.19.0
css/styles.css              # CSS extrait tel quel
data/vocab.js               # const VOCAB
data/grammar.js             # const GRAMMAR
data/smalltalk.js           # const SMALLTALK
assets/img/                 # 8 JPEG extraits (bureau.jpg, …)
js/
  storage.js                # clés, couche get/set, loadState, save*, surcouche vocabulaire, import CSV
  profile.js                # état global persistant, profil, onboarding, sauvegarde/restauration JSON
  dates.js                  # todayStr, daysBetween, mondayOf, addDaysStr, formatDayFR   (phase 2 : pur, testable)
  srs.js                    # Leitner, learning steps, files de session, détection de relâchement
  progress.js               # XP, objectif/défi du jour, séries, vacances, badges, déblocages, chrono actif, bilan hebdo
  render-core.js            # switchView, escapeHtml, accueil, hub vocabulaire, paramètres, liste, Niveau
  vocab-session.js          # sessions, placement, cartes, réponses
  games/
    grammar-smalltalk.js    # grammaire, small talk, phrase drill
    flash-truefalse.js
    memory-intrus-horloge.js
    article-imagedesc.js    # + DESCRIPTION_SCENES
    interrogatif-connecteur.js
    timeline-anagramme-dialogue.js
  main.js                   # navigation clavier, menu avatar, init  (DERNIER chargé)
archive/letzlift-v1.18.0.html   # original intact
tools/                      # scripts de vérification (node, sans dépendance)
docs/AUDIT.md
CHANGELOG.md
```

Ordre de chargement : `data/*` → `dates` → `storage` → `profile` → `srs` → `progress` → `render-core` → `vocab-session` → `games/*` → `main`.

Cette arborescence est un découpage de *placement* : les fonctions sont déplacées sans être modifiées. Les regroupements les plus discutables sont `progress.js` (XP + séries + badges + chrono + bilan, cohérent mais gros) et `render-core.js`. Je les garde ainsi en phase 1 pour ne rien changer au comportement ; la phase 2 en extraira la logique pure dans des fichiers testables (`dates.js`, et des modules `srs`/`xp`/`streak` utilisables aussi dans Node).
