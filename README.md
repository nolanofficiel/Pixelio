# Pixelio

Galerie d'images privée, auto-hébergée, en Node.js. Chaque compte possède son propre espace : dépôt par glisser-déposer, groupes (dossiers), recherche instantanée, visionneuse plein écran et partage d'une image par lien public révocable.

![Node.js](https://img.shields.io/badge/Node.js-%E2%89%A520-3c873a)
![MySQL](https://img.shields.io/badge/MySQL%20%2F%20MariaDB-8%2B-4479a1)
![Licence MIT](https://img.shields.io/badge/licence-MIT-4b7bff)

---

## Sommaire

- [Fonctionnalités](#fonctionnalités)
- [Prérequis](#prérequis)
- [Installation](#installation)
- [Configuration (`.env`)](#configuration-env)
- [Base de données](#base-de-données)
- [Démarrage](#démarrage)
- [Utilisation](#utilisation)
- [API HTTP](#api-http)
- [Sécurité](#sécurité)
- [Structure du projet](#structure-du-projet)
- [Dépannage](#dépannage)
- [Licence](#licence)

---

## Fonctionnalités

- **Comptes** : inscription avec nom d'utilisateur et mot de passe (double saisie, bouton « voir le mot de passe »), connexion, déconnexion.
- **Galerie privée** : dépôt par glisser-déposer ou sélection, jusqu'à 20 fichiers par envoi, 20 Mo par fichier (JPEG, PNG, WebP, GIF, AVIF), barre de progression réelle.
- **Groupes** : création, renommage, suppression ; dépôt direct dans le groupe affiché ; déplacement d'une image d'un groupe à l'autre.
- **Recherche instantanée** sur le nom des images, sans rechargement.
- **Visionneuse** plein écran (flèches, Échap), suppression définitive.
- **Partage par lien** : un jeton aléatoire par image, page publique en lecture seule, téléchargement, révocation immédiate depuis la galerie ou depuis la liste « Partages actifs ».
- **Isolation stricte** : chaque requête vérifie que l'image ou le groupe appartient au compte connecté.

## Prérequis

| Outil | Version conseillée |
| --- | --- |
| Node.js | 20 ou plus récent (testé sur Node 24, ESM) |
| MySQL ou MariaDB | 5.7+ / 10.4+ (XAMPP, WAMP, MAMP ou serveur dédié) |

Aucun service externe, aucun CDN pour les données : tout tourne sur votre machine.

## Installation

```bash
git clone https://github.com/nolanofficiel/Pixelio.git
cd Pixelio
npm install
cp .env.example .env      # Windows (cmd) : copy .env.example .env
```

Ouvrez ensuite `.env` et ajustez les identifiants MySQL.

## Configuration (`.env`)

Le fichier `.env` n'est **jamais** versionné (voir `.gitignore`) : seul `.env.example` sert de modèle.

| Variable | Défaut | Rôle |
| --- | --- | --- |
| `DB_HOST` | `127.0.0.1` | Hôte MySQL |
| `DB_PORT` | `3306` | Port MySQL |
| `DB_USER` | `root` | Utilisateur MySQL |
| `DB_PASSWORD` | *(vide)* | Mot de passe MySQL (vide sous XAMPP par défaut) |
| `DB_NAME` | `vault_images` | Nom de la base (créée automatiquement) |
| `PORT` | `3000` | Port HTTP de l'application |
| `HOST` | `127.0.0.1` | Interface d'écoute ; `0.0.0.0` pour exposer le réseau local |
| `NODE_ENV` | *(non défini)* | `production` active le cookie `Secure` (nécessite HTTPS) |

## Base de données

Aucune manipulation SQL n'est nécessaire : au démarrage, l'application crée la base si besoin, puis les tables `users`, `sessions`, `image_groups`, `images` et `shares`, ainsi que les colonnes ajoutées par les mises à jour (`images.group_id`).

Pour préparer la base sans lancer le serveur :

```bash
npm run db:init
```

L'utilisateur MySQL doit avoir le droit `CREATE DATABASE`. Sous XAMPP, démarrez **MySQL** depuis le panneau de contrôle (identifiants par défaut : `root`, sans mot de passe).

## Démarrage

```bash
npm start        # production / usage normal
npm run dev      # rechargement automatique à chaque modification
```

Le terminal affiche :

```
Pixelio prêt sur http://127.0.0.1:3000 (Node v24.x.x)
```

Ouvrez cette adresse, créez un compte depuis **Créer un compte**, puis déposez vos images.

## Utilisation

1. **Créer un compte** : pseudo de 3 à 24 caractères (`A-Z a-z 0-9 . _ -`), mot de passe de 8 caractères minimum, saisi deux fois.
2. **Ajouter des images** : glissez vos fichiers dans la zone de dépôt (ou cliquez dessus). La progression s'affiche, puis la galerie se met à jour.
3. **Trier** : bouton `+` à côté de « Groupes » pour créer un dossier. Quand un groupe est sélectionné, les nouveaux envois y vont directement ; dans la visionneuse, le menu **Groupe** déplace une image existante (ou la remet dans « Non classées »). Supprimer un groupe ne supprime jamais les images.
4. **Partager** : bouton de partage sur une vignette ou dans la visionneuse → un lien du type `http://127.0.0.1:3000/s/<jeton>` est copiable. La page publique est en lecture seule, sans compte, et propose le téléchargement.
5. **Révoquer** : « Arrêter le partage » dans la modale, ou la section **Partages actifs** de la barre latérale, qui liste tous les liens en cours avec leur date et un bouton **Révoquer**. Le lien cesse de fonctionner immédiatement.
6. **Supprimer** : la corbeille sur une vignette efface la ligne en base et le fichier sur le disque.

## API HTTP

Toutes les routes `/api/*` (sauf `/api/auth/register` et `/api/auth/login`) exigent une session valide et répondent `401` sinon.

| Méthode | Route | Description |
| --- | --- | --- |
| `POST` | `/api/auth/register` | Créer un compte (`username`, `password`, `confirm`) |
| `POST` | `/api/auth/login` | Connexion (`username`, `password`) |
| `POST` | `/api/auth/logout` | Fermer la session |
| `GET` | `/api/auth/me` | Compte connecté |
| `GET` | `/api/images` | Lister ses images (avec `group_id` et `share`) |
| `POST` | `/api/images` | Envoyer des images (`files[]`, `groupId` facultatif) |
| `PATCH` | `/api/images/:id/group` | Déplacer une image (`groupId` ou `null`) |
| `POST` | `/api/images/:id/share` | Créer/renvoyer le lien de partage |
| `DELETE` | `/api/images/:id/share` | Désactiver le partage |
| `GET` | `/api/images/:id/file` | Fichier privé du propriétaire |
| `DELETE` | `/api/images/:id` | Supprimer une image |
| `GET` | `/api/groups` | Lister ses groupes et leur nombre d'images |
| `POST` | `/api/groups` | Créer un groupe (`name`, 1–40 caractères) |
| `PATCH` | `/api/groups/:id` | Renommer un groupe |
| `DELETE` | `/api/groups/:id` | Supprimer un groupe (images → non classées) |
| `GET` | `/api/shares` | Lister les liens actifs |
| `DELETE` | `/api/shares/:token` | Révoquer un lien |

Routes publiques : `GET /s/:token` (page de partage) et `GET /s/:token/file` (`?download=1` pour forcer le téléchargement).

## Sécurité

- Mots de passe hachés avec **scrypt** (sel aléatoire de 16 octets, paramètres stockés dans l'empreinte).
- Sessions stockées en base (`sessions.token_hash`, SHA-256 du cookie) ; cookie `HttpOnly`, `SameSite=Lax`, expiration 7 jours.
- Fichiers rangés hors du dossier public (`storage/<id>/...`) et servis uniquement après vérification du propriétaire.
- Signature réelle du fichier contrôlée (magic bytes) en plus du type MIME annoncé.
- Limitation à 10 tentatives de connexion par IP et par tranche de 5 minutes.
- Jetons de partage de 128 bits, révocables, page `noindex` / `no-referrer`.
- `.env` et `storage/` sont ignorés par Git.

## Structure du projet

```
Pixelio/
├── src/
│   ├── server.js          # Express : pages, assets, montage des routes
│   ├── db.js              # pool MySQL, création base/tables, migrations
│   ├── auth.js            # scrypt, sessions, cookie, garde d'authentification
│   ├── share-page.js      # rendu HTML des pages publiques de partage
│   ├── init-db.js         # script npm run db:init
│   └── routes/
│       ├── auth.js        # inscription / connexion / déconnexion
│       ├── images.js      # envoi, liste, déplacement, partage, suppression
│       ├── groups.js      # groupes (dossiers)
│       ├── share.js       # pages publiques /s/:token
│       └── shares.js      # liste et révocation des liens actifs
├── private/               # pages HTML servies par Express
│   ├── home.html
│   ├── login.html
│   ├── register.html
│   └── app.html
├── public/assets/         # CSS, JS client, images, favicon
├── storage/               # images envoyées (ignoré par Git)
├── .env.example
└── package.json
```

## Dépannage

| Symptôme | Piste |
| --- | --- |
| `Connexion à MySQL impossible` | MySQL n'est pas démarré, ou `DB_USER` / `DB_PASSWORD` sont erronés dans `.env`. |
| `ER_ACCESS_DENIED_ERROR` | Le compte MySQL n'a pas les droits, ou un mot de passe est requis. |
| Page qui semble ancienne | Les assets sont versionnés (`?v=7`) ; forcez un rechargement (`Ctrl+F5`). |
| Le cookie ne persiste pas en production | `NODE_ENV=production` impose HTTPS ; servez le site derrière un reverse proxy TLS. |
| Accès depuis un autre appareil | Mettez `HOST=0.0.0.0` et autorisez le port 3000 dans le pare-feu. |
| Sauvegarde | Copiez le dossier `storage/` et exportez la base (`mysqldump vault_images`). |

---

## Licence

Ce projet est publié sous licence **MIT** : voir le fichier [LICENSE](LICENSE). Vous pouvez l'utiliser, le modifier, le redistribuer et le vendre librement, à condition de conserver la mention de copyright et le texte de la licence.

Le code source est couvert par cette licence ; le logo **Pixelio** (`public/assets/img/pixelio-logo.webp`, `public/assets/img/pixelio-mark.webp`) reste la marque de son auteur et ne peut pas être réutilisé comme identité d'un autre produit.
