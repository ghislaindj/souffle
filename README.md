# Souffle

Mes tablatures d'harmonica sur iPhone. PWA statique, sans build ni framework, qui fonctionne entièrement hors ligne. Spécification : `BRIEF.md`.

## Lancer en local

```sh
python3 -m http.server 8765
# http://localhost:8765/
```

Le service worker fonctionne sur `localhost`. Sur iPhone, il faut HTTPS (GitHub Pages).

## Installer sur l'iPhone

Ouvrir l'URL dans Safari, puis Partager › « Sur l'écran d'accueil ». Ouvrir l'app une fois en ligne : elle fonctionne ensuite en mode avion.

## Publier une nouvelle version

1. Modifier les fichiers.
2. Incrémenter `CACHE` dans `sw.js` (`souffle-v1` → `souffle-v2`). Sans ça, les iPhones gardent l'ancienne version.
3. Ajouter tout nouveau fichier à `ASSETS` dans `sw.js`.
4. Pousser. La nouvelle version s'applique au lancement qui suit la mise à jour.

## Données

- Tout est dans `localStorage`, clé `souffle:data` : `{version, chansons, reglages}`.
- Au premier lancement, `seed-songs.json` est chargé.
- Ajout ou modification de chansons : Bibliothèque › coller le JSON (une chanson, une liste ou l'objet complet). La fusion se fait par `id`.
- Paroles : éditeur intégré (menu « … » du lecteur ou Bibliothèque), une ligne par phrase, `|` pour caler sur les lignes de tab. Un réimport sans paroles conserve celles saisies dans l'app.
- Sauvegarde : Bibliothèque › Exporter (`souffle-AAAA-MM-JJ.json`).

## Contenu

- `fonts/` : Bricolage Grotesque, IBM Plex Sans et IBM Plex Mono (woff2, @fontsource 5.3.0, SIL OFL 1.1, voir `fonts/OFL.txt`).
- `icons/` : icônes PWA (`icon.svg` est la source).
- `assets/nosleep.mp4` : vidéo muette de 2 s, repli quand la Screen Wake Lock API manque.
