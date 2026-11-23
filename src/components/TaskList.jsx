import TaskItem from "./TaskItem.jsx";

const MESSAGES = {
  toutes: "Aucune tâche. Ajoutez-en une ci-dessus pour commencer.",
  actives: "Aucune tâche à faire. Tout est terminé.",
  terminees: "Aucune tâche terminée pour l'instant.",
};

export default function TaskList({ taches, filtre, onBasculer, onSupprimer }) {
  if (taches.length === 0) {
    return (
      <p className="vide" role="status">
        {MESSAGES[filtre] ?? MESSAGES.toutes}
      </p>
    );
  }

  return (
    <ul className="liste">
      {taches.map((tache) => (
        <TaskItem
          key={tache.id}
          tache={tache}
          onBasculer={onBasculer}
          onSupprimer={onSupprimer}
        />
      ))}
    </ul>
  );
}
