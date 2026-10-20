# syntax=docker/dockerfile:1
# Imagen de producción para Railway. Build: docker build -t eia-backend .

ARG NODE_VERSION=22-alpine
ARG PNPM_VERSION=11.22.0

# ---------- base: Node + pnpm ----------
FROM node:${NODE_VERSION} AS base
ARG PNPM_VERSION
# openssl: requerido por el schema engine de Prisma (migraciones) en Alpine.
RUN apk add --no-cache openssl && npm install -g pnpm@${PNPM_VERSION}
WORKDIR /app

# ---------- build: dependencias completas + compilación ----------
FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml prisma.config.ts ./
COPY prisma ./prisma
# postinstall ejecuta `prisma generate` (no necesita conexión a la BD).
RUN pnpm install --frozen-lockfile
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
# App (dist/) + seed compilado (dist/seed/) para correrlo con node en producción.
COPY tsconfig.seed.json ./
RUN pnpm build && pnpm build:seed

# ---------- prod-deps: solo dependencias de producción ----------
FROM base AS prod-deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml prisma.config.ts ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile --prod

# ---------- runtime: imagen final mínima, usuario no root ----------
FROM node:${NODE_VERSION} AS runtime
RUN apk add --no-cache openssl tini
ENV NODE_ENV=production \
    PORT=3000
WORKDIR /app
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json prisma.config.ts ./
COPY --chown=node:node prisma ./prisma
COPY --chown=node:node scripts/docker-entrypoint.sh ./scripts/docker-entrypoint.sh
USER node
EXPOSE 3000
# tini reenvía SIGTERM para que Nest cierre limpio (enableShutdownHooks). El entrypoint aplica
# migraciones y el seed seguro antes de arrancar (ver docs/DEPLOY.md); si fallan, no arranca.
ENTRYPOINT ["/sbin/tini", "--", "/app/scripts/docker-entrypoint.sh"]
CMD ["node", "dist/main"]
