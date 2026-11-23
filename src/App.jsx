import { useEffect, useMemo, useState } from "react";
import TaskForm from "./components/TaskForm.jsx";
import TaskList from "./components/TaskList.jsx";

const CLE_STOCKAGE = "mes-taches";

const FILTRES = [
  { id: "toutes", libelle: "Toutes" },
  { id: "actives", libelle: "À faire" },
  { id: "terminees", libelle: "Terminées" },
];

// Lit les tâches enregistrées dans le navigateur (localStorage).
function lireTaches() {
  try {
    const brut = localStorage.getItem(CLE_STOCKAGE);
    if (!brut) return [];
    const donnees = JSON.parse(brut);
    if (!Array.isArray(donnees)) return [];
    return donnees
      .filter((tache) => tache && typeof tache.intitule === "string")
      .map((tache) => ({
        id: String(tache.id),
        intitule: tache.intitule,
        terminee: Boolean(tache.terminee),
      }));
  } catch (erreur) {
    console.warn("Tâches illisibles, on repart de zéro.", erreur);
    return [];
  }
}

function identifiant() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function App() {
  const [taches, setTaches] = useState(lireTaches);
  const [filtre, setFiltre] = useState("toutes");

  // Sauvegarde automatique à chaque modification.
  useEffect(() => {
    localStorage.setItem(CLE_STOCKAGE, JSON.stringify(taches));
  }, [taches]);

  const ajouterTache = (intitule) => {
    const texte = intitule.trim();
    if (!texte) return;
    setTaches((precedentes) => [
      { id: identifiant(), intitule: texte, terminee: false },
      ...precedentes,
    ]);
  };

  const basculerTache = (id) => {
    setTaches((precedentes) =>
      precedentes.map((tache) =>
        tache.id === id ? { ...tache, terminee: !tache.terminee } : tache
      )
    );
  };

  const supprimerTache = (id) => {
    setTaches((precedentes) => precedentes.filter((tache) => tache.id !== id));
  };

  const supprimerTerminees = () => {
    setTaches((precedentes) => precedentes.filter((tache) => !tache.terminee));
  };

  const restantes = taches.filter((tache) => !tache.terminee).length;
  const terminees = taches.length - restantes;
  const progression = taches.length === 0 ? 0 : Math.round((terminees / taches.length) * 100);

  const tachesVisibles = useMemo(() => {
    if (filtre === "actives") return taches.filter((tache) => !tache.terminee);
    if (filtre === "terminees") return taches.filter((tache) => tache.terminee);
    return taches;
  }, [taches, filtre]);

  const dateDuJour = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  return (
    <div className="app">
      <header className="entete">
        <div>
          <p className="date">{dateDuJour}</p>
          <h1>Mes tâches</h1>
          <p className="resume">
            {taches.length === 0
              ? "Aucune tâche pour le moment."
              : `${restantes} à faire · ${terminees} terminée${terminees > 1 ? "s" : ""}`}
          </p>
        </div>
        <div className="progression" role="img" aria-label={`Progression : ${progression} %`}>
          <span className="progression__valeur">{progression}%</span>
          <span className="progression__piste">
            <span className="progression__barre" style={{ width: `${progression}%` }} />
          </span>
        </div>
      </header>

      <TaskForm onAjouter={ajouterTache} />

      <div className="barre-outils">
        <div className="filtres" role="group" aria-label="Filtrer les tâches">
          {FILTRES.map((option) => (
            <button
              key={option.id}
              type="button"
              className={filtre === option.id ? "filtre filtre--actif" : "filtre"}
              aria-pressed={filtre === option.id}
              onClick={() => setFiltre(option.id)}
            >
              {option.libelle}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="lien"
          onClick={supprimerTerminees}
          disabled={terminees === 0}
        >
          Effacer les tâches terminées
        </button>
      </div>

      <TaskList
        taches={tachesVisibles}
        filtre={filtre}
        onBasculer={basculerTache}
        onSupprimer={supprimerTache}
      />
    </div>
  );
}
