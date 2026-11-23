# TP Docker — Image multi-stage

> **TP Docker multi-stage** : application web React compilée par Node, puis servie par Nginx
> depuis une image finale légère (sans Node, sans `node_modules`).

Dépôt GitHub public : <https://github.com/benoitvincent013-ship-it/TP-Docker-Multi-Stage>

---

## 1. Présentation

Ce TP réalise les quatre étapes demandées :

| Étape | Contenu | Résultat |
|-------|---------|----------|
| 1. Créer | Application web simple dont le build produit des fichiers statiques | React + Vite → dossier `dist/` |
| 2. Construire | Image Docker **multi-stage** : une étape compile, l'étape finale sert les artefacts | `Dockerfile` à 2 étapes + `nginx:1.27-alpine` |
| 3. Tester | Démarrer un conteneur et constater que l'application répond | `HTTP/1.1 200 OK` sur <http://localhost:8080> |
| 4. Versionner | Sources, Dockerfile et README sur un dépôt GitHub public | Dépôt public, sans `node_modules` ni secret |

---

## 2. Objectifs pédagogiques

À la fin de ce TP, on sait :

- créer une application web dont la compilation génère des fichiers **statiques** ;
- écrire un `Dockerfile` **multi-stage** avec deux `FROM` et un `COPY --from=…` ;
- expliquer pourquoi l'image finale ne contient ni Node, ni `node_modules`, ni code source ;
- construire une image, lancer un conteneur, publier un port et vérifier la réponse HTTP ;
- limiter le contexte de build avec un `.dockerignore` ;
- versionner un projet Docker sur GitHub sans y mettre de dépendances ni de secrets.

---

## 3. Technologies utilisées

| Outil | Version | Rôle |
|-------|---------|------|
| React | 18.3.1 | Interface web (composants) |
| Vite | 5.4.21 | Compilation vers des fichiers statiques (`dist/`) |
| Node.js | 22 (image Alpine) | Étape de *build* uniquement |
| Nginx | 1.27 Alpine | Étape finale : serveur de fichiers statiques |
| Docker | Docker Desktop (Windows 11) | Construction et exécution de l'image |

**Pourquoi React + Vite ?** C'est la solution la plus simple parmi Angular / React / Vue :
pas de CLI lourde, un `package.json` de 2 dépendances, une commande `npm run build`
qui produit un dossier `dist/` prêt à être servi. Angular est plus complexe à configurer
et propose du SSR qu'il faut désactiver.

---

## 4. Prérequis

- **Windows 11** (ou 10) avec **Docker Desktop** installé et démarré.
- **PowerShell** (ou le terminal de VS Code).
- Une connexion Internet pour le premier build (téléchargement des images `node` et `nginx`).
- _Facultatif_ : Node.js 22 en local, uniquement pour lancer `npm run dev` hors Docker.

Vérification dans PowerShell :

```powershell
docker --version
docker info
```

---

## 5. Arborescence du projet

```text
TP-Docker-Multi-Stage/
├── captures/                  # Preuves de fonctionnement (logs + capture d'écran)
│   ├── 00-generation-package-lock.txt
│   ├── 01-build-image.txt
│   ├── 02-demarrage-conteneur.txt
│   ├── 03-test-http-headers.txt
│   ├── 04-test-http-body.html
│   ├── 05-verification-image-finale.txt
│   └── 06-application-navigateur.png
├── nginx/
│   └── default.conf           # Configuration du serveur Nginx (gzip, cache, fallback)
├── public/
│   └── favicon.svg            # Copié tel quel dans dist/
├── src/
│   ├── App.jsx                # Interface de l'application
│   ├── main.jsx               # Point d'entrée React
│   └── styles.css             # Styles
├── .dockerignore              # Fichiers exclus du contexte de build
├── .gitignore                 # Fichiers exclus de Git
├── Dockerfile                 # Image multi-stage (build + runtime)
├── index.html                 # Page HTML de Vite
├── package.json               # Dépendances et scripts
├── package-lock.json          # Versions exactes (utilisé par npm ci)
├── README.md                  # Ce fichier
└── vite.config.js             # Configuration Vite
```

