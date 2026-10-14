# Letzlift
Application d'apprentissage du Luxembourgeois

Ouvrir `index.html` dans un navigateur (double-clic suffisant, aucun serveur ni build).

## Organisation

- `index.html`, `css/styles.css` : structure et styles
- `data/` : vocabulaire, grammaire, small talk
- `js/lib/` : logique pure testée ; `js/` : reste de l'application (scripts classiques, chargés dans l'ordre indiqué par `index.html`)
- `assets/img/` : images du jeu « Décris l'image »
- `archive/letzlift-v1.18.0.html` : version d'origine en un seul fichier
- `docs/AUDIT.md` : audit de la v1.18.0
- `tests/`, `tools/` : tests et scripts de vérification
- `CHANGELOG.md`

## Tests et vérifications

Aucune dépendance : Node (≥ 20) suffit.

```
npm test                        # tests unitaires et de compatibilité (node:test)
node tools/verify-split.js      # données, images, CSS, HTML et handlers identiques à l'archive v1.18.0
```

La logique pure (dates, répétition espacée, XP, séries) est dans `js/lib/`, utilisable à la fois dans
le navigateur et dans Node.
