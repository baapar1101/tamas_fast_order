# syntax=docker/dockerfile:1.7
#
# Tamas Market storefront + admin panel, served by nginx, which also forwards
# /api and /uploads to the API. Build from the repository root:
#   docker build -f docker/web.Dockerfile -t tamas-web .
# API_UPSTREAM (default api:3001) is the API's address inside the network;
# on Hamravesh use the internal address shown on the API app's page.

ARG NODE_IMAGE=node:24-bookworm-slim
ARG NGINX_IMAGE=nginx:1.27-alpine

FROM ${NODE_IMAGE} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY scripts/fix-perms.js scripts/fix-perms.js
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY payment/package.json payment/
RUN npm ci --ignore-scripts --no-audit --no-fund

FROM deps AS build
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/web apps/web
RUN npm run build -w @tamas/shared && npm run build -w @tamas/web

FROM ${NGINX_IMAGE} AS web
ENV API_UPSTREAM=api:3001
# The official image renders /etc/nginx/templates/*.template with the
# environment on start, so API_UPSTREAM can change without a rebuild.
COPY docker/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
RUN mkdir -p /usr/share/nginx/apk
EXPOSE 80