> `node_modules/` et `dist/` n'apparaissent pas : ils sont générés et ignorés par Git
> (`.gitignore`) comme par Docker (`.dockerignore`).

---

## 6. Comment fonctionne le multi-stage ?

Un `Dockerfile` multi-stage contient **plusieurs instructions `FROM`**. Chacune démarre
une image intermédiaire ; seule la dernière est conservée dans l'image finale.

```text
            ┌──────────────────────────────┐
            │  ÉTAPE 1 : build             │
            │  node:22-alpine              │
            │  npm ci  →  npm run build     │
            │  produit /app/dist           │
            └──────────────┬───────────────┘
                           │  COPY --from=build /app/dist
                           ▼
            ┌──────────────────────────────┐
            │  ÉTAPE 2 : runtime           │
            │  nginx:1.27-alpine           │
            │  /usr/share/nginx/html       │
            │  ≈ 74 Mo, sans Node          │
            └──────────────────────────────┘
```

**Ce que cela change concrètement :**

- L'image finale ne contient **que** Nginx et les fichiers compilés (≈ 184 ko de contenu applicatif).
- `node_modules` (63 paquets, plusieurs centaines de Mo) reste dans l'étape 1, qui est jetée.
- Les vulnérabilités des outils de *build* ne partent pas en production
  (`npm audit --omit=dev` → **0 vulnérabilité**).
- L'image est plus petite, plus rapide à télécharger et expose moins de surface d'attaque :
  pas de compilateur, pas de shell applicatif, pas de code source.

---

## 7. Explication du Dockerfile

```dockerfile
# ---------- ÉTAPE 1 : BUILD ----------
FROM node:22-alpine AS build
WORKDIR /app

# Les manifestes sont copiés seuls en premier : la couche "npm ci"
# reste en cache tant que les dépendances ne changent pas.
COPY package.json package-lock.json ./
RUN npm ci

# Puis les sources, et la compilation.
COPY . .
RUN npm run build

# ---------- ÉTAPE 2 : RUNTIME ----------
FROM nginx:1.27-alpine AS runtime

COPY nginx/default.conf /etc/nginx/conf.d/default.conf

# Suppression des pages par défaut de Nginx
RUN rm -rf /usr/share/nginx/html/*

# On ne copie QUE le dossier compilé de l'étape 1.
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q --spider http://127.0.0.1/ || exit 1
CMD ["nginx", "-g", "daemon off;"]
```

| Instruction | Explication simple |
|-------------|--------------------|
| `FROM node:22-alpine AS build` | Démarre l'étape nommée `build`, avec Node 22 sur Alpine (image légère). |
| `WORKDIR /app` | Tous les fichiers de cette étape vont dans `/app`. |
| `COPY package*.json ./` | Copie seulement les listes de dépendances pour profiter du cache Docker. |
| `npm ci` | Installe exactement les versions de `package-lock.json` (plus fiable que `npm install`). |
| `COPY . .` | Copie les sources (filtrées par `.dockerignore`). |
| `npm run build` | Lance Vite : génère `dist/index.html`, `dist/assets/*.js`, `*.css`. |
| `FROM nginx:1.27-alpine AS runtime` | Démarre une **nouvelle** étape, propre, sans Node. |
| `COPY nginx/default.conf …` | Remplace la configuration Nginx par la nôtre. |
| `RUN rm -rf /usr/share/nginx/html/*` | Retire les pages par défaut de Nginx pour ne garder que l'application. |
| `COPY --from=build /app/dist …` | Copie le résultat de l'étape 1 dans le dossier servi par Nginx. |
| `EXPOSE 80` | Documente le port interne du conteneur. |
| `HEALTHCHECK …` | Docker teste toutes les 30 s que le serveur répond ; le conteneur devient `healthy`. |
| `CMD ["nginx", "-g", "daemon off;"]` | Lance Nginx au premier plan (obligatoire pour un conteneur). |

