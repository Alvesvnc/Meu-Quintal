# syntax=docker/dockerfile:1.7
#
# Imagem de producao de UM dos apps React. Parametrizada por APP.
#
# Build a partir da RAIZ do monorepo:
#   docker build -f apps/Dockerfile \
#     --build-arg APP=cliente \
#     --build-arg VITE_API_URL=https://api.meuquintal.com.br \
#     -t meu-quintal-cliente .
#
# ATENCAO — VITE_API_URL E BUILD-TIME, NAO RUNTIME.
# O Vite substitui import.meta.env.VITE_API_URL por texto literal dentro do
# bundle. Setar a variavel no `docker run` NAO tem efeito nenhum: o valor ja
# esta assado no JavaScript. Cada ambiente (staging, producao) precisa do
# proprio build.

# ─────────────────────────────────────────────────────────────────────────────
# Stage 1 · build
# ─────────────────────────────────────────────────────────────────────────────
# Alpine tambem no build: nao muda o tamanho da imagem final (o runtime e o
# nginx), mas alinha com server/Dockerfile e reaproveita a mesma camada base
# ja baixada.
FROM node:24-alpine AS build

ARG APP
ARG VITE_API_URL

RUN test -n "$APP" || (echo "ERRO: --build-arg APP=cliente|restaurante|dono" && false)
RUN test -n "$VITE_API_URL" || (echo "ERRO: --build-arg VITE_API_URL=https://..." && false)

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable

WORKDIR /repo

# Manifests primeiro: a camada de install sobrevive a commits de codigo.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/cliente/package.json ./apps/cliente/
COPY apps/dono/package.json ./apps/dono/
COPY apps/restaurante/package.json ./apps/restaurante/
COPY packages/design-system/package.json ./packages/design-system/
COPY packages/shared/package.json ./packages/shared/
COPY server/package.json ./server/

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter "@mq/${APP}..." --filter .

COPY packages ./packages
COPY apps/${APP} ./apps/${APP}

ENV VITE_API_URL=${VITE_API_URL}
RUN pnpm --filter "@mq/${APP}" build

# A config do nginx e montada AQUI, ainda no stage de build.
#
# Fazer isso no stage de runtime exigiria virar root e voltar pra 101 — e o
# `nginx -t` rodando como root deixa /tmp com dono errado, o que mata o
# processo nao-privilegiado no boot com:
#   open() "/tmp/nginx.pid" failed (13: Permission denied)
#
# A origem da API entra no connect-src do CSP; sem ela o navegador bloqueia o
# proprio fetch do app. O ws:// / wss:// e o Socket.io — o CSP trata websocket
# como uma origem separada da HTTP.
COPY apps/nginx.conf.template /tmp/default.conf.template
RUN API_WS=$(echo "$VITE_API_URL" | sed -e 's|^http://|ws://|' -e 's|^https://|wss://|') \
 && sed -e "s|__API_ORIGIN__|${VITE_API_URL}|g" \
        -e "s|__API_WS_ORIGIN__|${API_WS}|g" \
        /tmp/default.conf.template > /tmp/default.conf

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2 · runtime
# ─────────────────────────────────────────────────────────────────────────────
# nginx-unprivileged: ja vem rodando como uid 101 e escutando na 8080. A imagem
# nginx oficial roda o master como root — evitavel numa imagem que so serve
# arquivo estatico.
FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime

ARG APP

# Nenhum comando roda neste stage: os dois COPY ja entram com o dono correto,
# entao nao ha necessidade de root em momento nenhum.
COPY --from=build --chown=101:101 /tmp/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build --chown=101:101 /repo/apps/${APP}/dist /usr/share/nginx/html

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/health > /dev/null || exit 1
