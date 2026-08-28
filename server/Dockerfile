# syntax=docker/dockerfile:1.7
#
# Imagem de producao do @mq/server.
#
# Build a partir da RAIZ do monorepo, nao de dentro de server/:
#   docker build -f server/Dockerfile -t qro-server .
#
# O contexto precisa ser a raiz porque o pnpm-lock.yaml e o pnpm-workspace.yaml
# vivem la, e sem eles nao da pra instalar de forma reproduzivel.

# ─────────────────────────────────────────────────────────────────────────────
# Stage 1 · build
# ─────────────────────────────────────────────────────────────────────────────
# Alpine: a base pesa 135 MB contra 331 MB do bookworm-slim. Foi verificado que
# argon2 (binding nativo) e o Prisma 5 funcionam em musl — o Prisma resolve
# `native` pro engine linux-musl-openssl-3.0.x.
#
# Build e runtime PRECISAM usar a MESMA libc: o engine que o `prisma generate`
# compila no build e copiado pro runtime e nao carrega numa libc diferente.
FROM node:24-alpine AS build

# openssl: o engine do Prisma linka contra ele em runtime e no generate
RUN apk add --no-cache openssl ca-certificates

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable

WORKDIR /app

# Manifests primeiro: enquanto nenhum deles mudar, o Docker reaproveita a
# camada de install inteira mesmo com o codigo-fonte mudando a cada commit.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/cliente/package.json ./apps/cliente/
COPY apps/dono/package.json ./apps/dono/
COPY apps/restaurante/package.json ./apps/restaurante/
COPY packages/design-system/package.json ./packages/design-system/
COPY packages/shared/package.json ./packages/shared/
COPY server/package.json ./server/

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter @mq/server... --filter .

# Agora o codigo. So o que o server precisa — os apps de front nao entram.
COPY packages/shared ./packages/shared
COPY server ./server

# Client tipado do Prisma (o bundle depende dos tipos gerados)
RUN pnpm --filter @mq/server db:generate

# Bundle: inlina @mq/shared, mantem as deps de npm como external
RUN pnpm --filter @mq/server build

# Arvore autocontida com dist + prisma + node_modules de producao.
# --legacy: a partir do pnpm 10 o deploy sem injected packages exige o flag.
RUN pnpm deploy --legacy --filter @mq/server --prod /deploy

# O deploy reinstala do zero e NAO traz o client gerado junto — precisa gerar
# de novo dentro de /deploy, senao o container sobe sem .prisma/client.
#
# Chamando o binario direto em vez de `pnpm exec`: dentro de /deploy nao existe
# workspace, entao o pnpm tentaria um install e morreria no "@mq/shared@workspace:*
# nao encontrado". Com cwd=/deploy, o generate resolve @prisma/client a partir de
# /deploy/node_modules — que e exatamente onde o client precisa aterrissar.
RUN cd /deploy   && DATABASE_URL="postgresql://build:build@localhost:5432/build"      /app/server/node_modules/.bin/prisma generate

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2 · runtime
# ─────────────────────────────────────────────────────────────────────────────
FROM node:24-alpine AS runtime

RUN apk add --no-cache openssl ca-certificates dumb-init

ENV NODE_ENV=production
ENV PORT=3001
ENV HOST=0.0.0.0

WORKDIR /app

# node:* ja traz o usuario `node` (uid 1000). Rodar como root numa imagem
# publica e o tipo de detalhe que aparece em auditoria de cliente.
COPY --from=build --chown=node:node /deploy ./

USER node
EXPOSE 3001

# dumb-init vira o PID 1 e repassa SIGTERM pro node. Sem ele o Node como PID 1
# ignora sinal padrao e o orquestrador acaba matando no timeout — o shutdown
# gracioso do server.ts nunca roda e conexoes em voo sao cortadas.
ENTRYPOINT ["dumb-init", "--"]

# Liveness: /health de proposito, que nao toca no banco. Ver plugins/security.ts.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/server.js"]
