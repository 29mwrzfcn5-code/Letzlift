# Mon voyage : module pilote

Parcours en unités d'environ 10 minutes. Une seule unité pour l'instant : « Faire ses courses ».

## Qui le voit

Deux droits, donnés par l'administrateur (écran Admin) :

| Droit | Effet |
|---|---|
| `voyage` | l'onglet « Mon voyage » apparaît dans la barre du bas, à la place de « Grammaire » (la grammaire reste sur l'accueil) ; lien « Mon voyage » sur l'accueil |
| `audio` | boutons de lecture du son dans les unités ; sans ce droit, aucun fichier audio n'est même téléchargé |

On les donne à la création d'une clé d'invitation (cases à cocher) ou compte par compte (bouton « Donner Mon voyage » / « Donner le son »). Aucun changement du serveur n'est nécessaire.

## Une unité

1. Écouter la scène (dialogue, texte et traduction toujours visibles)
2. Découvrir les mots (une carte par mot ou expression, genre en couleur)
3. Reconnaître (on écoute puis on choisit la traduction ; sans le droit audio, on lit la phrase)
4. Comprendre (mini-règle d'un écran)
5. Produire (phrases à trous, saisie)
6. Jouer la scène (on choisit la réplique du client)
7. Bilan (étoiles sur toutes les questions, mots ajoutés aux révisions espacées)

Fin d'unité : si au moins une étoile, les mots de l'unité qui sont dans le vocabulaire et pas encore vus entrent dans les révisions (boîte 2, première révision le lendemain). Progression enregistrée dans le profil (`userProfile.voyage`), donc sauvegardée et synchronisée comme le reste.

## Ajouter une unité

1. Écrire l'unité dans `data/voyage.js` (même forme que « courses »). Les mots listés dans `words` doivent exister dans le vocabulaire.
2. Décrire le son dans un manifeste (`tools/voyage-audio-<unité>.json` : id, voix `maxine` ou `claude`, texte en minuscules, sans espace avant `?` ni `!`).
3. Générer : `python3 tools/voyage-audio.py tools/voyage-audio-<unité>.json --verify` (nécessite `ffmpeg`). Avec `--verify`, chaque clip est transcrit par la reconnaissance vocale de la Sproochmaschinn et refait tant que la transcription ne correspond pas (`VOYAGE_TRIES=8` pour insister) ; `tools/voyage-audio-check.py` contrôle les clips existants. La synthèse varie d'un essai à l'autre et se trompe surtout sur les mots isolés. Écrit `assets/audio/voyage/<unité>/<id>.mp3`. Un clip déjà présent n'est pas refait.
4. Écouter chaque clip. Un mot mal prononcé se corrige en réécrivant le texte dans le manifeste (pas le texte affiché), puis en supprimant le fichier et en relançant.
5. `npm test` vérifie que chaque son cité existe, qu'il est dans le manifeste, et que la règle du n est respectée devant les trous.

## Son : origine et conditions

- Voix de synthèse **Maxine** et **Claude**, produites par la Sproochmaschinn (Zenter fir d'Lëtzebuerger Sprooch), via son API. Le son est généré une fois et livré avec l'app.
- Conditions lues sur le site : l'accès par programme est réservé à un usage **non commercial** ; pour une application commerciale, contacter le ZLS. La voix **Max** est interdite ici (non commerciale, non téléchargeable). Les fiches des modèles Maxine et Claude annoncent la licence MIT.
- Tant que l'app est gratuite, l'usage est conforme. **Avant toute offre payante, demander la confirmation écrite du ZLS.**
- Le droit `audio` masque les boutons, il ne protège pas les fichiers : ils sont servis par le site comme le reste de l'app.
- Les voix de synthèse peuvent mal prononcer un mot : à faire valider par un locuteur natif avant d'ouvrir le son à d'autres comptes.

## Unités

| # | Unité | Règle |
|---|---|---|
| 1 | Faire ses courses | « e » ou « en » (règle du n) |
| 2 | Poser des questions | le verbe juste après le mot interrogatif |
| 3 | Ma famille | « mäin », « mäi » ou « meng » (genre et règle du n) |
