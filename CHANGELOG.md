# Changelog

Les versions suivent le numéro affiché dans l'application (pastille en haut à gauche).

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
