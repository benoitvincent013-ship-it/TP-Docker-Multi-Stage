import { useEffect, useState } from "react";
import { CATEGORIES, NOMBRE_CRITERES } from "../data/checklist.js";

const CLE_STOCKAGE = "checklist-tp";
const CLE_TACHES = "mes-taches";
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

function heureFrancaise(date) {
  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

// Lit un tableau stocké dans le localStorage sans planter.
function lireTableau(cle) {
  try {
    const donnees = JSON.parse(localStorage.getItem(cle) || "[]");
    return { ok: true, valeur: Array.isArray(donnees) ? donnees : [] };
  } catch {
    return { ok: false, valeur: [] };
  }
}

export default function Checklist() {
  const [coches, setCoches] = useState(lireCoches);
  const [copie, setCopie] = useState(null);
  const [controle, setControle] = useState(null);
  const [enCours, setEnCours] = useState(false);

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
      // Solution de repli si l'API presse-papiers est indisponible.
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

  // Contrôle rapide : origine de la page, DOM, localStorage et accès HTTP.
  const executerControle = async () => {
    setEnCours(true);
    const origine = window.location;
    const parServeurHttp = origine.protocol === "http:" || origine.protocol === "https:";
    const points = [];
    const ajouter = (ok, texte) => points.push({ ok, texte });

    // 1. Comment la page a-t-elle été ouverte ?
    ajouter(
      parServeurHttp,
      parServeurHttp
        ? `Page servie par un serveur HTTP : ${origine.origin}`
        : `Page ouverte en ${origine.protocol}// — hors serveur HTTP`
    );

    // 2. Le DOM de l'application est-il complet ?
    const racine = Boolean(document.getElementById("root"));
    const champTache = Boolean(document.querySelector("#nouvelle-tache"));
    const criteresAffiches = document.querySelectorAll(".critere").length;
    ajouter(
      racine && champTache && criteresAffiches === NOMBRE_CRITERES,
      `DOM : application montée, ${criteresAffiches}/${NOMBRE_CRITERES} critères affichés, champ de tâche ${
        champTache ? "présent" : "absent"
      }`
    );

    // 3. Le localStorage est-il lisible ?
    const taches = lireTableau(CLE_TACHES);
    const criteresEnregistres = lireTableau(CLE_STOCKAGE);
    ajouter(
      taches.ok && criteresEnregistres.ok,
      `localStorage : ${taches.valeur.length} tâche(s) enregistrée(s), ${criteresEnregistres.valeur.length} critère(s) coché(s)`
    );

    // 4. Le serveur répond-il sur cette adresse ?
    if (parServeurHttp) {
      try {
        const reponse = await fetch(origine.href, { method: "HEAD", cache: "no-store" });
        ajouter(
          reponse.ok,
          `Accès HTTP : ${reponse.status} ${reponse.statusText || "OK"} sur ${origine.origin}`
        );
      } catch (erreur) {
        ajouter(false, `Accès HTTP impossible depuis cette page (${erreur.message})`);
      }
    } else {
      ajouter(
        false,
        "Accès HTTP non testable depuis un fichier ouvert directement (file://)"
      );
    }

    const statut = points.every((point) => point.ok) ? "ok" : "attention";

    setControle({
      statut,
      heure: heureFrancaise(new Date()),
      origine: `${origine.protocol}//${origine.host || "fichier local"}`,
      points,
      rappel: parServeurHttp
        ? "Page correctement servie par le conteneur Nginx (http://localhost:8080)."
        : "Cette page doit être ouverte depuis le conteneur : docker run -d --name mon-app -p 8080:80 mon-app-multistage:1.0 puis http://localhost:8080.",
    });
    setEnCours(false);
  };

  const faits = coches.length;
  const progression = Math.round((faits / NOMBRE_CRITERES) * 100);

  return (
    <section className="verification" aria-labelledby="verification-titre">
      <div className="verification__entete">
        <div className="verification__texte">
          <h2 className="verification__titre" id="verification-titre">
            Checklist de validation du TP
          </h2>
          <p className="verification__sous-titre">
            {faits} / {NOMBRE_CRITERES} critères vérifiés — à contrôler avant la remise
          </p>
        </div>
        <div className="verification__droite">
          <span
            className="verification__piste"
            role="img"
            aria-label={`Checklist : ${progression} %`}
          >
            <span className="verification__barre" style={{ width: `${progression}%` }} />
          </span>
          <span className="verification__pourcentage">{progression}%</span>
        </div>
      </div>

      <div className="verification__panneau">
        <div className="controle">
          <div className="controle__ligne">
            <div>
              <p className="controle__titre">Contrôle rapide intégré</p>
              <p className="controle__aide">
                Vérifie sur cette page l'origine (HTTP ou fichier), le DOM, le localStorage
                et la réponse du serveur.
              </p>
            </div>
            <button
              type="button"
              className="controle__bouton"
              onClick={executerControle}
              disabled={enCours}
            >
              {enCours ? "Vérification…" : "Vérifier l'état de l'application & de la checklist"}
            </button>
          </div>

          {controle && (
            <div
              className={
                controle.statut === "ok"
                  ? "controle__resultat controle__resultat--ok"
                  : "controle__resultat controle__resultat--attention"
              }
              role="status"
              aria-live="polite"
            >
              <div className="controle__bandeau">
                <span className="controle__badge">
                  {controle.statut === "ok" ? "OK" : "À vérifier"}
                </span>
                <span className="controle__heure">Testé à {controle.heure}</span>
                <span className="controle__origine">{controle.origine}</span>
              </div>
              <ul className="controle__details">
                {controle.points.map((point) => (
                  <li key={point.texte} className={point.ok ? "point point--ok" : "point"}>
                    <span className="point__marque" aria-hidden="true">
                      {point.ok ? "✓" : "!"}
                    </span>
                    {point.texte}
                  </li>
                ))}
              </ul>
              <p className="controle__rappel">{controle.rappel}</p>
            </div>
          )}
        </div>

        <p className="verification__intro">
          Chaque case est enregistrée dans le navigateur et la commande PowerShell se copie
          en un clic.
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
    </section>
  );
}
