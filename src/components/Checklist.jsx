import { useEffect, useState } from "react";
import { CATEGORIES, NOMBRE_CRITERES } from "../data/checklist.js";

const CLE_STOCKAGE = "checklist-tp";
const TOUS_LES_ID = CATEGORIES.flatMap((categorie) =>
  categorie.elements.map((element) => element.id)
);

function lireCoches() {
  try {
    const brut = localStorage.getItem(CLE_STOCKAGE);
    if (!brut) return [];
    const donnees = JSON.parse(brut);
    if (!Array.isArray(donnees)) return [];
    return donnees.map(String).filter((id) => TOUS_LES_ID.includes(id));
  } catch (erreur) {
    console.warn("Checklist illisible, on repart de zéro.", erreur);
    return [];
  }
}

export default function Checklist() {
  const [ouvert, setOuvert] = useState(false);
  const [coches, setCoches] = useState(lireCoches);
  const [copie, setCopie] = useState(null);

  useEffect(() => {
    localStorage.setItem(CLE_STOCKAGE, JSON.stringify(coches));
  }, [coches]);

  useEffect(() => {
    if (!copie) return undefined;
    const minuteur = setTimeout(() => setCopie(null), 1600);
    return () => clearTimeout(minuteur);
  }, [copie]);

  const basculerCritere = (id) => {
    setCoches((precedentes) =>
      precedentes.includes(id)
        ? precedentes.filter((element) => element !== id)
        : [...precedentes, id]
    );
  };

  const copierCommande = async (id, commande) => {
    try {
      await navigator.clipboard.writeText(commande);
      setCopie(id);
    } catch {
      // Solution de repli si l'API presse-papiers est indisponible
      // (par exemple hors HTTPS sur un navigateur ancien).
      const zone = document.createElement("textarea");
      zone.value = commande;
      zone.setAttribute("readonly", "");
      zone.style.position = "absolute";
      zone.style.left = "-9999px";
      document.body.appendChild(zone);
      zone.select();
      document.execCommand("copy");
      zone.remove();
      setCopie(id);
    }
  };

  const faits = coches.length;
  const progression = Math.round((faits / NOMBRE_CRITERES) * 100);

  return (
    <section className="verification" aria-labelledby="verification-titre">
      <button
        type="button"
        className="verification__entete"
        aria-expanded={ouvert}
        aria-controls="verification-panneau"
        onClick={() => setOuvert((etat) => !etat)}
      >
        <span className="verification__texte">
          <span className="verification__titre" id="verification-titre">
            Checklist de validation du TP
          </span>
          <span className="verification__sous-titre">
            {faits} / {NOMBRE_CRITERES} critères vérifiés
          </span>
        </span>
        <span className="verification__droite">
          <span
            className="verification__piste"
            role="img"
            aria-label={`Checklist : ${progression} %`}
          >
            <span className="verification__barre" style={{ width: `${progression}%` }} />
          </span>
          <span className="verification__pourcentage">{progression}%</span>
          <svg
            className={ouvert ? "chevron chevron--ouvert" : "chevron"}
            viewBox="0 0 24 24"
            width="16"
            height="16"
            aria-hidden="true"
          >
            <path
              d="M6 9l6 6 6-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </button>

      {ouvert && (
        <div className="verification__panneau" id="verification-panneau">
          <p className="verification__intro">
            À vérifier avant la remise. Chaque case est enregistrée dans le navigateur et la
            commande PowerShell se copie en un clic.
          </p>

          {CATEGORIES.map((categorie) => (
            <div className="categorie" key={categorie.id}>
              <h3 className="categorie__titre">{categorie.titre}</h3>
              <ul className="criteres">
                {categorie.elements.map((element) => {
                  const estCoche = coches.includes(element.id);
                  const identifiant = `critere-${element.id}`;
                  return (
                    <li
                      key={element.id}
                      className={estCoche ? "critere critere--coche" : "critere"}
                    >
                      <input
                        id={identifiant}
                        className="case"
                        type="checkbox"
                        checked={estCoche}
                        onChange={() => basculerCritere(element.id)}
                      />
                      <div className="critere__corps">
                        <label className="critere__texte" htmlFor={identifiant}>
                          {element.texte}
                        </label>
                        <div className="commande">
                          <code>{element.commande}</code>
                          <button
                            type="button"
                            className="copier"
                            onClick={() => copierCommande(element.id, element.commande)}
                            aria-label={`Copier la commande : ${element.commande}`}
                          >
                            {copie === element.id ? "Copié ✓" : "Copier"}
                          </button>
                        </div>
                        {element.note && <p className="critere__note">{element.note}</p>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
