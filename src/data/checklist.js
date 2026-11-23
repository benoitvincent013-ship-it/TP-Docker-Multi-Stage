// Critères de validation du TP Docker multi-stage.
// Chaque élément possède un identifiant stable (utilisé dans le localStorage)
// et la commande PowerShell qui permet de le vérifier.
export const CATEGORIES = [
  {
    id: "application",
    titre: "Application, fichiers statiques & section de validation",
    elements: [
      {
        id: "app-build",
        texte:
          "Application web fonctionnelle, compilée en fichiers statiques : npm run build génère le dossier dist/ sans erreur.",
        commande: "npm run build; Get-ChildItem dist",
      },
      {
        id: "app-pas-de-presentation",
        texte: "Aucune page de présentation pédagogique du TP à la place de l'application.",
        commande:
          'Get-ChildItem src -Recurse -Include *.jsx | Select-String -Pattern "Les quatre étapes du TP"',
        note: "Aucun résultat = OK",
      },
      {
        id: "checklist-presente",
        texte:
          "Section « Checklist de validation du TP » présente, pliable et fonctionnelle (cases persistées dans le localStorage, barre de progression dédiée, commandes copiables).",
        commande: "Start-Process http://localhost:8080",
      },
    ],
  },
  {
    id: "image",
    titre: "Image Docker multi-stage",
    elements: [
      {
        id: "dockerfile-deux-etapes",
        texte:
          "Dockerfile à la racine avec 2 étapes distinctes : une étape de build Node.js (AS builder) et une étape finale légère (nginx:alpine) qui sert uniquement les fichiers statiques compilés.",
        commande: 'Select-String -Path Dockerfile -Pattern "^FROM"',
        note: "2 lignes FROM attendues : builder puis nginx",
      },
      {
        id: "image-sans-node-modules",
        texte:
          "Aucun dossier node_modules ni fichier de développement copié dans l'image finale.",
        commande: "docker exec mon-app ls -la /usr/share/nginx/html",
        note: "Seulement index.html, assets/ et favicon.svg",
      },
      {
        id: "dockerignore",
        texte: ".dockerignore configuré pour exclure node_modules, dist, .git et les fichiers .env.",
        commande: "Get-Content .dockerignore",
      },
      {
        id: "image-construite",
        texte: "Image construite avec succès (docker build -t mon-app-multistage:1.0 .).",
        commande: "docker build -t mon-app-multistage:1.0 .",
      },
    ],
  },
  {
    id: "conteneur",
    titre: "Conteneur & tests de fonctionnement",
    elements: [
      {
        id: "conteneur-demarre",
        texte:
          "Conteneur démarré depuis l'image construite (docker run -d --name mon-app -p 8080:80 mon-app-multistage:1.0).",
        commande: "docker run -d --name mon-app -p 8080:80 mon-app-multistage:1.0",
      },
      {
        id: "conteneur-up",
        texte: "Statut du conteneur vérifié : docker ps affiche le conteneur en état Up.",
        commande: "docker ps --filter name=mon-app",
      },
      {
        id: "http-200",
        texte:
          "Réponse HTTP vérifiée : Invoke-WebRequest -Uri http://localhost:8080 -UseBasicParsing retourne le code 200.",
        commande: "(Invoke-WebRequest -Uri http://localhost:8080 -UseBasicParsing).StatusCode",
      },
      {
        id: "navigateur-application",
        texte:
          "Application testée et fonctionnelle dans le navigateur sur http://localhost:8080 (gestion des tâches + section « Checklist de validation du TP » accessible et opérationnelle).",
        commande: "Start-Process http://localhost:8080",
      },
    ],
  },
  {
    id: "livrables",
    titre: "Dépôt GitHub public & livrables",
    elements: [
      {
        id: "depot-public",
        texte:
          "Dépôt GitHub public dédié uniquement au TP Docker multi-stage (distinct d'un éventuel TP Docker Compose).",
        commande: "Start-Process https://github.com/benoitvincent013-ship-it/TP-Docker-Multi-Stage",
      },
      {
        id: "gitignore",
        texte:
          ".gitignore actif : aucun node_modules, aucun secret ni donnée personnelle versionnés.",
        commande: 'git ls-files | Select-String -Pattern "node_modules|\\.env"',
        note: "Aucun résultat = OK",
      },
      {
        id: "readme",
        texte:
          "README.md complet en français (présentation, objectif, prérequis, structure, explication du multi-stage, commandes build/run/test/stop, résultats réels et captures).",
        commande: "Get-Content README.md -TotalCount 25",
      },
      {
        id: "captures",
        texte:
          "Preuves de fonctionnement ajoutées dans un dossier captures/ (build Docker, docker ps, test HTTP, rendu navigateur, lien GitHub).",
        commande: "Get-ChildItem captures",
      },
    ],
  },
];

export const NOMBRE_CRITERES = CATEGORIES.reduce(
  (total, categorie) => total + categorie.elements.length,
  0
);
