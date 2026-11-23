import { useCallback, useEffect, useState } from "react";
import {
  CATEGORIES,
  CRITERES_AUTO,
  NOMBRE_AUTO,
  NOMBRE_CRITERES,
} from "../data/checklist.js";

const CLE_COCHES = "checklist-tp";
const TOUS_LES_ID = CATEGORIES.flatMap((categorie) =>
  categorie.elements.map((element) => element.id)
);

// Seuls les critères non automatiques sont mémorisés : les autres sont
// recalculés à chaque chargement de la page.
function lireCoches() {
  try {
    const donnees = JSON.parse(localStorage.getItem(CLE_COCHES) || "[]");
    if (!Array.isArray(donnees)) return [];
    return donnees
      .map(String)
      .filter((id) => TOUS_LES_ID.includes(id) && !CRITERES_AUTO[id]);
  } catch {
    return [];
  }
}

function lireTableau(cle) {
  try {
    const donnees = JSON.parse(localStorage.getItem(cle) || "[]");
    return { ok: true, valeur: Array.isArray(donnees) ? donnees : [] };
  } catch {
    return { ok: false, valeur: [] };
  }
}

function heureFrancaise(date) {
  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

export default function Checklist() {
  const [coches, setCoches] = useState(lireCoches);
  const [auto, setAuto] = useState({});
  const [controle, setControle] = useState(null);
  const [enCours, setEnCours] = useState(false);
  const [commandesOuvertes, setCommandesOuvertes] = useState([]);
  const [copie, setCopie] = useState(null);

  useEffect(() => {
    localStorage.setItem(CLE_COCHES, JSON.stringify(coches));
  }, [coches]);

  useEffect(() => {
    if (!copie) return undefined;
    const minuteur = setTimeout(() => setCopie(null), 1600);
    return () => clearTimeout(minuteur);
  }, [copie]);

  // Vérifications réalisables depuis le navigateur.
  const executerTests = useCallback(async () => {
    const origine = window.location;
    const parServeurHttp = origine.protocol === "http:" || origine.protocol === "https:";
    const hote = origine.host || "fichier local";
    const estLocal = ["localhost", "127.0.0.1", "[::1]"].includes(origine.hostname);

    const scripts = [...document.querySelectorAll("script[src]")].filter((script) =>
      script.src.includes("/assets/")
    );
    const styles = [...document.querySelectorAll('link[rel="stylesheet"]')].filter((lien) =>
      lien.href.includes("/assets/")
    );

    const formulaire = Boolean(document.querySelector(".formulaire"));
    const champTache = Boolean(document.querySelector("#nouvelle-tache"));
    const filtres = Boolean(document.querySelector(".filtres"));
    const listeTaches = Boolean(document.querySelector(".liste, .vide"));
    const criteresAffiches = document.querySelectorAll(".critere").length;
    const barreChecklist = Boolean(document.querySelector(".verification__barre"));
    const textePage = document.body.innerText;
    const presentationDetectee = /Les quatre étapes du TP/.test(textePage);

    // Test d'écriture/lecture réelle dans le localStorage.
    let persistanceOk = false;
    try {
      localStorage.setItem("verif-ecriture", "ok");
      persistanceOk = localStorage.getItem("verif-ecriture") === "ok";
      localStorage.removeItem("verif-ecriture");
    } catch {
      persistanceOk = false;
    }
    const taches = lireTableau("mes-taches");

    let httpOk = false;
    let httpTexte = "Réponse HTTP non testée (page ouverte en file://)";
    if (parServeurHttp) {
      try {
        const reponse = await fetch(origine.href, { method: "HEAD", cache: "no-store" });
        httpOk = reponse.ok && reponse.status === 200;
        httpTexte = `Réponse HTTP : ${reponse.status} ${reponse.statusText || "OK"} sur ${origine.origin}`;
      } catch (erreur) {
        httpTexte = `Réponse HTTP impossible (${erreur.message})`;
      }
    }

    const applicationOk = formulaire && champTache && filtres && listeTaches;
    const checklistOk = criteresAffiches === NOMBRE_CRITERES && barreChecklist;

    const tests = {
      origine: {
        ok: parServeurHttp,
        texte: parServeurHttp
          ? `Origine HTTP${estLocal ? " (localhost)" : ""} : ${origine.protocol}//${hote}`
          : `Page ouverte en ${origine.protocol}//${hote} — hors serveur HTTP`,
      },
      assets: {
        ok: scripts.length > 0 && styles.length > 0,
        texte: `Fichiers compilés chargés : ${scripts.length} JS et ${styles.length} CSS depuis /assets/`,
      },
      presentation: {
        ok: !presentationDetectee && applicationOk,
        texte: presentationDetectee
          ? "Un contenu de présentation du TP a été détecté à la place de l'application"
          : "Aucune page de présentation : l'application « Mes tâches » est bien rendue",
      },
      checklist: {
        ok: checklistOk,
        texte: `Checklist rendue : ${criteresAffiches}/${NOMBRE_CRITERES} critères et barre de progression ${
          barreChecklist ? "présente" : "absente"
        }`,
      },
      stockage: {
        ok: persistanceOk && taches.ok,
        texte: `Persistance localStorage : écriture/lecture ${
          persistanceOk ? "OK" : "impossible"
        } · ${taches.valeur.length} tâche(s) enregistrée(s)`,
      },
      http200: { ok: httpOk, texte: httpTexte },
      application: {
        ok: applicationOk && persistanceOk && httpOk,
        texte: `Application fonctionnelle dans le navigateur : formulaire, filtres, liste de tâches ${
          applicationOk ? "OK" : "incomplets"
        }`,
      },
    };

    const points = [
      tests.origine,
      tests.assets,
      tests.application,
      tests.checklist,
      tests.stockage,
      tests.http200,
    ];

    const resultats = Object.fromEntries(
      Object.entries(CRITERES_AUTO).map(([idCritere, cleTest]) => [
        idCritere,
        tests[cleTest],
      ])
    );

    setAuto(resultats);
    setControle({
      heure: heureFrancaise(new Date()),
      origine: `${origine.protocol}//${hote}`,
      points,
      tousOk: points.every((point) => point.ok),
      rappel: parServeurHttp
        ? ""
        : "Ouvre la page depuis le conteneur : docker run -d --name mon-app -p 8080:80 mon-app-multistage:1.0 puis http://localhost:8080.",
    });
  }, []);

  // Vérification automatique dès le chargement de la page.
  useEffect(() => {
    setEnCours(true);
    executerTests().finally(() => setEnCours(false));
  }, [executerTests]);

  const relancer = () => {
    setEnCours(true);
    executerTests().finally(() => setEnCours(false));
  };

  const basculerCritere = (id) => {
    if (CRITERES_AUTO[id]) return; // géré automatiquement
    setCoches((precedentes) =>
      precedentes.includes(id)
        ? precedentes.filter((element) => element !== id)
        : [...precedentes, id]
    );
  };

  const basculerCommande = (id) => {
    setCommandesOuvertes((ouvertes) =>
      ouvertes.includes(id)
        ? ouvertes.filter((element) => element !== id)
        : [...ouvertes, id]
    );
  };

  const copierCommande = async (id, commande) => {
    try {
      await navigator.clipboard.writeText(commande);
      setCopie(id);
    } catch {
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

  const criteresAutoOk = Object.values(auto).filter((resultat) => resultat.ok).length;
  const faits = coches.length + criteresAutoOk;
  const progression = Math.round((faits / NOMBRE_CRITERES) * 100);
  const restantsManuels = NOMBRE_CRITERES - NOMBRE_AUTO - coches.length;
  // Catégories qui contiennent encore au moins un critère manuel non coché :
  // le panneau d'auto-vérification y renvoie par un lien.
  const categoriesManuelles = CATEGORIES.filter((categorie) =>
    categorie.elements.some(
      (element) => !CRITERES_AUTO[element.id] && !coches.includes(element.id)
    )
  );

  return (
    <section className="verification" aria-labelledby="verification-titre">
      <div className="verification__entete">
        <div className="verification__texte">
          <h2 className="verification__titre" id="verification-titre">
            Checklist de validation du TP
          </h2>
          <p className="verification__sous-titre">
            {faits} / {NOMBRE_CRITERES} critères validés ({criteresAutoOk} automatique
            {criteresAutoOk > 1 ? "s" : ""}, {coches.length} manuel
            {coches.length > 1 ? "s" : ""})
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
              <p className="controle__titre">Auto-vérification de la page</p>
              <p className="controle__aide">
                Lancée automatiquement au chargement : origine HTTP, DOM de l'application et
                de la checklist, persistance localStorage et réponse HTTP 200.
              </p>
            </div>
            <button
              type="button"
              className="controle__bouton"
              onClick={relancer}
              disabled={enCours}
            >
              {enCours ? "Vérification…" : "Tout auto-vérifier maintenant"}
            </button>
          </div>

          {controle && (
            <div
              className={
                controle.tousOk
                  ? "controle__resultat controle__resultat--ok"
                  : "controle__resultat controle__resultat--attention"
              }
              role="status"
              aria-live="polite"
            >
              <div className="controle__bandeau">
                <span className="controle__badge">
                  {controle.tousOk ? "OK" : "À vérifier"}
                </span>
                <span className="controle__heure">Vérifié à {controle.heure}</span>
                <span className="controle__origine">{controle.origine}</span>
              </div>
              <p className="controle__resume">
                {criteresAutoOk} / {NOMBRE_AUTO} critères auto-vérifiés
              </p>
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
              {categoriesManuelles.length > 0 && (
                <p className="controle__manuel">
                  <span className="controle__manuel-titre">
                    {restantsManuels} critère{restantsManuels > 1 ? "s" : ""} à valider
                    manuellement :
                  </span>{" "}
                  {categoriesManuelles.map((categorie, index) => (
                    <span key={categorie.id}>
                      {index > 0 && <span aria-hidden="true"> · </span>}
                      <a className="controle__lien" href={`#categorie-${categorie.id}`}>
                        {categorie.titre}
                      </a>
                    </span>
                  ))}
                </p>
              )}
              {controle.rappel && <p className="controle__rappel">{controle.rappel}</p>}
            </div>
          )}
        </div>

        {CATEGORIES.map((categorie) => (
          <div className="categorie" key={categorie.id} id={`categorie-${categorie.id}`}>
            <h3 className="categorie__titre">{categorie.titre}</h3>
            <ul className="criteres">
              {categorie.elements.map((element) => {
                const estAuto = Boolean(CRITERES_AUTO[element.id]);
                const resultatAuto = auto[element.id];
                const estCoche = estAuto
                  ? Boolean(resultatAuto && resultatAuto.ok)
                  : coches.includes(element.id);
                const identifiant = `critere-${element.id}`;
                const commandeVisible = commandesOuvertes.includes(element.id);

                let statut = "";
                let classeStatut = "statut";
                if (estAuto) {
                  statut = estCoche ? "Auto-vérifié OK" : "Auto — à revérifier";
                  classeStatut = estCoche ? "statut statut--auto-ok" : "statut statut--attente";
                } else if (estCoche) {
                  statut = "Validé manuellement";
                  classeStatut = "statut statut--manuel-ok";
                } else {
                  statut = "À valider manuellement";
                  classeStatut = "statut statut--attente";
                }

                return (
                  <li
                    key={element.id}
                    className={[
                      "critere",
                      estCoche ? "critere--coche" : "",
                      estAuto ? "critere--auto" : "critere--manuel",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {/* Seuls les critères auto-vérifiés gardent une case (indicateur
                        désactivé) : les critères manuels n'en ont plus, le texte du
                        critère sert de bouton de validation. */}
                    {estAuto && (
                      <input
                        id={identifiant}
                        className="case"
                        type="checkbox"
                        checked={estCoche}
                        disabled
                        readOnly
                      />
                    )}
                    <div className="critere__corps">
                      <div className="critere__ligne">
                        {estAuto ? (
                          <label className="critere__texte" htmlFor={identifiant}>
                            {element.texte}
                          </label>
                        ) : (
                          <button
                            type="button"
                            className="critere__texte critere__texte--bouton"
                            aria-pressed={estCoche}
                            onClick={() => basculerCritere(element.id)}
                          >
                            {element.texte}
                          </button>
                        )}
                        <span className={classeStatut}>{statut}</span>
                      </div>

                      {estAuto && resultatAuto && (
                        <p className="critere__auto-info">{resultatAuto.texte}</p>
                      )}
                      {element.note && <p className="critere__note">{element.note}</p>}

                      <button
                        type="button"
                        className="voir-commande"
                        onClick={() => basculerCommande(element.id)}
                        aria-expanded={commandeVisible}
                      >
                        {commandeVisible ? "Masquer la commande" : "Voir la commande"}
                      </button>

                      {commandeVisible && (
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
                      )}
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
