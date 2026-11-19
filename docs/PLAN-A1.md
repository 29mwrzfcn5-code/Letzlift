# Combler les trous de l'A1 : liste et plan de travail

Base : le programme A1 de LLO.LU (16 modules, 48 points de grammaire) comparé à LetzLift v1.44.0. La comparaison est faite sur les **titres** et par recherche de mots-clés dans nos données ; elle ne remplace pas une relecture avec la professeure.

Limite : LLO.LU publie les titres de modules et de leçons, mais les listes de mots de chaque leçon ne sont pas accessibles. La liste ci-dessous est donc exhaustive pour la **grammaire et les situations**, et indicative pour les **mots précis** (je proposerai des mots, contrôlés dans le dictionnaire LOD, pas ceux de LLO.LU).

## 1. Liste exhaustive des trous

### Grammaire : fiches à créer (données : `data/grammar.js`)

| # | Fiche | Contenu | Pourquoi (LLO.LU A1) |
|---|---|---|---|
| G1 | Les mots interrogatifs | Wat, Wat fir (e/eng), Wien, Wou, Wouhin / Wuer, Vu wou, Wéini, Wéi, Wéi vill | 8 leçons « W-Fro » |
| G2 | Poser une question oui / non | inversion du verbe, Jo / Nee / Doch, intonation | « Jo/Nee-Froen », « Haaptsaz an Inversioun » |
| G3 | Les verbes irréguliers (1) | kommen, goen, fueren, maachen, huelen : tableau, du / hien | 5 leçons « Onreegelméisseg Verben » |
| G4 | Les verbes irréguliers (2) | iessen, schlofen, changement de voyelle, règle générale | « Verbe mat Vokalwiessel », « iessen », « schlofen » |
| G5 | Le pluriel des noms | terminaisons principales, articles au pluriel | « Numerus : Singulier a Pluriel » |
| G6 | Situer : prépositions de lieu | an, op, bei, zu, aus, vun ; pays et villes ; Wou / Wouhin | 5 leçons « Lokal Prepositioune » |
| G7 | Le temps : prépositions et indications | um, am, vun… bis, no, virun, all ; jours et horaires | « Temporal Prepositiounen » (2 fois) |
| G8 | Les adverbes et « gär » | position, gär / léiwer / am léifsten, haut, ëmmer, net… | « Adverben », « Modaladverb gär » |
| G9 | Les conjonctions simples | an, awer, mee, oder, well | « Konjunktiounen » |
| G10 | Les nombres ordinaux | éischt… zwanzegst, dates | « Ordinalzuelen » |

### Grammaire : fiches existantes à compléter

| # | Fiche | À ajouter |
|---|---|---|
| E1 | Verbes réguliers | heeschen, léieren, schaffen, spillen, lauschteren, drénken : les six exemples du programme ; verbes en -t / -z (du schwätz) |
| E2 | Datif | pronoms personnels au datif (Wéi geet et dir ?), Wéi geet et ? |
| E3 | Articles | article + prénom (de Remy, d'Angèle), article défini / indéfini en tableau |
| E4 | Présent | les emplois du présent (maintenant, futur proche) |

### Jeux et exercices

| # | Où | À faire |
|---|---|---|
| J1 | Jeu « conjugaison éclair » (4 verbes aujourd'hui : sinn, hunn, schaffen, kachen) | ajouter kommen, goen, maachen, fueren, huelen, iessen, schlofen, léieren, spillen |
| J2 | Jeu des mots interrogatifs (`interrogatif`) | l'aligner sur la fiche G1 |
| J3 | Jeu des connecteurs (`connecteur`) | l'aligner sur la fiche G9 |

### Vocabulaire : situations de l'A1 à renforcer (`data/vocab.js`, environ 30 mots par lot)

| # | Situation | Pourquoi |
|---|---|---|
| V1 | Métiers et lieux de travail | module « Beruff » : on n'a ni Beruff, ni la plupart des métiers |
| V2 | Horaires et jours de travail | module « Horaire » (Aarbechtszäiten, Pause, Schicht) |
| V3 | Une journée type et le week-end | 2 leçons, verbes du quotidien (opstoen, sech wäschen, froschtécken) |
| V4 | Loisirs, famille et amis | 2 leçons ; compléter les 16 mots « Loisirs » |
| V5 | Inviter, rendez-vous, cinéma | module « Eng Persoun invitéieren » |
| V6 | Liste de courses et épicerie | 2 modules « Akafslëscht », « Kommissioune » : quantités, rayons, marché |
| V7 | Habitudes alimentaires et restaurant | 2 modules ; menu, entrée, plat, dessert, addition |
| V8 | Projets de vacances | module « Vakanzeprojeten » : hébergement, programme |

### Parler et cours

| # | Où | À faire |
|---|---|---|
| P1 | Parler (14 thèmes) | ajouter 3 thèmes : « Invitations et rendez-vous », « Ma journée », « Mon métier » |
| P2 | Cours | rien : le cours reste celui de la professeure, on ne touche pas |

## 2. Plan de travail

Une étape = une branche, une PR, une version. Chaque étape inclut : contenu, exercices, tests, contrôle dans le LOD (mots, genres, conjugaisons), CHANGELOG, et une liste « à valider avec la professeure ». Estimation en jours de travail pour moi, sans compter vos relectures.

| Étape | Contenu | Jours | Version |
|---|---|---|---|
| 1 | Poser des questions et situer : G1, G2, G6 + jeu J2 | 2 | 1.45.0 |
| 2 | Verbes : G3, G4, E1 + jeu éclair J1 (conjugaisons vérifiées une à une dans le LOD) | 2,5 | 1.46.0 |
| 3 | Petites règles : G5 pluriel, G7 temps, G8 adverbes et gär, G9 conjonctions + J3, G10 ordinaux, E2, E3, E4 | 3 | 1.47.0 |
| 4 | Vocabulaire du travail et du quotidien : V1, V2, V3, V4 (environ 120 mots) | 2,5 | 1.48.0 |
| 5 | Vocabulaire des échanges : V5, V6, V7, V8 (environ 120 mots) + P1 (3 thèmes Parler) | 3 | 1.49.0 |
| 6 | Contrôle final : relecture croisée avec le programme LLO.LU, mise à jour de `docs/LLO-PROGRAMME.md`, test qui signale tout nouveau trou | 1 | 1.50.0 |

Total : environ 14 jours de travail.

Ordre : les étapes 1 et 2 d'abord (ce sont les « murs » des débutants : poser une question, conjuguer les verbes courants), puis la grammaire de détail, puis les mots.

## 3. Règles de qualité (les mêmes que pour les leçons 7 et 8)

- Conjugaisons, genres, orthographe de chaque mot : contrôlés dans le LOD par un script. Tout mot absent ou à genre contesté est écarté ou signalé.
- La règle du n est testée sur toutes les phrases d'exemple.
- Aucune phrase copiée de LLO.LU : le contenu est rédigé pour LetzLift, seul le **plan** (les thèmes) s'en inspire.
- Les explications de grammaire (emplois des prépositions, des questions) sont de ma rédaction : à faire relire par la professeure avant de les présenter comme définitives. Elles sont listées dans `docs/course/VALIDATION.md`.

## 4. Ce qui reste hors périmètre

- Le cours de la professeure (leçons suivantes) : à importer quand vous avez les documents.
- L'A2 : les fiches (imparfait, comparatif, subordonnées…) viendront après l'étape 6.
