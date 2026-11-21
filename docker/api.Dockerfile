# syntax=docker/dockerfile:1.7
#
# Tamas Market API (Fastify). Build from the repository root:
#   docker build -f docker/api.Dockerfile -t tamas-api .
# On start it applies database migrations (RUN_MIGRATIONS=false skips that),
# then serves on PORT (3001). Everything it writes lives under /data.

ARG NODE_IMAGE=node:24-bookworm-slim

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

# --- build shared + API, then drop dev packages --------------------------------
FROM deps AS build
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY payment payment
COPY apps/api apps/api
RUN npm run build -w @tamas/shared \
 && npm run build -w @tamas/api \
 # The compiled migrator looks for migrations next to dist/.
 && cp -r apps/api/drizzle apps/api/dist/drizzle \
 && mkdir -p apps/api/node_modules packages/shared/node_modules payment/node_modules \
 && npm prune --omit=dev --ignore-scripts --no-audit --no-fund

# --- runtime ----------------------------------------------------------------------
FROM ${NODE_IMAGE} AS api
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3001 \
    STORAGE_ROOT=/data/storage \
    PRIVATE_STORAGE_ROOT=/data/private-storage \
    RUN_MIGRATIONS=true
WORKDIR /app
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/shared/package.json packages/shared/
COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/packages/shared/node_modules packages/shared/node_modules
COPY --from=build /app/payment payment
COPY --from=build /app/apps/api/package.json apps/api/
COPY --from=build /app/apps/api/dist apps/api/dist
COPY --from=build /app/apps/api/node_modules apps/api/node_modules
COPY docker/api-entrypoint.sh /usr/local/bin/api-entrypoint
# Public product/banner photos copied onto the data disk at start if missing.
COPY docker/seed-uploads /app/seed-uploads
# The API keeps backups and push credentials in .private/ next to itself;
# point that at the data disk so it survives restarts.
RUN chmod 755 /usr/local/bin/api-entrypoint \
 && mkdir -p /data \
 && ln -s /data/app-private /app/apps/api/.private
WORKDIR /app/apps/api
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["api-entrypoint"]
CMD ["node", "dist/src/index.js"]