**Le fichier `.dockerignore`** évite d'envoyer `node_modules`, `dist`, `.git`, `captures/` et
les fichiers `.env` au moteur Docker : contexte plus léger, build plus rapide, aucun secret
transmis par erreur.

---

## 8. Commandes de construction (PowerShell)

Se placer dans le dossier du projet, puis :

```powershell
cd TP-Docker-Multi-Stage
docker build -t tp-docker-multi-stage .
```

Avec la sortie détaillée (utile en cas d'erreur) :

```powershell
docker build --progress=plain -t tp-docker-multi-stage .
```

Vérifier que l'image existe :

```powershell
docker images tp-docker-multi-stage
```

---

## 9. Commandes de lancement (PowerShell)

```powershell
docker run -d --name tp-docker -p 8080:80 --restart unless-stopped tp-docker-multi-stage
```

| Option | Rôle |
|--------|------|
| `-d` | Démarre le conteneur en arrière-plan. |
| `--name tp-docker` | Donne un nom au conteneur (plus simple que son identifiant). |
| `-p 8080:80` | Port **8080 du PC** → port **80 du conteneur**. |
| `--restart unless-stopped` | Redémarre le conteneur au démarrage de Docker Desktop. |

Vérifier que le conteneur tourne :

```powershell
docker ps
```

---

## 10. Accès à l'application

Ouvrir dans le navigateur :

**<http://localhost:8080>**

---

## 11. Commandes de vérification (PowerShell)

```powershell
# Le conteneur est démarré et marqué "healthy"
docker ps

# Test HTTP : les en-têtes de la réponse
curl.exe -I http://localhost:8080

# Test HTTP : code de retour
curl.exe -s -o NUL -w "%{http_code}`n" http://localhost:8080

# Les fichiers statiques présents dans l'image finale
docker exec tp-docker ls -laR /usr/share/nginx/html

# Vérifier qu'il n'y a ni Node ni node_modules dans l'image finale
docker exec tp-docker sh -c "command -v node || echo 'node absent'"
docker exec tp-docker sh -c "find / -maxdepth 5 -type d -name node_modules"

# Taille de l'image
docker images tp-docker-multi-stage

# Journaux de Nginx
docker logs tp-docker
```

---

## 12. Arrêter et supprimer

```powershell
# Arrêter le conteneur
docker stop tp-docker

# Redémarrer le conteneur arrêté
docker start tp-docker

# Supprimer le conteneur (arrêt + suppression)
docker rm -f tp-docker

# Supprimer l'image
docker rmi tp-docker-multi-stage

# Nettoyage complet (conteneurs arrêtés et images inutilisées)
docker system prune -a
```

---

## 13. Résultats des tests réellement effectués

Tests exécutés le **23/11/2026** sur Windows 11, Docker Desktop 29.9.3.

| # | Test | Commande | Résultat |
|---|------|----------|----------|
| 1 | Génération du `package-lock.json` | `npm install --package-lock-only` (image `node:22-alpine`) | ✅ `up to date in 44s`, fichier créé (56 649 octets) |
| 2 | Construction de l'image | `docker build -t tp-docker-multi-stage .` | ✅ code de sortie `0` — `naming to docker.io/library/tp-docker-multi-stage:latest done` |
| 3 | Installation dans l'étape de build | `RUN npm ci` | ✅ `added 63 packages, and audited 64 packages in 6s` |
| 4 | Compilation Vite | `RUN npm run build` | ✅ `31 modules transformed` — `dist/index.html 0.64 kB`, `dist/assets/index-*.css 3.43 kB`, `dist/assets/index-*.js 146.37 kB` (gzip 47.10 kB) |
| 5 | Taille de l'image finale | `docker images tp-docker-multi-stage` | ✅ **73.9 Mo** (contenu 21 Mo compressé) |
| 6 | Démarrage du conteneur | `docker run -d --name tp-docker -p 8080:80 …` | ✅ `Up 6 seconds (healthy)` — `0.0.0.0:8080->80/tcp` |
| 7 | Test HTTP — en-têtes | `curl.exe -I http://localhost:8080` | ✅ `HTTP/1.1 200 OK`, `Server: nginx/1.27.5`, `Content-Type: text/html`, `Content-Length: 637` |
| 8 | Test HTTP — code et délai | `curl.exe -s -o NUL -w "%{http_code}" …` | ✅ `code=200`, temps `0.0108 s` |
| 9 | Chargement d'un fichier statique | `curl.exe http://localhost:8080/assets/index-*.js` | ✅ `code=200`, `146 403` octets |
| 10 | Route inconnue (fallback SPA) | `curl.exe http://localhost:8080/route-inexistante` | ✅ `code=200` (renvoie `index.html`) |
| 11 | Contenu de l'image finale | `docker exec tp-docker ls -laR /usr/share/nginx/html` | ✅ seulement `index.html` (637 o), `assets/` (JS 146 403 o + CSS 3 434 o), `favicon.svg` (572 o) |
| 12 | `node` et `npm` absents de l'image finale | `docker exec … command -v node` / `npm` | ✅ `node ABSENT (OK)`, `npm ABSENT (OK)` |
| 13 | `node_modules` absent de l'image finale | `docker exec … find / -name node_modules` | ✅ aucune ligne trouvée |
| 14 | Sources absentes de l'image finale | `docker exec … ls /app` | ✅ `/app ABSENT (OK)` — les sources restent dans l'étape de build |
| 15 | Vulnérabilités des dépendances de production | `npm audit --omit=dev` | ✅ `found 0 vulnerabilities` |
| 16 | Santé du conteneur | `docker inspect … State.Health` | ✅ `etat=running sante=healthy` |
| 17 | Console du navigateur | ouverture de <http://localhost:8080> | ✅ aucune erreur console, aucune requête échouée |

> **Remarque honnête** : `npm audit` signale 1 vulnérabilité modérée et 1 haute dans **esbuild**,
> un outil utilisé uniquement par le serveur de développement de Vite (étape de *build*).
> Ces paquets **ne sont pas présents dans l'image finale** (`npm audit --omit=dev` → 0 vulnérabilité).

---

## 14. Preuves de fonctionnement (dossier `captures/`)

| Fichier | Contenu |
|---------|---------|
| `captures/01-build-image.txt` | Sortie réelle de `docker build` (étapes 1 et 2, cache, export de l'image) |
| `captures/02-demarrage-conteneur.txt` | Identifiant du conteneur + `docker ps` + état de santé |
| `captures/03-test-http-headers.txt` | En-têtes HTTP renvoyés par Nginx (`HTTP/1.1 200 OK`) |
| `captures/04-test-http-body.html` | Début du HTML réellement servi |
| `captures/05-verification-image-finale.txt` | Contenu de `/usr/share/nginx/html`, absence de `node`/`npm`/`node_modules`/`/app`, taille de l'image |
| `captures/06-application-navigateur.png` | Capture d'écran de l'application dans le navigateur (page servie par le conteneur) |
| `captures/00-generation-package-lock.txt` | Génération du `package-lock.json` utilisé par `npm ci` |

### Application dans le navigateur

![Application servie par le conteneur Docker](captures/06-application-navigateur.png)

---

## 15. Utilisation sans Docker (facultatif)

```powershell
npm install
npm run dev      # serveur de développement sur http://localhost:5173
```

Cette partie n'est pas nécessaire pour le TP : elle sert seulement à modifier l'interface.

---

## 16. Dépôt GitHub

- URL : <https://github.com/benoitvincent013-ship-it/TP-Docker-Multi-Stage>
- Visibilité : **public**
- Contenu versionné : sources, `Dockerfile`, `nginx/default.conf`, `README.md`, `captures/`
- Non versionné (`.gitignore`) : `node_modules/`, `dist/`, `.env`, fichiers de l'éditeur

---

## 17. Garde-fous respectés

- ✅ Aucun secret, aucune donnée personnelle, aucun fichier `.env` versionné.
- ✅ Aucun `node_modules` dans le dépôt ni dans l'image finale.
- ✅ Image finale sans code source, sans Node, sans `npm`.
- ✅ Projet limité au TP multi-stage (pas de Docker Compose).
