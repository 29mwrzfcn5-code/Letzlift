# Letzlift
Application d'apprentissage du Luxembourgeois

Ouvrir `index.html` dans un navigateur (double-clic suffisant, aucun serveur ni build).

## Organisation

- `index.html`, `css/styles.css` : structure et styles
- `data/` : vocabulaire, grammaire, small talk
- `js/` : logique de l'application (scripts classiques, chargés dans l'ordre indiqué par `index.html`)
- `assets/img/` : images du jeu « Décris l'image »
- `archive/letzlift-v1.18.0.html` : version d'origine en un seul fichier
- `docs/AUDIT.md` : audit de la v1.18.0
- `CHANGELOG.md`

## Vérification du découpage

```
node tools/verify-split.js
```
