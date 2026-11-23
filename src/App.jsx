const etapes = [
  {
    numero: "1",
    titre: "Créer",
    texte:
      "Une application web simple, dont la compilation produit des fichiers statiques (HTML, CSS, JavaScript).",
  },
  {
    numero: "2",
    titre: "Construire",
    texte:
      "Une image Docker multi-stage : la première étape compile, l'étape finale sert uniquement les fichiers produits.",
  },
  {
    numero: "3",
    titre: "Tester",
    texte:
      "Démarrer un conteneur depuis l'image et constater que l'application répond sur le port publié.",
  },
  {
    numero: "4",
    titre: "Versionner",
    texte:
      "Sources, Dockerfile et README publiés sur un dépôt GitHub public, sans node_modules ni secret.",
  },
];

function App() {
  return (
    <div className="page">
      <header className="hero">
        <p className="eyebrow">TP Docker · Multi-stage build</p>
        <h1>
          Une application React compilée, puis servie par <span>Nginx</span>
        </h1>
        <p className="lead">
          Deux étapes dans un seul Dockerfile : Node compile l'application, l'image finale
          ne contient que les fichiers statiques et le serveur web. Résultat : une image
          légère, sans <code>node_modules</code>.
        </p>
        <div className="badges">
          <span className="badge badge--ok">Conteneur en ligne</span>
          <span className="badge">React 18 + Vite</span>
          <span className="badge">Nginx Alpine</span>
          <span className="badge">Docker multi-stage</span>
        </div>
      </header>

      <main>
        <section aria-labelledby="etapes-titre">
          <h2 id="etapes-titre">Les quatre étapes du TP</h2>
          <div className="grille">
            {etapes.map((etape) => (
              <article className="carte" key={etape.numero}>
                <span className="carte__numero">{etape.numero}</span>
                <h3>{etape.titre}</h3>
                <p>{etape.texte}</p>
              </article>
            ))}
          </div>
        </section>

        <section aria-labelledby="multi-stage-titre">
          <h2 id="multi-stage-titre">Comment fonctionne le multi-stage ?</h2>
          <div className="etapes-build">
            <div className="etape-build">
              <p className="etape-build__label">Étape 1 · build</p>
              <p className="etape-build__image">node:22-alpine</p>
              <ul>
                <li>Installe les dépendances avec <code>npm ci</code></li>
                <li>Compile l'application avec <code>npm run build</code></li>
                <li>Produit le dossier <code>dist/</code></li>
                <li>Cette étape est jetée à la fin du build</li>
              </ul>
            </div>
            <div className="fleche" aria-hidden="true">
              →
            </div>
            <div className="etape-build etape-build--finale">
              <p className="etape-build__label">Étape 2 · runtime</p>
              <p className="etape-build__image">nginx:alpine</p>
              <ul>
                <li>Reçoit seulement <code>dist/</code> via <code>COPY --from=build</code></li>
                <li>Ne contient ni Node, ni sources, ni dépendances</li>
                <li>Sert les fichiers statiques sur le port 80</li>
              </ul>
            </div>
          </div>
        </section>

        <section aria-labelledby="verif-titre">
          <h2 id="verif-titre">Vérifier que tout fonctionne</h2>
          <pre className="console">
            <code>{`docker build -t tp-docker-multi-stage .
docker run -d --name tp-docker -p 8080:80 tp-docker-multi-stage
curl.exe -I http://localhost:8080`}</code>
          </pre>
          <p className="note">
            La réponse attendue est <code>HTTP/1.1 200 OK</code>, servie par Nginx.
          </p>
        </section>
      </main>

      <footer>
        <p>TP Docker multi-stage · React + Vite · Nginx · image finale sans Node</p>
      </footer>
    </div>
  );
}

export default App;
