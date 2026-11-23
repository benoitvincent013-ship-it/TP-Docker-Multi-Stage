export default function TaskItem({ tache, onBasculer, onSupprimer }) {
  const identifiantCase = `tache-${tache.id}`;

  return (
    <li className={tache.terminee ? "tache tache--terminee" : "tache"}>
      <input
        id={identifiantCase}
        className="case"
        type="checkbox"
        checked={tache.terminee}
        onChange={() => onBasculer(tache.id)}
      />
      <label className="tache__intitule" htmlFor={identifiantCase}>
        {tache.intitule}
      </label>
      <button
        type="button"
        className="supprimer"
        onClick={() => onSupprimer(tache.id)}
        aria-label={`Supprimer : ${tache.intitule}`}
        title="Supprimer"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" width="16" height="16">
          <path
            d="M6 6l12 12M18 6L6 18"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </li>
  );
}
