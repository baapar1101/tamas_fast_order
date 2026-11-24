#!/bin/sh
# Prepares /data (a Docker volume or a Hamravesh disk, which may arrive
# root-owned), applies migrations, then runs the API as the unprivileged
# `node` user.
set -e

for dir in /data/storage /data/private-storage /data/app-private; do
  mkdir -p "$dir"
done

# Photos recovered after the November 2026 server loss (and copied from the
# old server's apps/api/storage: product/, slide/) ship inside the image;
# copy any that the disk does not have yet (never overwrite newer files).
if [ -d /app/seed-uploads ]; then
  cp -rn /app/seed-uploads/. /data/storage/ 2>/dev/null || true
fi

if [ "$(id -u)" = "0" ]; then
  chown -R node:node /data/storage /data/private-storage /data/app-private 2>/dev/null || true
  chmod 700 /data/private-storage /data/app-private 2>/dev/null || true
  RUN_AS="setpriv --reuid=node --regid=node --init-groups"
else
  RUN_AS=""
fi

if [ "${RUN_MIGRATIONS:-true}" != "false" ]; then
  echo "applying database migrations..."
  $RUN_AS node dist/src/db/migrate.js
fi

exec $RUN_AS "$@"
