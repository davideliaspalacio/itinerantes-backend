#!/bin/sh
# Arranque de la imagen de producción (Railway). Autosuficiente: no depende de preDeployCommand.
#   1. prisma migrate deploy  → si falla, el contenedor NO arranca (exit ≠ 0).
#   2. seed idempotente       → catálogos de referencia (países, estados, municipios) siempre;
#                               ofertas demo solo con SEED_DEMO_DATA=true; nunca usuarios demo
#                               con NODE_ENV=production. Si falla, el contenedor NO arranca.
#   3. exec del comando (por defecto `node dist/main`).
# Variables: RUN_MIGRATIONS=false / RUN_SEED=false omiten los pasos 1 / 2 (p. ej. réplicas extra).
set -eu

if [ "${RUN_MIGRATIONS:-true}" != "false" ]; then
  echo "[entrypoint] prisma migrate deploy..."
  node node_modules/prisma/build/index.js migrate deploy
fi

if [ "${RUN_SEED:-true}" != "false" ]; then
  echo "[entrypoint] seed (catálogos; demo: SEED_DEMO_DATA=${SEED_DEMO_DATA:-<por defecto>})..."
  node dist/seed/prisma/seed.js
fi

if [ "$#" -eq 0 ]; then
  set -- node dist/main
fi
echo "[entrypoint] iniciando: $*"
exec "$@"
