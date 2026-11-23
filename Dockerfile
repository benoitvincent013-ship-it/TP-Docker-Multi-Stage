# ============================================================
#  TP Docker multi-stage
#  Étape 1 : compilation de l'application (Node)
#  Étape 2 : serveur statique Nginx (image finale légère)
# ============================================================

# ---------- ÉTAPE 1 : BUILD ----------
FROM node:22-alpine AS build

WORKDIR /app

# On copie d'abord les manifestes : la couche "npm ci" reste en cache
# tant que les dépendances ne changent pas.
COPY package.json package-lock.json ./
RUN npm ci

# On copie ensuite les sources et on compile.
COPY . .
RUN npm run build

# ---------- ÉTAPE 2 : RUNTIME ----------
FROM nginx:1.27-alpine AS runtime

# Configuration Nginx dédiée (gzip, cache, en-têtes, fallback SPA)
COPY nginx/default.conf /etc/nginx/conf.d/default.conf

# On supprime les pages par défaut de Nginx (index.html, 50x.html)
# pour ne garder que le contenu de l'application.
RUN rm -rf /usr/share/nginx/html/*

# On récupère UNIQUEMENT le dossier compilé depuis l'étape de build.
# Ni Node, ni node_modules, ni sources ne sont présents dans cette image.
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q --spider http://127.0.0.1/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
