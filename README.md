# Mes tâches — TP Docker multi-stage

Application web de gestion de tâches (React + Vite), compilée dans une image Docker
**multi-stage** où Nginx sert uniquement les fichiers statiques produits par la compilation.

Dépôt GitHub : <https://github.com/benoitvincent013-ship-it/TP-Docker-Multi-Stage>

---

## Sommaire

1. [L'application](#1-lapplication)
2. [Technologies](#2-technologies)
3. [Prérequis](#3-prérequis)
4. [Structure du projet](#4-structure-du-projet)
5. [Le Dockerfile multi-stage](#5-le-dockerfile-multi-stage)
6. [Construire l'image](#6-construire-limage)
7. [Lancer le conteneur](#7-lancer-le-conteneur)
8. [Accéder à l'application](#8-accéder-à-lapplication)
9. [Tester](#9-tester)
10. [Arrêter et supprimer](#10-arrêter-et-supprimer)
11. [Résultats des tests effectués](#11-résultats-des-tests-effectués)
12. [Captures](#12-captures)
13. [Développement hors Docker (facultatif)](#13-développement-hors-docker-facultatif)
14. [Versionnement](#14-versionnement)

---

## 1. L'application

« Mes tâches » est une application monopage qui permet de :

- ajouter une tâche (champ de saisie + bouton « Ajouter », ou touche Entrée) ;
- cocher une tâche comme terminée (texte barré, barre de progression et compteurs mis à jour) ;
- supprimer une tâche ;
- filtrer la liste : **Toutes / À faire / Terminées** ;
- effacer d'un coup toutes les tâches terminées ;
- conserver les tâches après fermeture du navigateur (`localStorage`).

La page ne contient que l'application : aucune section de validation ne s'affiche sous la
liste. Les contrôles du TP (image, conteneur, fichiers servis) sont tous documentés dans ce
README, dans les sections suivantes et dans le script `verifier-readme.ps1`.

L'application est entièrement statique : aucune API, aucune base de données.

[↑ Retour au sommaire](#sommaire)

## 2. Technologies

| Technologie | Version | Rôle |
|---|---|---|
| React | 18.3.1 | Interface (composants, état, hooks) |
| Vite | 5.4.21 | Compilation en fichiers statiques (`dist/`) |
| Node.js | 22 Alpine | Étape de compilation uniquement |
| Nginx | 1.27 Alpine | Étape finale : serveur de fichiers statiques |
| Docker | Docker Desktop | Construction et exécution de l'image |

Pourquoi React + Vite : c'est le choix le plus simple (deux dépendances, aucune configuration
de serveur, `npm run build` produit directement un dossier statique).

[↑ Retour au sommaire](#sommaire)

## 3. Prérequis

- Windows 11 avec **Docker Desktop** démarré.
- **PowerShell** (ou le terminal de VS Code).
- Internet pour le premier build (téléchargement des images `node` et `nginx`).
- _Facultatif_ : Node.js 22 pour lancer l'application hors Docker.

```powershell
docker --version
```

[↑ Retour au sommaire](#sommaire)

## 4. Structure du projet

```text
TP-Docker-Multi-Stage/
├── captures/                       # Preuves de fonctionnement
│   ├── 00-generation-package-lock.txt
│   ├── 01-build-image.txt
│   ├── 02-demarrage-conteneur.txt
│   ├── 03-test-http-headers.txt
│   ├── 04-test-http-body.html
│   ├── 05-verification-image-finale.txt
│   ├── 06-application-navigateur.png
│   ├── 07-verification-depot-github.txt
│   └── 08-verification-readme.txt
├── nginx/
│   └── default.conf                # Configuration du serveur (gzip, cache, fallback)
├── public/
│   └── favicon.svg
├── src/
│   ├── components/
│   │   ├── TaskForm.jsx            # Formulaire d'ajout
│   │   ├── TaskItem.jsx            # Une tâche (case, libellé, suppression)
│   │   └── TaskList.jsx            # Liste + état vide
│   ├── App.jsx                     # État, filtres, progression, sauvegarde locale
│   ├── main.jsx                    # Point d'entrée React
│   └── styles.css
├── .dockerignore
├── .gitignore
├── Dockerfile
├── index.html
├── package.json
├── package-lock.json
├── reconstruire.ps1               # Rebuild + recréation du conteneur + vérification
├── verifier-readme.ps1            # Compare les chiffres du README au conteneur en marche
└── vite.config.js
```

[↑ Retour au sommaire](#sommaire)

## 5. Le Dockerfile multi-stage

```dockerfile
FROM node:22-alpine AS builder

WORKDIR /app

# On copie d'abord les manifestes : la couche "npm ci" reste en cache
# tant que les dépendances ne changent pas.
COPY package.json package-lock.json ./
RUN npm ci

# On copie ensuite les sources et on compile.
COPY . .
RUN npm run build

FROM nginx:1.27-alpine AS runtime

# Configuration Nginx dédiée (gzip, cache, en-têtes, fallback SPA)
COPY nginx/default.conf /etc/nginx/conf.d/default.conf

# On supprime les pages par défaut de Nginx (index.html, 50x.html)
RUN rm -rf /usr/share/nginx/html/*

# On récupère UNIQUEMENT le dossier compilé depuis l'étape de build.
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q --spider http://127.0.0.1/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
```

- L'étape 1 (`AS builder`) installe les dépendances et compile : elle contient Node,
  `node_modules` et les sources.
- L'étape 2 repart d'une image Nginx vierge et ne récupère que le dossier `dist/`
  grâce à `COPY --from=builder`. Elle ne contient donc ni Node, ni `npm`, ni
  `node_modules`, ni code source.
- Le `.dockerignore` exclut `node_modules`, `dist`, `.git`, `captures/` et les fichiers `.env`
  du contexte de build.

[↑ Retour au sommaire](#sommaire)

## 6. Construire l'image

```powershell
cd TP-Docker-Multi-Stage
docker build -t mon-app-multistage:1.0 .
```

Tout en une seule commande (rebuild + recréation du conteneur + contrôle du README) :

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\reconstruire.ps1
```

`reconstruire.ps1` reconstruit l'image, supprime puis recrée `mon-app` sur le port 8080,
attend l'état `healthy` (60 s au maximum, journal affiché en cas d'échec) et lance ensuite
`verifier-readme.ps1` (qui réécrit la preuve `captures/08-verification-readme.txt`). Code de
sortie : `0` si tout est à jour, `1` s'il reste des écarts,
le code d'erreur de Docker si le build ou le run échoue (le conteneur existant est alors
laissé intact).

[↑ Retour au sommaire](#sommaire)

## 7. Lancer le conteneur

```powershell
docker run -d --name mon-app -p 8080:80 mon-app-multistage:1.0
```

`-p 8080:80` publie le port 80 du conteneur sur le port 8080 de la machine.
Ces deux noms (`mon-app-multistage:1.0` et `mon-app`) sont ceux utilisés dans toutes
les commandes de ce README et dans les captures du dossier `captures/`.

[↑ Retour au sommaire](#sommaire)

## 8. Accéder à l'application

**<http://localhost:8080>**

[↑ Retour au sommaire](#sommaire)

## 9. Tester

```powershell
# Le conteneur tourne et est "healthy"
docker ps

# Réponse HTTP du serveur
curl.exe -I http://localhost:8080

# Code de retour
(Invoke-WebRequest -Uri http://localhost:8080 -UseBasicParsing).StatusCode

# Fichiers statiques présents dans l'image finale
docker exec mon-app ls -la /usr/share/nginx/html

# Ni Node ni node_modules dans l'image finale
docker exec mon-app sh -c "command -v node || echo 'node absent'"
docker exec mon-app sh -c "find / -maxdepth 5 -type d -name node_modules"

# Taille de l'image
docker images mon-app-multistage:1.0

# Tout vérifier d'un coup face au README
powershell -NoProfile -ExecutionPolicy Bypass -File .\verifier-readme.ps1
```

`verifier-readme.ps1` relit le README, interroge le conteneur `mon-app` en marche et compare
la taille de l'image, le code HTTP, le `Content-Length`, la version de Nginx, puis les noms et
les tailles des fichiers servis. Chaque ligne s'affiche en `[OK]` ou `[ECART]` ; le script sort
avec le code `1` dès qu'un chiffre est périmé (et `2` si le conteneur est arrêté). Pratique
juste après un rebuild : `docker build … ; powershell -File .\verifier-readme.ps1`.

L'option `-Capture captures\08-verification-readme.txt` enregistre le rapport dans `captures/`
(c'est le fichier de preuve versionné) :

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\verifier-readme.ps1 -Capture captures\08-verification-readme.txt
```

`reconstruire.ps1` le fait automatiquement : chaque rebuild régénère
`captures/08-verification-readme.txt`.

[↑ Retour au sommaire](#sommaire)

## 10. Arrêter et supprimer

```powershell
docker stop mon-app              # arrêter
docker start mon-app             # redémarrer
docker rm -f mon-app             # supprimer le conteneur
docker rmi mon-app-multistage:1.0 # supprimer l'image
```

[↑ Retour au sommaire](#sommaire)

## 11. Résultats des tests effectués

Tests réalisés le 23/11/2026 sur Windows 11 avec Docker Desktop.

| Test | Résultat |
|---|---|
| `npm ci` (étape de build) | 63 paquets installés |
| `npm run build` (Vite) | compilation sans erreur, dossier `dist/` généré |
| `docker build -t mon-app-multistage:1.0 .` | code de sortie `0`, image créée |
| Taille de l'image finale | **73,9 Mo** |
| `docker ps` | `mon-app` — `Up (healthy)`, `0.0.0.0:8080->80/tcp` |
| `curl.exe -I http://localhost:8080` | `HTTP/1.1 200 OK`, `Server: nginx/1.27.5`, `Content-Length: 677` |
| Temps de réponse | `0.0056 s` (mesure locale `curl.exe` sur `http://localhost:8080`) |
| Contenu de l'image finale | `index.html` (677 o), `assets/index-B4YCcKX5.css` (3 717 o), `assets/index-DLpFjz_Q.js` (146 609 o), `favicon.svg` (249 o) |
| Absence de `node`, `npm`, `node_modules`, `/app` | confirmée |
| Fonctionnement des tâches | ajout, coche (progression 33 %), filtre « Terminées », persistance après rechargement |
| Page servie | uniquement l'application : aucune section « Checklist de validation » ni texte de présentation sous la liste |
| Rebuild complet (`docker build --no-cache`) | code de sortie `0` : `npm ci` (63 paquets), `vite build` (36 modules), image réexportée |
| Console navigateur | aucune erreur |

[↑ Retour au sommaire](#sommaire)

## 12. Captures

| Fichier | Contenu |
|---|---|
| `captures/00-generation-package-lock.txt` | Génération du `package-lock.json` (image `node:22-alpine` téléchargée) |
| `captures/01-build-image.txt` | Sortie réelle de `docker build` |
| `captures/02-demarrage-conteneur.txt` | Démarrage et état du conteneur |
| `captures/03-test-http-headers.txt` | En-têtes HTTP renvoyés par Nginx |
| `captures/04-test-http-body.html` | HTML servi par le conteneur |
| `captures/05-verification-image-finale.txt` | Fichiers statiques présents, absence de Node/`node_modules`, taille |
| `captures/06-application-navigateur.png` | L'application servie par le conteneur (capture 2560 × 1280), sans aucune section de validation sous la liste |
| `captures/07-verification-depot-github.txt` | Vérification du dépôt public (codes HTTP) |
| `captures/08-verification-readme.txt` | Sortie réelle de `verifier-readme.ps1` : les 8 contrôles README / conteneur, tous en `[OK]` |

### Application

![Application Mes tâches servie par le conteneur](captures/06-application-navigateur.png)

[↑ Retour au sommaire](#sommaire)

## 13. Développement hors Docker (facultatif)

```powershell
npm install
npm run dev   # http://localhost:5173
```

[↑ Retour au sommaire](#sommaire)

## 14. Versionnement

Le dépôt contient les sources, le `Dockerfile`, la configuration Nginx, le README et les
captures. Ne sont **pas** versionnés : `node_modules/`, `dist/`, `.env`, fichiers de l'éditeur.
Aucun secret n'est présent dans le projet.

[↑ Retour au sommaire](#sommaire)
