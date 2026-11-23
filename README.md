# Mes tâches — TP Docker multi-stage

Application web de gestion de tâches (React + Vite), compilée dans une image Docker
**multi-stage** où Nginx sert uniquement les fichiers statiques produits par la compilation.

Dépôt GitHub : <https://github.com/benoitvincent013-ship-it/TP-Docker-Multi-Stage>

---

## 1. L'application

« Mes tâches » est une application monopage qui permet de :

- ajouter une tâche (champ de saisie + bouton « Ajouter », ou touche Entrée) ;
- cocher une tâche comme terminée (texte barré, barre de progression et compteurs mis à jour) ;
- supprimer une tâche ;
- filtrer la liste : **Toutes / À faire / Terminées** ;
- effacer d'un coup toutes les tâches terminées ;
- conserver les tâches après fermeture du navigateur : elles sont enregistrées dans le
  `localStorage` (aucun serveur, aucune donnée envoyée sur le réseau).

L'application est entièrement statique : aucune API, aucune base de données.

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

## 3. Prérequis

- Windows 11 avec **Docker Desktop** démarré.
- **PowerShell** (ou le terminal de VS Code).
- Internet pour le premier build (téléchargement des images `node` et `nginx`).
- _Facultatif_ : Node.js 22 pour lancer l'application hors Docker.

```powershell
docker --version
```

## 4. Structure du projet

```text
TP-Docker-Multi-Stage/
├── captures/                  # Preuves de fonctionnement
│   ├── 00-generation-package-lock.txt
│   ├── 01-build-image.txt
│   ├── 02-demarrage-conteneur.txt
│   ├── 03-test-http-headers.txt
│   ├── 04-test-http-body.html
│   ├── 05-verification-image-finale.txt
│   └── 06-application-navigateur.png
├── nginx/
│   └── default.conf           # Configuration du serveur (gzip, cache, fallback)
├── public/
│   └── favicon.svg
├── src/
│   ├── components/
│   │   ├── TaskForm.jsx       # Formulaire d'ajout
│   │   ├── TaskItem.jsx       # Une tâche (case, libellé, suppression)
│   │   └── TaskList.jsx       # Liste + état vide
│   ├── App.jsx                # État, filtres, progression, sauvegarde locale
│   ├── main.jsx               # Point d'entrée React
│   └── styles.css
├── .dockerignore
├── .gitignore
├── Dockerfile
├── index.html
├── package.json
├── package-lock.json
└── vite.config.js
```

## 5. Le Dockerfile multi-stage

```dockerfile
# ÉTAPE 1 : compilation
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build          # génère /app/dist

# ÉTAPE 2 : production
FROM nginx:1.27-alpine AS runtime
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
RUN rm -rf /usr/share/nginx/html/*
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK CMD wget -q --spider http://127.0.0.1/ || exit 1
CMD ["nginx", "-g", "daemon off;"]
```

- L'étape 1 installe les dépendances et compile : elle contient Node, `node_modules` et les sources.
- L'étape 2 repart d'une image Nginx vierge et ne récupère que le dossier `dist/`
  grâce à `COPY --from=build`. Elle est donc très légère : ni Node, ni `npm`,
  ni `node_modules`, ni code source.
- Le `.dockerignore` exclut `node_modules`, `dist`, `.git`, `captures/` et les fichiers `.env`
  du contexte de build.

## 6. Construire l'image

```powershell
cd TP-Docker-Multi-Stage
docker build -t tp-docker-multi-stage .
```

## 7. Lancer le conteneur

```powershell
docker run -d --name tp-docker -p 8080:80 --restart unless-stopped tp-docker-multi-stage
```

`-p 8080:80` publie le port 80 du conteneur sur le port 8080 de la machine.

## 8. Accéder à l'application

**<http://localhost:8080>**

## 9. Tester

```powershell
# Le conteneur tourne et est "healthy"
docker ps

# Réponse HTTP du serveur
curl.exe -I http://localhost:8080

# Code de retour
curl.exe -s -o NUL -w "%{http_code}`n" http://localhost:8080

# Fichiers statiques présents dans l'image finale
docker exec tp-docker ls -laR /usr/share/nginx/html

# Ni Node ni node_modules dans l'image finale
docker exec tp-docker sh -c "command -v node || echo 'node absent'"
docker exec tp-docker sh -c "find / -maxdepth 5 -type d -name node_modules"

# Taille de l'image
docker images tp-docker-multi-stage
```

## 10. Arrêter et supprimer

```powershell
docker stop tp-docker            # arrêter
docker start tp-docker           # redémarrer
docker rm -f tp-docker           # supprimer le conteneur
docker rmi tp-docker-multi-stage # supprimer l'image
```

## 11. Résultats des tests effectués

Tests réalisés le 23/11/2026 sur Windows 11 avec Docker Desktop.

| Test | Résultat |
|---|---|
| `npm ci` (étape de build) | 63 paquets installés |
| `npm run build` (Vite) | 34 modules compilés, `dist/index.html 0.67 kB`, CSS `3.72 kB`, JS `146.61 kB` (gzip 47.50 kB) |
| `docker build` | code de sortie `0`, image `tp-docker-multi-stage:latest` créée |
| Taille de l'image finale | **73,9 Mo** |
| `docker ps` | `Up (healthy)`, `0.0.0.0:8080->80/tcp` |
| `curl.exe -I http://localhost:8080` | `HTTP/1.1 200 OK`, `Server: nginx/1.27.5`, `Content-Length: 677` |
| Temps de réponse | `0.0105 s`, code `200` |
| Contenu de l'image finale | `index.html`, `assets/` (JS + CSS), `favicon.svg` uniquement |
| Absence de `node`, `npm`, `node_modules`, `/app` | confirmée |
| Fonctionnement dans le navigateur | ajout de 3 tâches, case cochée (progression 33 %), filtre « Terminées », persistance après rechargement — aucune erreur console |

## 12. Captures

| Fichier | Contenu |
|---|---|
| `captures/01-build-image.txt` | Sortie réelle de `docker build` |
| `captures/02-demarrage-conteneur.txt` | Démarrage et état du conteneur |
| `captures/03-test-http-headers.txt` | En-têtes HTTP renvoyés par Nginx |
| `captures/04-test-http-body.html` | HTML servi par le conteneur |
| `captures/05-verification-image-finale.txt` | Fichiers statiques présents, absence de Node/`node_modules`, taille |
| `captures/06-application-navigateur.png` | L'application dans le navigateur |

![Application Mes tâches servie par le conteneur](captures/06-application-navigateur.png)

## 13. Développement hors Docker (facultatif)

```powershell
npm install
npm run dev   # http://localhost:5173
```

## 14. Versionnement

Le dépôt contient les sources, le `Dockerfile`, la configuration Nginx, le README et les
captures. Ne sont **pas** versionnés : `node_modules/`, `dist/`, `.env`, fichiers de l'éditeur.
Aucun secret n'est présent dans le projet.
