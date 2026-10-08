# Souffle — brief de développement

App perso pour stocker et lire mes tablatures d'harmonica sur iPhone. Usage strictement personnel, aucun backend, aucun compte, pas d'App Store.

Maquettes de référence : canvas « App Tablatures Harmonica » (4 écrans : liste, lecteur portrait, bibliothèque, lecteur paysage). Données de départ : `seed-songs.json` (4 chansons).

## 1. Choix techniques (non négociables pour la V1)

- **PWA statique**, installée via Safari › Partager › « Sur l'écran d'accueil ».
- **Zéro build, zéro framework** : HTML + CSS + JS vanilla (modules ES). Fichiers : `index.html`, `app.js`, `styles.css`, `sw.js`, `manifest.webmanifest`, `icons/`, `fonts/`, `seed-songs.json`.
- **Hébergement** : GitHub Pages (HTTPS obligatoire pour le service worker). Le repo peut être public, il ne contient aucune donnée perso hormis les tablatures de départ.
- **Hors ligne complet** : service worker cache-first, cache versionné (`souffle-v1`, à incrémenter à chaque release), purge des anciens caches à l'activation.
- **Polices auto-hébergées** en woff2 dans `fonts/` (pas de Google Fonts au runtime, sinon pas d'offline) : Bricolage Grotesque (titres), IBM Plex Sans (UI), IBM Plex Mono (tablatures).
- **Stockage** : `localStorage`, une seule clé `souffle:data` contenant `{version, chansons, reglages}`. Le volume est minuscule. Au premier lancement, si la clé est vide, charger `seed-songs.json`.
- **Méta iOS** : `apple-touch-icon` 180×180, `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style` = `black-translucent`, `viewport-fit=cover`, marges `env(safe-area-inset-*)` partout (encoche en paysage incluse), `theme-color` clair et sombre.

## 2. Modèle de données

```json
{
  "version": 1,
  "chansons": [ { "...chanson..." } ],
  "reglages": { "theme": "auto", "taille": "M", "paroles": true, "ecranActif": true }
}
```

Une chanson :

| Champ | Type | Rôle |
|---|---|---|
| `id` | string (slug) | Clé unique, sert au merge à l'import |
| `titre`, `artiste` | string | |
| `harmonica` | string | Tonalité de l'harmonica (`C`, `G`…) |
| `statut` | `a_apprendre` \| `en_cours` \| `maitrisee` | |
| `phrases` | `{id: "tab"}` | Une phrase musicale = suite de notes séparées par des espaces |
| `sections` | `{nom: [idPhrase…]}` | Ex. `couplet`, `refrain` |
| `structure` | `[nomSection…]` | Ordre de jeu complet |
| `paroles` | `{nomSection: [entrée…]}` | Une entrée par occurrence de la section (voir règles) |
| `paroles_phrase` | `{idPhrase: "texte"}` | Paroles fixes d'une phrase, prioritaires |
| `youtube` | `[{titre, url}]` | |
| `spotify` | `[url]` | |
| `notes` | string | Texte libre |

**Notation des notes** : `+N` souffle, `-N` aspiration, N de 1 à 10. Bends : `'` par demi-ton (`-3'`, `-3''`). Overblow/overdraw : `o` en suffixe (`+6o`). Tout token non reconnu est affiché tel quel, sans planter.

**Règles de rendu des paroles** (pour la k-ième occurrence d'une section dans `structure`) :
1. Si `paroles_phrase[idPhrase]` existe, il gagne.
2. Sinon, prendre l'entrée `paroles[section][k % longueur]`.
3. Si l'entrée est une **liste**, sa i-ème ligne va sous la i-ème phrase de la section.
4. Si l'entrée est une **chaîne**, elle va sous chaque phrase de la section (cas Drunken Sailor).
5. Pas de paroles : on n'affiche rien, la tablature reste seule.

## 3. Écrans et fonctionnalités

### Liste (écran d'accueil)
- Titre « Souffle », tonalité + nombre de chansons.
- Recherche instantanée sur titre et artiste, insensible aux accents et à la casse.
- Filtres par statut avec compteurs.
- Carte par chanson : titre, artiste, résumé de structure (« 3 couplets + refrain »), badge tonalité, aperçu des 8 premières notes colorées, statut.
- Tri alphabétique.
- Boutons : thème (soleil/lune) et accès Bibliothèque.

### Lecteur
- En-tête : retour, titre, artiste, tonalité, bascule thème.
- Barre d'outils : Paroles on/off, taille du texte (S/M/L, cycle), Écran actif on/off, défilement auto.
- Corps : déroule `structure` en entier, section par section, avec label (« Couplet 2 », « Refrain »). Les phrases sont rendues en blocs de notes qui **reviennent à la ligne selon la largeur** (aucun retour à la ligne codé en dur).
- **Paysage** : deux colonnes quand la largeur le permet (≥ 700 px), police plus grande, label d'id de phrase discret à gauche.
- **Option « structure compacte »** (paroles off) : n'afficher chaque section qu'une fois au lieu de dérouler toute la structure.
- **Défilement auto** : vitesse réglable (3 crans), pause au toucher.
- Barre basse : boutons Tuto vidéo / Écouter s'ils existent (ouvrent l'app YouTube/Spotify), sinon masqués. Plusieurs liens : petit menu.
- Changer le statut depuis le lecteur (menu « … »).
- Tous les réglages du lecteur sont **mémorisés globalement** dans `reglages`.

### Bibliothèque (réglages)
- **Import** : coller du JSON ou choisir un fichier `.json`. Accepte une chanson seule, une liste, ou l'objet complet. Validation avec messages clairs. Aperçu avant import (« 2 nouvelles, 1 mise à jour »). Merge par `id`, confirmation explicite avant d'écraser.
- **Export** : toutes les chansons en `souffle-AAAA-MM-JJ.json` via `navigator.share` (fichier), fallback téléchargement. Afficher la date du dernier export.
- **Apparence** : Auto / Sombre / Clair (Auto = `prefers-color-scheme`).
- Supprimer une chanson (avec confirmation).
- Pas d'éditeur de tablature en V1 : l'édition passe par Claude puis réimport.

### Écran actif
- Screen Wake Lock API (`navigator.wakeLock.request('screen')`), demandé à l'ouverture du lecteur si le réglage est actif.
- Le ré-acquérir sur `visibilitychange` (iOS le relâche en arrière-plan).
- Fallback si l'API échoue ou n'existe pas : vidéo muette minuscule en boucle (technique NoSleep), lancée au premier toucher.
- Relâcher en quittant le lecteur.

## 4. Design

Look sobre, pensé pour jouer harmonica en main : grosses cibles tactiles (≥ 44 px), contraste fort, aucune animation superflue.

| Token | Sombre | Clair |
|---|---|---|
| fond | `#121418` | `#F6F3EE` |
| carte | `#1C1F25` | `#FFFFFF` |
| trait | `#2A2E36` | `#E2DDD5` |
| texte | `#EDE8E0` | `#1B1D21` |
| texte secondaire | `#9BA1AB` | `#5F6670` |
| **aspiration (`-`)** | `#F0A04B`, gras | `#B4560F`, gras |
| **souffle (`+`)** | `#BFD3EA` | `#2F5D8A` |

- Tablatures en IBM Plex Mono, tailles S/M/L = 17/20/24 px en portrait, ×1,15 en paysage.
- Paroles en italique, couleur secondaire, sous leur phrase.
- Le signe `+`/`-` reste toujours affiché (la couleur ne doit pas être le seul indice).
- Variables CSS pour les deux thèmes, basculées via `data-theme` sur `<html>`.

## 5. Hors périmètre V1

Éditeur de tablature in-app, import d'image avec OCR/IA, synchronisation multi-appareils, audio/métronome, transposition entre tonalités, partage.

## 6. Critères d'acceptation

- Installable sur iPhone depuis Safari, s'ouvre en plein écran avec son icône.
- Fonctionne en mode avion après une première ouverture.
- Les 4 chansons du seed s'affichent correctement, y compris Drunken Sailor (paroles en chaîne + `paroles_phrase`) et Flower of Scotland (pas de refrain).
- Rotation portrait ↔ paysage sans rechargement ni perte de position.
- L'écran ne se met pas en veille pendant 10 min sur le lecteur avec Écran actif activé.
- Export puis réimport du fichier = bibliothèque identique.
- Lighthouse PWA sans erreur bloquante.

## 7. Déroulé suggéré

1. Squelette PWA + manifest + service worker + déploiement GitHub Pages, testé sur iPhone dès ce stade.
2. Modèle de données, chargement du seed, liste.
3. Lecteur portrait (moteur de rendu structure + paroles).
4. Paysage, tailles, thèmes.
5. Écran actif + défilement auto.
6. Import/export.
7. Icône et finitions.
