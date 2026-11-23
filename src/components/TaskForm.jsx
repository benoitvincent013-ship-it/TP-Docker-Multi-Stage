import { useState } from "react";

export default function TaskForm({ onAjouter }) {
  const [valeur, setValeur] = useState("");

  const envoyer = (evenement) => {
    evenement.preventDefault();
    const texte = valeur.trim();
    if (!texte) return;
    onAjouter(texte);
    setValeur("");
  };

  return (
    <form className="formulaire" onSubmit={envoyer}>
      <label className="sr-only" htmlFor="nouvelle-tache">
        Nouvelle tâche
      </label>
      <input
        id="nouvelle-tache"
        className="champ"
        type="text"
        placeholder="Ajouter une tâche (par exemple : réviser le TP Docker)"
        value={valeur}
        onChange={(evenement) => setValeur(evenement.target.value)}
        maxLength={120}
        autoComplete="off"
      />
      <button className="bouton" type="submit" disabled={valeur.trim() === ""}>
        Ajouter
      </button>
    </form>
  );
}
