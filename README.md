<div align="center">

# Meu Quintal

**Sistema de food-court multi-cozinha — cliente, restaurante, dono.**

![Status](https://img.shields.io/badge/status-em%20desenvolvimento-orange)
![License](https://img.shields.io/badge/license-MIT-blue)
![Node](https://img.shields.io/badge/Node-20%2B-339933?logo=nodedotjs&logoColor=white)

![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/Tailwind-3-06B6D4?logo=tailwindcss&logoColor=white)
![Fastify](https://img.shields.io/badge/Fastify-5-000000?logo=fastify&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-5-2D3748?logo=prisma&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)
![Socket.io](https://img.shields.io/badge/Socket.io-4-010101?logo=socketdotio&logoColor=white)

</div>

---

## Sobre

**Meu Quintal** é um sistema de food-court multi-cozinha desenhado para espaços
físicos que abrigam várias cozinhas independentes (food halls, casas
gastronômicas, pátios). O cliente escaneia o QR da mesa, monta um pedido com
itens de quantas cozinhas quiser, cada cozinha recebe **apenas o que é dela**
em tempo real, e o dono do espaço acompanha o ecossistema inteiro.

O sistema é composto por três aplicações independentes que compartilham um
backend único: **Cliente** (web mobile, sem cadastro), **Restaurante** (mobile,
fila ao vivo) e **Dono do espaço** (web responsivo, administração).

## Sumário

- [Funcionalidades](#funcionalidades)
- [Stack tecnológica](#stack-tecnológica)
- [Arquitetura](#arquitetura)
- [Pré-requisitos](#pré-requisitos)
- [Instalação](#instalação)
- [Execução](#execução)
- [API](#api)
- [Eventos real-time](#eventos-real-time)
- [Design system](#design-system)
- [Decisões de produto](#decisões-de-produto)
- [Scripts disponíveis](#scripts-disponíveis)
- [Roadmap](#roadmap)
- [Estrutura do repositório](#estrutura-do-repositório)
- [Licença](#licença)

## Funcionalidades

### Cliente (web mobile, sem cadastro)

- Autenticação por QR de mesa (token efêmero, sem login)
- Navegação por cozinhas do quintal e seus cardápios
- Carrinho multi-cozinha com snapshot de preço no momento da adição
- Envio de pedidos individuais por cozinha (uma comanda por restaurante)
- Acompanhamento real-time do status de cada pedido via Socket.io
- Solicitação de cobrança ("fechar conta") por cozinha
- Avaliação pós-consumo

### Restaurante (web mobile)

> Telas implementadas com dados mockados — integração com backend pendente.

- Fila de pedidos em tempo real (Novos → Preparando → Prontos)
- Notificação push (mockup) de novo pedido
- Histórico de pedidos do dia
- Edição de cardápio (criar, editar, esgotar, excluir itens)
- Métricas operacionais (carro-chefe, ticket médio, horário de pico)
- Perfil público da cozinha (nome, foto, categoria, descrição)

### Dono do espaço (web responsivo)

> Telas implementadas com dados mockados — integração com backend pendente.

- Visão geral do quintal (receita, pedidos, mesas ocupadas, alertas)
- Gerenciamento de cozinhas (listagem, status, onboarding)
- Financeiro (repasses, comissões, aluguel fixo)
- Mesas e QR codes
- Pedidos ao vivo (visão de espectador, todas as cozinhas)
- Conta e equipe

## Stack tecnológica

### Front-end (três apps)

| Tecnologia | Versão | Função |
|---|---|---|
| [React](https://react.dev) | 18.3 | Biblioteca de UI |
| [TypeScript](https://www.typescriptlang.org) | 5.6 | Tipagem estática estrita (`noUnusedLocals`, `strict`) |
| [Vite](https://vitejs.dev) | 5.4 | Build tool e dev server com HMR |
| [Tailwind CSS](https://tailwindcss.com) | 3.4 | Estilização utility-first com preset compartilhado |
| [React Router](https://reactrouter.com) | 6.27 | Roteamento client-side |
| [Zustand](https://github.com/pmndrs/zustand) | 5.0 | Estado global leve (carrinho, sessão) |
| [TanStack Query](https://tanstack.com/query) | 5.62 | Cache e sincronização de estado servidor |
| [axios](https://axios-http.com) | 1.7 | Cliente HTTP com interceptors |
| [socket.io-client](https://socket.io/docs/v4/client-api/) | 4.8 | Cliente WebSocket para real-time |

### Backend

| Tecnologia | Versão | Função |
|---|---|---|
| [Node.js](https://nodejs.org) | 20+ | Runtime JavaScript |
| [Fastify](https://fastify.dev) | 5.1 | Framework HTTP (mais performático que Express) |
| [Prisma](https://www.prisma.io) | 5.22 | ORM type-safe + migrations |
| [PostgreSQL](https://www.postgresql.org) | 16 | Banco relacional principal |
| [Socket.io](https://socket.io) | 4.8 | WebSocket para eventos em tempo real |
| [Zod](https://zod.dev) | 3.23 | Validação de schemas (body, query, env) |
| [tsx](https://github.com/privatenumber/tsx) | 4.19 | Hot reload do servidor em desenvolvimento |
| [pino-pretty](https://github.com/pinojs/pino-pretty) | 11.3 | Logs legíveis em desenvolvimento |

### Design system

| Tecnologia | Função |
|---|---|
| [Fraunces](https://fonts.google.com/specimen/Fraunces) | Tipografia display (italic preferido), opsz variável |
| [DM Sans](https://fonts.google.com/specimen/DM+Sans) | Tipografia de interface |
| [JetBrains Mono](https://www.jetbrains.com/lp/mono/) | Tipografia monoespaçada (valores, IDs, tempos) |
| Tokens em TypeScript | Cores, espaçamento, raios, sombras — fonte única em `packages/design-system/src/tokens` |
| Preset Tailwind compartilhado | Cada app importa de `packages/design-system/src/tailwind-preset` |

### Workspace e infraestrutura

| Tecnologia | Função |
|---|---|
| [npm workspaces](https://docs.npmjs.com/cli/v10/using-npm/workspaces) | Monorepo nativo (`apps/*`, `packages/*`, `server`) |
| [concurrently](https://github.com/open-cli-tools/concurrently) | Orquestra os quatro processos em `npm run dev` |
| [Docker](https://www.docker.com) + Compose | PostgreSQL para desenvolvimento local |
| [Prisma Studio](https://www.prisma.io/studio) | Interface web para inspecionar o banco |

### Por que essa stack

- **React + Vite + Tailwind** é o trio padrão da indústria para front
  web rápido, com ecossistema maduro e tempo de iteração curto. Os três
  apps compartilham 100% do design system.
- **Fastify ao invés de Express:** API mais moderna, melhor TypeScript,
  performance superior e plugin system robusto.
- **Prisma ao invés de query builder/SQL direto:** schema declarativo,
  migrations versionadas e cliente type-safe gerado a partir do schema.
- **Socket.io ao invés de WebSocket nativo:** abstrai reconexão, fallback
  para polling e gerenciamento de salas (essencial para
  `order:{id}` e `kitchen:{slug}`).
- **Zod no shared package:** mesmo schema validação consumido por server
  (validação de input) e front (validação de form), evitando dessincronização.
- **Tokens em TypeScript:** permite refatoração com auto-complete e
  type-check, e exporta tanto para Tailwind (via preset) quanto para
  estilos inline quando necessário.

## Arquitetura

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│  Cliente (5173) │       │ Restaurante     │       │ Dono (5175)     │
│  React + Vite   │       │ (5174)          │       │ React + Vite    │
│  Mobile-first   │       │ React + Vite    │       │ Responsivo      │
└────────┬────────┘       └────────┬────────┘       └────────┬────────┘
         │                         │                         │
         │  HTTP + WebSocket       │  (mocks)                │  (mocks)
         ▼                         ▼                         ▼
┌────────────────────────────────────────────────────────────────────┐
│                  Backend (Fastify, porta 3001)                     │
│   Auth de mesa  ·  Rotas REST  ·  Socket.io (real-time)            │
└────────────────────────────┬───────────────────────────────────────┘
                             │
                             ▼
                  ┌──────────────────────┐
                  │  PostgreSQL (5433)   │
                  │  Docker compose      │
                  └──────────────────────┘
```

## Pré-requisitos

| Requisito | Versão mínima | Observação |
|---|---|---|
| Node.js | 20 | Veja `engines` no `package.json` |
| npm | 10 | Vem com o Node |
| Docker Desktop | 27 | Para o PostgreSQL local |

## Instalação

```bash
# Clonar o repositório
git clone https://github.com/Alvesvnc/Meu-Quintal.git
cd Meu-Quintal

# Instalar dependências de todos os workspaces
npm install

# Configurar variáveis de ambiente do Docker Postgres (raiz)
cp .env.example .env

# Configurar variáveis de ambiente do server
cp server/.env.example server/.env

# Subir o PostgreSQL via Docker
npm run db:up

# Aplicar migrations e popular o banco com dados de exemplo
npm run db:migrate
npm run db:seed
```

> **Observação sobre porta do Postgres:** o container expõe a porta `5433`
> (não a padrão `5432`) para evitar conflito caso já exista uma instância
> local do Postgres na máquina. Veja `docker-compose.yml`.

## Execução

```bash
# Sobe os três apps + o servidor em paralelo
npm run dev
```

| Aplicação | URL local |
|---|---|
| Cliente | http://localhost:5173 |
| Restaurante | http://localhost:5174 |
| Dono | http://localhost:5175 |
| API | http://localhost:3001 |

Cada workspace pode também ser iniciado isoladamente: `npm run dev:cliente`,
`npm run dev:restaurante`, `npm run dev:dono`, `npm run dev:server`.

### Acessando o cliente

O cliente requer um token de mesa (passado via URL `/m/:tableToken`). Em
ambiente de desenvolvimento, a tela inicial sem token oferece atalhos
para entrar como uma das 16 mesas mockadas pelo seed.

**Tokens disponíveis após o seed:** `mesa-1-dev` até `mesa-16-dev`.

Exemplo: http://localhost:5173/m/mesa-12-dev

## API

Todas as rotas do cliente exigem o header
`Authorization: Bearer <qrToken>`.

### Endpoints

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/api/m/quintal` | Cozinhas ativas do espaço da mesa |
| `GET` | `/api/m/k/:slug` | Cardápio de uma cozinha |
| `POST` | `/api/m/pedido` | Criar pedido |
| `GET` | `/api/m/pedido/:id` | Detalhes de um pedido com timeline |
| `GET` | `/api/m/pedidos` | Pedidos ativos da mesa |
| `POST` | `/api/m/pedidos/fechar-conta` | Solicitar cobrança a uma cozinha |
| `GET` | `/health` | Healthcheck |
| `GET` | `/` | Info do servidor e endpoints disponíveis |

### Endpoints de desenvolvimento

| Método | Rota | Descrição |
|---|---|---|
| `PATCH` | `/api/_dev/order/:id/advance` | Avança o status de um pedido (simula ação do restaurante) |

### Exemplos

```bash
# Consultar o quintal a partir de uma mesa
curl -H "Authorization: Bearer mesa-12-dev" \
  http://localhost:3001/api/m/quintal

# Consultar cardápio de uma cozinha
curl -H "Authorization: Bearer mesa-12-dev" \
  http://localhost:3001/api/m/k/lou-burger

# Criar um pedido
curl -X POST \
  -H "Authorization: Bearer mesa-12-dev" \
  -H "Content-Type: application/json" \
  -d '{"items":[{"menuItemId":"<UUID>","qty":2,"note":"sem cebola"}]}' \
  http://localhost:3001/api/m/pedido

# Solicitar cobrança para uma cozinha
curl -X POST \
  -H "Authorization: Bearer mesa-12-dev" \
  -H "Content-Type: application/json" \
  -d '{"kitchenSlug":"lou-burger"}' \
  http://localhost:3001/api/m/pedidos/fechar-conta
```

## Eventos real-time

O servidor expõe um WebSocket via Socket.io para comunicação em tempo real
entre clientes e restaurantes.

### Salas

| Sala | Quem entra | Propósito |
|---|---|---|
| `order:{orderId}` | Cliente acompanhando um pedido | Recebe atualizações de status |
| `kitchen:{slug}` | Restaurante (quando integrar) | Recebe eventos da própria cozinha |

### Eventos emitidos pelo servidor

| Evento | Sala | Payload |
|---|---|---|
| `order:status` | `order:{orderId}` | `{ orderId, kitchenSlug, status, at }` |
| `payment:requested` | `kitchen:{slug}` | `{ tableNumero, orderIds, totalCents, at, ... }` |

### Eventos esperados do cliente

| Evento | Propósito |
|---|---|
| `order:subscribe` | Entrar em uma sala de pedido |
| `order:unsubscribe` | Sair da sala |
| `kitchen:subscribe` | Restaurante entra na sala da própria cozinha |
| `kitchen:unsubscribe` | Restaurante sai |

### Testando o real-time

Com a tela de acompanhamento aberta no navegador:

```bash
# Avança status do pedido (novo → preparando → pronto → retirado)
curl -X PATCH \
  -H "Content-Type: application/json" \
  -d '{"kitchenSlug":"lou-burger"}' \
  http://localhost:3001/api/_dev/order/<ORDER_UUID>/advance
```

A interface atualiza automaticamente, sem necessidade de reload.

## Design system

O sistema visual completo está documentado em
[`design-system/meu-quintal/MASTER.md`](design-system/meu-quintal/MASTER.md),
com overrides específicos por persona:

- [`pages/cliente.md`](design-system/meu-quintal/pages/cliente.md)
- [`pages/restaurante.md`](design-system/meu-quintal/pages/restaurante.md)
- [`pages/dono.md`](design-system/meu-quintal/pages/dono.md)

Princípios visuais centrais: **tátil, editorial, terra, honesto**. Tipografia
conduz a hierarquia; cor é restrita (terracota + verde mata + cream); ausência
deliberada de glassmorphism, bento grids e gradientes ditos "AI-native".

## Decisões de produto

- **Cliente não possui cadastro.** O acesso é feito exclusivamente via QR
  da mesa. O token é efêmero e invalidado quando o dono recria o QR.
- **Cada cozinha é uma comanda independente.** O cliente envia pedidos
  separados para cada restaurante. A tela de acompanhamento exibe os
  pedidos agrupados por cozinha, com total individual e total geral da mesa.
- **Pagamento não é processado pelo aplicativo.** A cobrança é feita
  diretamente por cada cozinha no momento da retirada (cartão, PIX,
  dinheiro — conforme escolha da cozinha).
- **App restaurante migrará para nativo** (via Capacitor), com publicação
  no Google Play, quando o backend correspondente estiver implementado.
- **App dono é desktop-first e responsivo.** Não há plano de versão nativa.

## Scripts disponíveis

| Script | Descrição |
|---|---|
| `npm run dev` | Sobe os três apps + o servidor em paralelo |
| `npm run dev:cliente` | Apenas o app cliente |
| `npm run dev:restaurante` | Apenas o app restaurante |
| `npm run dev:dono` | Apenas o app dono |
| `npm run dev:server` | Apenas o servidor |
| `npm run build` | Build de produção de todos os workspaces |
| `npm run db:up` | Inicia o container Postgres |
| `npm run db:down` | Para o container Postgres |
| `npm run db:migrate` | Aplica migrations pendentes |
| `npm run db:seed` | Popula o banco com dados de exemplo |
| `npm run db:studio` | Abre o Prisma Studio (GUI do banco) |

## Roadmap

- [x] Estrutura do monorepo e design system
- [x] Front-end completo dos três apps (mockado)
- [x] Backend do cliente (autenticação, REST, real-time)
- [x] Integração front cliente ↔ backend
- [x] Fluxo de fechar conta (cliente → cozinha)
- [ ] Backend e integração do app restaurante (auth, painel ao vivo)
- [ ] Backend e integração do app dono (admin, financeiro)
- [ ] PWA do app restaurante (manifest, service worker)
- [ ] App nativo do restaurante via Capacitor (Google Play)
- [ ] Deploy em produção (front + server)

## Estrutura do repositório

```
.
├── apps/
│   ├── cliente/         # Web mobile, conectado ao backend
│   ├── restaurante/     # Web mobile, mocks
│   └── dono/            # Web responsivo, mocks
├── packages/
│   ├── design-system/   # Tokens, componentes e preset Tailwind
│   └── shared/          # Tipos e schemas compartilhados front↔back
├── server/              # API Fastify + Prisma + Socket.io
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── migrations/
│   │   └── seed.ts
│   └── src/
│       ├── lib/         # env, prisma client, helpers
│       ├── modules/     # rotas por domínio
│       ├── plugins/     # auth de mesa, Socket.io
│       └── server.ts
├── design-system/       # Documentação do sistema visual
│   └── meu-quintal/
│       ├── MASTER.md
│       └── pages/       # Overrides por persona
├── docker-compose.yml   # PostgreSQL para desenvolvimento
└── package.json         # Configuração do monorepo
```

## Licença

Distribuído sob a licença MIT. Veja `LICENSE` para mais informações.

---

<div align="center">
<sub>Construído para espaços que abrigam várias cozinhas e querem operar como um só.</sub>
</div>
