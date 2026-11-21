# syntax=docker/dockerfile:1.7
#
# Two images from one build:
#   docker build --target api -t tamas-api .   → Fastify API (also runs migrations)
#   docker build --target web -t tamas-web .   → nginx with the built storefront/admin
# docker-compose.yml builds both; see docker/README.md.

ARG NODE_IMAGE=node:24-bookworm-slim
ARG NGINX_IMAGE=nginx:1.27-alpine

# --- dependencies (cached while package files are unchanged) -----------------
FROM ${NODE_IMAGE} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY scripts/fix-perms.js scripts/fix-perms.js
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY payment/package.json payment/
# Install scripts are skipped: shared's `prepare` would compile before its
# source is copied, and every native package ships prebuilt for linux-x64.
RUN npm ci --ignore-scripts --no-audit --no-fund

# --- build shared, API and web -------------------------------------------------
FROM deps AS build
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY payment payment
COPY apps/api apps/api
COPY apps/web apps/web
RUN npm run build \
 # The compiled migrator looks for migrations next to dist/.
 && cp -r apps/api/drizzle apps/api/dist/drizzle \
 && mkdir -p apps/api/node_modules packages/shared/node_modules payment/node_modules

# --- production dependencies only ---------------------------------------------
FROM build AS api-prune
RUN npm prune --omit=dev --ignore-scripts --no-audit --no-fund

# --- API runtime ----------------------------------------------------------------
FROM ${NODE_IMAGE} AS api
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3001 \
    STORAGE_ROOT=/data/storage \
    PRIVATE_STORAGE_ROOT=/data/private-storage
WORKDIR /app
COPY --from=api-prune /app/package.json ./
COPY --from=api-prune /app/node_modules ./node_modules
COPY --from=api-prune /app/packages/shared/package.json packages/shared/
COPY --from=api-prune /app/packages/shared/dist packages/shared/dist
COPY --from=api-prune /app/packages/shared/node_modules packages/shared/node_modules
COPY --from=api-prune /app/payment payment
COPY --from=api-prune /app/apps/api/package.json apps/api/
COPY --from=api-prune /app/apps/api/dist apps/api/dist
COPY --from=api-prune /app/apps/api/node_modules apps/api/node_modules
# Uploads, private files and in-app backups live on volumes owned by `node`.
RUN mkdir -p /data/storage /data/private-storage /app/apps/api/.private \
 && chown -R node:node /data /app/apps/api/.private
# The API resolves .private/ (backups, push credentials) from its own folder.
WORKDIR /app/apps/api
USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/src/index.js"]

# --- web (static files + reverse proxy to the API) -----------------------------
FROM ${NGINX_IMAGE} AS web
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
