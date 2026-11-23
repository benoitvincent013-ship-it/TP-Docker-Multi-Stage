// Critères de validation du TP Docker multi-stage affichés dans l'application.
// Seuls les critères observables depuis le navigateur sont listés : la page les
// vérifie elle-même et attribue le statut « Auto-vérifié OK ».
// Chaque élément possède un identifiant stable et la commande PowerShell qui
// permet de le contrôler à la main.
export const CATEGORIES = [
  {
    id: "application",
    titre: "Application, fichiers statiques & section de validation",
    elements: [
      {
        id: "app-build",
        auto: "assets",
        texte:
          "Application compilée : les fichiers statiques (JavaScript et CSS) sont servis depuis /assets/ et chargés par la page.",
        commande: 'curl.exe -s http://localhost:8080 | Select-String -Pattern "assets/"',
      },
      {
        id: "app-pas-de-presentation",
        auto: "presentation",
        texte: "Aucune page de présentation pédagogique du TP à la place de l'application.",
        commande:
          'Get-ChildItem src -Recurse -Include *.jsx | Select-String -Pattern "Les quatre étapes du TP"',
        note: "Aucun résultat = OK",
      },
      {
        id: "checklist-presente",
        auto: "checklist",
        texte:
          "Section « Checklist de validation du TP » affichée directement sous la liste, toujours visible : cases persistées dans le localStorage, barre de progression dédiée, auto-vérification et commandes accessibles à la demande.",
        commande: "Start-Process http://localhost:8080",
      },
    ],
  },
  {
    id: "conteneur",
    titre: "Conteneur & tests de fonctionnement",
    elements: [
      {
        id: "http-200",
        auto: "http200",
        texte:
          "Réponse HTTP vérifiée : Invoke-WebRequest -Uri http://localhost:8080 -UseBasicParsing retourne le code 200.",
        commande: "(Invoke-WebRequest -Uri http://localhost:8080 -UseBasicParsing).StatusCode",
      },
      {
        id: "navigateur-application",
        auto: "application",
        texte:
          "Application testée et fonctionnelle dans le navigateur sur http://localhost:8080 (gestion des tâches + section « Checklist de validation du TP » accessible et opérationnelle).",
        commande: "Start-Process http://localhost:8080",
      },
    ],
  },
];

export const NOMBRE_CRITERES = CATEGORIES.reduce(
  (total, categorie) => total + categorie.elements.length,
  0
);

// Critères vérifiables automatiquement depuis le navigateur :
// identifiant du critère → clé du test correspondant.
export const CRITERES_AUTO = Object.fromEntries(
  CATEGORIES.flatMap((categorie) => categorie.elements)
    .filter((element) => element.auto)
    .map((element) => [element.id, element.auto])
);

export const NOMBRE_AUTO = Object.keys(CRITERES_AUTO).length;
