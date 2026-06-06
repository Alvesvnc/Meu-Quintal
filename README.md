# Meu Quintal

> Sistema de food-court multi-cozinha. Cinco cozinhas, um pedido só.

O cliente lê um QR na mesa, monta um pedido com itens de várias cozinhas e cada
cozinha recebe **apenas o que é dela** no app. Pagamento direto na cozinha quando
o cliente retira — o app só organiza o pedido e o tempo real entre cliente e
cozinha. O dono do espaço acompanha o quintal inteiro: receita, mesas, repasses,
quem entra e quem sai.

---

## Status

| Camada | O que tem | O que falta |
|---|---|---|
| **Front cliente** (web mobile) | 6 telas + backend real + Socket.io | — |
| **Front restaurante** (web mobile, vira PWA depois) | 7 telas com mocks | Plugar no backend |
| **Front dono** (web responsivo) | 7 telas com mocks | Plugar no backend |
| **Backend cliente** | Fastify + Prisma + Socket.io + Postgres | — |
| **Backend restaurante/dono** | — | Auth (login/senha), endpoints, painel ao vivo |
| **PWA + deploy** | — | Manifesto, service worker, hosting |

---

## Stack

**Front** · React 18 + TypeScript + Vite + Tailwind 3 + Zustand 5 + React Router 6
+ TanStack Query 5 + axios + socket.io-client

**Backend** · Fastify 5 + Prisma 5 + PostgreSQL 16 (Docker) + Socket.io 4 +
Zod + dotenv

**Design** · Fraunces (display) + DM Sans (UI) + JetBrains Mono (números).
Paleta "Quintal" terracota + verde mata + cream.

**Workspace** · npm workspaces (`apps/*` + `packages/*` + `server`).

---

## Estrutura

```
My Quintal/
├── apps/
│   ├── cliente/      · web mobile · porta 5173 · conectado ao backend
│   ├── restaurante/  · web mobile (dark) · porta 5174 · mocks
│   └── dono/         · web responsivo · porta 5175 · mocks
├── server/           · API Fastify · porta 3001 · só cliente por enquanto
├── packages/
│   ├── design-system/  · tokens + componentes + Tailwind preset
│   └── shared/         · tipos do domínio compartilhados front↔back
├── design-system/    · docs do sistema visual (MASTER.md + overrides por persona)
└── docker-compose.yml · Postgres 16
```

---

## Como rodar

### Pré-requisitos

- **Node** 20+
- **Docker Desktop** rodando (pro Postgres)

### Setup inicial (uma vez)

```bash
# 1. Instalar deps de todos os workspaces
npm install

# 2. Copiar env do server
cp server/.env.example server/.env

# 3. Subir Postgres (Docker) + aplicar schema + popular seed
npm run db:up
npm run db:migrate
npm run db:seed
```

### Dia a dia

```bash
# Sobe os 3 apps + server em paralelo, com prefixos coloridos
npm run dev
```

| App | URL |
|---|---|
| Cliente | http://localhost:5173 |
| Restaurante | http://localhost:5174 |
| Dono | http://localhost:5175 |
| Server | http://localhost:3001 |

`Ctrl+C` mata tudo. Postgres continua rodando em background — pare com
`npm run db:down` quando quiser.

---

## Testando o cliente

O cliente entra via QR. Em **dev**, a tela inicial (sem token) tem atalhos
pra entrar como uma mesa específica.

**Tokens disponíveis no seed:** `mesa-1-dev`, `mesa-2-dev`, ..., `mesa-16-dev`

URL: `http://localhost:5173/m/mesa-12-dev` (ou clica num dos atalhos dev).

### Testar o fluxo via API direta

```bash
# Ver cozinhas do quintal
curl -H "Authorization: Bearer mesa-12-dev" \
  http://localhost:3001/api/m/quintal

# Cardápio da Lou Burger
curl -H "Authorization: Bearer mesa-12-dev" \
  http://localhost:3001/api/m/k/lou-burger

# Criar pedido (substitui MENU_ITEM_ID por um id real do cardápio)
curl -X POST -H "Authorization: Bearer mesa-12-dev" \
  -H "Content-Type: application/json" \
  -d '{"items":[{"menuItemId":"MENU_ITEM_ID","qty":2,"note":"sem cebola"}]}' \
  http://localhost:3001/api/m/pedido
```

### Testar real-time (Socket.io)

Com a tela de acompanhamento aberta no navegador, no terminal:

```bash
# Avança status do pedido (novo → preparando → pronto → retirado)
curl -X PATCH -H "Content-Type: application/json" \
  -d '{"kitchenSlug":"lou-burger"}' \
  http://localhost:3001/api/_dev/order/ORDER_UUID/advance
```

A tela do cliente atualiza sozinha (sem reload).

---

## Scripts úteis

| Comando | O que faz |
|---|---|
| `npm run dev` | Sobe os 3 apps + server em paralelo |
| `npm run dev:cliente` | Só o cliente |
| `npm run dev:restaurante` | Só o restaurante |
| `npm run dev:dono` | Só o dono |
| `npm run dev:server` | Só o server |
| `npm run db:up` | Sobe o Postgres (Docker) |
| `npm run db:down` | Derruba o Postgres |
| `npm run db:migrate` | Aplica migrations pendentes |
| `npm run db:seed` | Popular DB com dados de teste |
| `npm run db:studio` | Abre Prisma Studio (GUI do DB) |

---

## Design system

Todas as decisões visuais estão em
[`design-system/meu-quintal/MASTER.md`](design-system/meu-quintal/MASTER.md).

Cada persona tem seu override:

- [`pages/cliente.md`](design-system/meu-quintal/pages/cliente.md) — mobile, sem cadastro, multi-cozinha
- [`pages/restaurante.md`](design-system/meu-quintal/pages/restaurante.md) — mobile/tablet, fila ao vivo
- [`pages/dono.md`](design-system/meu-quintal/pages/dono.md) — web responsivo, admin

Princípio: **tátil + editorial + terra + honesto.** Sem glassmorphism, sem
bento grid, sem gradiente AI, sem ícone-emoji.

---

## Decisões importantes

- **Cliente não tem cadastro.** Entra via QR da mesa. Token efêmero invalida
  quando o dono recria o QR.
- **Cada cozinha = uma comanda separada.** Cliente manda pedidos individuais
  pra cada cozinha. Vê tudo agrupado em `/pedidos`.
- **Pagamento não é via app.** Cada cozinha cobra direto quando o cliente
  retira (cartão, PIX, dinheiro — escolha da cozinha).
- **App restaurante vai virar nativo** (Capacitor) quando o backend dele estiver
  pronto. Distribuição via Google Play.
- **App dono é desktop-first** mas responsivo (drawer no mobile, sidebar no
  desktop). Não vira nativo.

---

## Roadmap próximo

1. Polir UX restante do cliente (estados de erro, vazio, etc)
2. Conectar app restaurante ao backend (auth, painel ao vivo, capturar
   `payment:requested`)
3. Conectar app dono ao backend (auth + endpoints admin)
4. PWA + deploy (Vercel pro front, Railway/Fly pro server)
5. App nativo do restaurante via Capacitor → Google Play
