<div align="center">

# QRO

**Sistema de pedido em mesa por QR — de um restaurante só a um food-court inteiro.**

![Status](https://img.shields.io/badge/status-em%20desenvolvimento-orange)
![License](https://img.shields.io/badge/license-propriet%C3%A1ria-red)
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

**QRO** é um sistema de pedido em mesa por QR code. O cliente escaneia
o QR, monta o pedido, a cozinha recebe em tempo real e o dono acompanha o
faturamento — sem app para instalar e sem cadastro.

Ele atende dois formatos, e **o plano assinado é o que decide qual**:

| Plano | Cozinhas | Como funciona |
|---|---|---|
| **Restaurante** | 1 | Um espaço, uma cozinha. O dono opera a própria cozinha com **um login só**, e o cliente cai direto no cardápio. |
| **Praça de alimentação** | sem teto | Várias cozinhas independentes no mesmo espaço (food halls, casas gastronômicas, pátios). O cliente pede de quantas quiser num carrinho só, cada cozinha recebe **apenas o que é dela**, e o dono cobra comissão e aluguel de cada uma. |

O teto morde onde importa: quem está no plano Restaurante recebe 402 ao tentar
convidar a segunda cozinha. As regras ficam em `server/src/lib/planos.ts`, num
lugar só.

A decisão é sempre pelo tipo do espaço, nunca por "só tem uma cozinha
cadastrada" — uma praça que hoje tem uma cozinha só continua sendo uma praça.

O sistema é composto por três aplicações independentes que compartilham um
backend único: **Cliente** (web mobile, sem cadastro), **Restaurante** (app instalável,
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
- [Qualidade e CI](#qualidade-e-ci)
- [Deploy](#deploy)
- [Segurança](#segurança)
- [Multi-tenant e modelo de negócio](#multi-tenant-e-modelo-de-negócio)
- [Operação](#operação)
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

### Restaurante (app instalável — tablet, celular ou desktop)

> **Na API.** Todas as telas leem do servidor; `src/mocks/` foi removido.

- Fila de pedidos em tempo real (Novos → Preparando → Prontos)
- Login com e-mail e senha (argon2 + JWT)
- Cardápio: criar, editar, esgotar e excluir itens — excluir **arquiva**, para
  não levar o histórico de pedidos junto
- **As seções do cardápio são escritas pela própria cozinha** — criar, renomear,
  reordenar e apagar. Renomear não move prato de lugar; apagar uma seção com
  pratos dentro exige dizer para onde eles vão
- **Até seis fotos por prato**, enviadas do celular. A primeira é a capa. Toda
  foto é reencodada: some o EXIF (que carrega o GPS de onde foi tirada), cai
  para 1600px e vira webp
- Perfil público da cozinha (nome, foto, categoria, frase, tempo de preparo)
- Pausar o atendimento sem abandonar quem já está na fila — pausar tira a
  cozinha do cardápio e recusa pedido novo, mas **não** tranca o operador para
  fora do app
- Aceitar o convite do quintal: ler o acordo, criar a senha e já entrar
- Histórico de pedidos fechados, por janela de 1, 7 ou 30 dias
- Métricas: carro-chefe, ticket médio, horário de pico e por que ela cancela
- **Instalável**: no tablet vira ícone na tela de início; no Windows ganha janela
  própria, sem barra de endereço, com entrada na barra de tarefas e no Alt+Tab.
  O shell fica em cache; a fila **nunca** — pedido cacheado seria prato feito duas vezes
- **A tela não apaga enquanto a fila está aberta** (Wake Lock), e volta a segurar
  sozinha depois de o aparelho ser desbloqueado
- **Aviso com o app fechado** (Web Push): pedido novo e pedido de conta chegam na
  tela bloqueada. Cada aparelho autoriza o seu, e o aviso **não** aparece quando
  o app já está na frente — ali o sino já tocou

A foto de capa da **cozinha** ainda é uma URL colada à mão — só o item do cardápio tem upload.

### Dono do espaço (web responsivo)

> **Na API.** Todas as telas leem do servidor; `src/mocks/` foi removido.

- Login com e-mail e senha (argon2 + JWT) — **na API**
- Visão geral do dia (faturamento, ticket médio, mesas, o que exige atenção)
- Cozinhas do quintal, com o acordo financeiro de cada uma (sem o movimento
  do dia — isso é da cozinha)
- Convite de cozinha (o link aparece uma vez — não há envio de e-mail ainda)
- Financeiro: o que cada cozinha deve, fechamento de ciclo, baixa manual
- Mesas: o salão agora, com **quanto cada mesa rendeu no mês** em cima dela
- Conta, quintal e troca de espaço
- O plano assinado e o que ele permite — leitura, porque trocar de plano é
  decisão comercial, não um interruptor

Sem tela ainda: convite de equipe e o detalhe de cada cozinha — listados em
`pendencias.txt`. Fila de pedidos do espaço **não** está na lista: é decisão de
produto que o dono não vê pedido.

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
| [pnpm workspaces](https://pnpm.io/workspaces) | Monorepo (`apps/*`, `packages/*`, `server`), versão fixada em `packageManager` |
| [concurrently](https://github.com/open-cli-tools/concurrently) | Orquestra os quatro processos em `pnpm dev` |
| [ESLint 10](https://eslint.org/) + [Prettier 3](https://prettier.io/) | Lint em flat config; Prettier cuida só de formatação |
| [Vitest 3](https://vitest.dev/) | Testes, um projeto por workspace |
| [GitHub Actions](https://docs.github.com/actions) | CI em `.github/workflows/ci.yml` |
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
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
│  Cliente (5173) │   │ Restaurante     │   │ Dono (5175)     │
│  React + Vite   │   │ (5174)          │   │ React + Vite    │
│  Mobile-first   │   │ React + Vite    │   │ Responsivo      │
└────────┬────────┘   └────────┬────────┘   └────────┬────────┘
         │                     │                     │
    HTTP + WS            HTTP + WS                  HTTP
   (integrado)           (integrado)             (integrado)
         │                     │                     │
         ▼                     ▼                     ▼
┌────────────────────────────────────────────────────┴───────────────┐
│                  Backend (Fastify, porta 3001)                     │
│                                                                    │
│   /api/m/*   auth por qrToken da mesa                              │
│   /api/r/*   auth por JWT de cozinha    ─┐  mesmo segredo, o campo  │
│   /api/a/*   auth por JWT de dono       ─┘  `kind` separa os dois   │
│                                                                    │
│   Socket.io: handshake autenticado, salas por ID                   │
│   Rate limit · Helmet · error handler · /health e /ready           │
└────────────────────────────┬───────────────────────────────────────┘
                             │
                             ▼
                  ┌──────────────────────┐
                  │  PostgreSQL (5433)   │
                  │  Docker compose      │
                  └──────────────────────┘

Isolamento: Account ─┬─ Space ─┬─ Table   (qrToken)
                     │         └─ Kitchen (JWT de cozinha)
                     └─ AccountUser       (JWT de dono)

Nenhuma query atravessa Account. Ver "Multi-tenant e modelo de negócio".
```

## Pré-requisitos

| Requisito | Versão mínima | Observação |
|---|---|---|
| Node.js | 20 (CI usa 24) | Veja `engines` e `.nvmrc` |
| pnpm | 10 | `corepack enable` usa a versão fixada em `packageManager` |
| Docker | 27 | PostgreSQL local e imagem de produção do server |

## Instalação

```bash
# Clonar o repositório
git clone https://github.com/Alvesvnc/Meu-Quintal.git
cd Meu-Quintal

# Instalar dependências de todos os workspaces
corepack enable
pnpm install

# Configurar variáveis de ambiente
# (o Postgres de desenvolvimento não precisa de nada: as credenciais são
#  padrão no docker-compose.yml, e batem com a DATABASE_URL deste arquivo)
cp server/.env.example server/.env

# Subir o PostgreSQL via Docker
pnpm db:up

# Aplicar migrations e popular o banco com dados de exemplo
pnpm db:migrate
pnpm db:seed
```

> **Observação sobre porta do Postgres:** o container expõe a porta `5433`
> (não a padrão `5432`) para evitar conflito caso já exista uma instância
> local do Postgres na máquina. Veja `docker-compose.yml`.

## Execução

```bash
# Sobe os três apps + o servidor em paralelo
pnpm dev
```

| Aplicação | URL local |
|---|---|
| Cliente | http://localhost:5173 |
| Restaurante | http://localhost:5174 |
| Dono | http://localhost:5175 |
| API | http://localhost:3001 |

Cada workspace pode também ser iniciado isoladamente: `pnpm dev:cliente`,
`pnpm dev:restaurante`, `pnpm dev:dono`, `pnpm dev:server`.

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

> Registrados **apenas** quando `NODE_ENV=development`. Não têm autenticação —
> por isso ficam fora do ar em qualquer outro ambiente.

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

### Alteração de pedido

A cozinha não altera o pedido direto — ela **propõe** e o cliente decide.

```
cozinha            POST /api/r/pedido/:id/alteracao      { reason?, itens[] }
   │                                                      qtyProposta 0 = cancelar
   ▼  socket: order:alteracao
cliente            tela interrompe, com som e vibração
   │
   ▼               POST /api/m/pedido/:id/alteracao/:aid/aceitar | recusar
cozinha            socket: order:alteracao-respondida
```

| Regra | Por quê |
|---|---|
| **Só reduz** | Aumentar seria a cozinha vendendo o que o cliente não pediu |
| **Recusar cancela o item inteiro** | "Não aceito 1 no lugar de 2" só pode significar "então não quero" |
| **Sem resposta em 5 min vale como recusa** | Nada é entregue sem o cliente ter concordado. Constante `EFEITO_DA_EXPIRACAO` |
| **A fila não trava** | Os itens não afetados seguem sendo preparados. Comida não espera notificação ser lida |
| **Uma proposta pendente por vez** | Duas abertas alterariam os mesmos itens por baixo uma da outra |

O aviso é **in-app**: socket, som (WebAudio) e vibração (Android). Não depende
de permissão nem de instalação. Web Push alcançaria a tela apagada, mas no iOS
exige adicionar o site à tela de início — ver `pendencias.txt`.

Enquanto a proposta está aberta, a cozinha vê no próprio card o que propôs e um
contador regressivo; o botão de alterar some, porque o servidor recusaria uma
segunda proposta com 409.

Cancelar ou propor alteração exige **categoria** de motivo, não texto livre:
"acabou o pão", "sem pão" e "pao acabou" são a mesma causa escrita de três
jeitos, e nenhum número sai disso. O texto livre continua existindo ao lado,
com outra função — é o que o cliente lê. Escolhendo "outro", o texto vira
obrigatório, senão ele viraria a escolha padrão por ser a mais rápida.

A cozinha vê o resultado em `GET /api/r/metricas/cancelamentos`, exposto na
`MetricsScreen`: o que mais faz cancelar e quanto deixou de ser vendido.

Uma varredura a cada 30s (`plugins/cron.ts`) encerra o que venceu. Ela roda
dentro do próprio processo e é segura com várias réplicas **sem lock
distribuído**: o `updateMany` é condicional a `status: 'pendente'`, então quem
chega depois leva `count: 0` e não toca em nada. `CRON_ENABLED=false` desliga.

## Eventos real-time

O servidor expõe um WebSocket via Socket.io para comunicação em tempo real
entre clientes e restaurantes.

### Handshake (obrigatório)

A conexão é recusada sem credencial. Veja [Segurança](#segurança) para o
raciocínio completo.

```ts
io(API_BASE, { auth: { kind: 'mesa', token: qrToken } });      // app cliente
io(API_BASE, { auth: { kind: 'cozinha', token: jwt } });       // app restaurante
```

### Salas

| Sala | Quem entra | Conferência no servidor |
|---|---|---|
| `order:{orderId}` | Cliente acompanhando um pedido | O pedido precisa ser **daquela mesa** |
| `kitchen:{slug}` | Restaurante | O slug precisa bater com o do **JWT** |

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

Com a tela de acompanhamento aberta no navegador (só funciona com
`NODE_ENV=development` — a rota `_dev` não é registrada fora disso):

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
[`docs/design-system/qro/MASTER.md`](docs/design-system/qro/MASTER.md),
com overrides específicos por persona:

- [`pages/cliente.md`](docs/design-system/qro/pages/cliente.md)
- [`pages/restaurante.md`](docs/design-system/qro/pages/restaurante.md)
- [`pages/dono.md`](docs/design-system/qro/pages/dono.md)

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

### Desenvolvimento

| Script | Descrição |
|---|---|
| `pnpm dev` | Sobe os três apps + o servidor em paralelo |
| `pnpm dev:cliente` | Apenas o app cliente |
| `pnpm dev:restaurante` | Apenas o app restaurante |
| `pnpm dev:dono` | Apenas o app dono |
| `pnpm dev:server` | Apenas o servidor |
| `pnpm build` | Build de produção de todos os workspaces |

### Qualidade

| Script | Descrição |
|---|---|
| `pnpm check` | **Portão do CI**: typecheck + lint + testes |
| `pnpm typecheck` | `tsc` em todos os workspaces |
| `pnpm lint` | ESLint (flat config em `eslint.config.mjs`) |
| `pnpm lint:fix` | ESLint com `--fix` |
| `pnpm test` | Vitest, todos os projetos |
| `pnpm test:watch` | Vitest em modo watch |
| `pnpm test:coverage` | Cobertura via v8 (relatório em `coverage/`) |
| `pnpm format` | Prettier `--write` no repositório |
| `pnpm format:check` | Prettier em modo verificação |

### Banco

| Script | Descrição |
|---|---|
| `pnpm db:up` | Inicia o container Postgres |
| `pnpm db:down` | Para o container Postgres |
| `pnpm db:migrate` | Aplica migrations pendentes |
| `pnpm db:seed` | Popula o banco com dados de exemplo |
| `pnpm db:studio` | Abre o Prisma Studio (GUI do banco) |
| `pnpm db:generate` | Regenera o Prisma Client |
| `pnpm --filter @mq/server db:deploy` | Aplica migrations em produção (`migrate deploy`, sem prompt) |

## Qualidade e CI

O portão é um comando só:

```bash
pnpm check   # typecheck + lint + testes — o mesmo que roda no CI
```

O workflow `.github/workflows/ci.yml` roda em todo push na `main` e em todo PR,
em cinco jobs:

| Job | O que garante |
|---|---|
| `check` | typecheck, lint, os 506 testes e build de todos os workspaces |
| `migrations` | As migrations aplicam **num Postgres real e vazio**, o `schema.prisma` bate com elas, e o seed roda |
| `isolamento` | Sobe o server contra um Postgres real **com dois tenants** e roda 20 verificações de vazamento entre clientes |
| `image-server` | A imagem do server monta **e o container sobe respondendo `/health`** — imagem que builda mas não sobe não serve de nada |
| `image-front` | As três imagens de app montam e servem: `/health`, favicon, **SPA fallback** e 404 de asset |

O job `image` só publica no GHCR em push (nunca em PR de fork, que não tem — nem
deveria ter — credencial de registry).

### Como os testes são organizados

| Camada | Onde | O que prova |
|---|---|---|
| Funções puras | `lib/*.test.ts`, `stores/*.test.ts` | Cálculo de cobrança, agregação de status, carrinho, validação de env |
| Rotas HTTP | `modules/*.test.ts` | Guardas de auth, papéis, tipo de token, validação de body — com Prisma mockado, sem banco |
| Isolamento real | `server/scripts/isolamento.mjs` | 20 ataques de um tenant contra outro, contra Postgres de verdade |

Teste de rota usa `buildApp({ socket: false, logger: false })` + `fastify.inject()`.
O `socket: false` é obrigatório: com o Socket.io ligado, os handles ficam
abertos e a suíte não encerra.

O mock de Prisma (`src/test/prismaMock.ts`) não simula o Postgres — ele existe
para inspecionar o `where` que cada rota monta. É no `where` que mora o
isolamento multi-tenant, e uma query sem `accountId` é exatamente o vazamento.

### Convenções

- **Um gerenciador só.** `pnpm`, versão travada em `packageManager`. Rodar `npm
  install` aqui gera um `package-lock.json` conflitante — não faça.
- **Dependências internas usam `workspace:*`**, não `*`. Com `*` o pnpm tentaria
  baixar `@mq/shared` do registry público, onde ele não existe.
- **Testes moram ao lado do código** (`src/**/*.test.ts`), não numa pasta
  `__tests__` separada.
- **Prettier não opina sobre código, só sobre formato.** `eslint-config-prettier`
  desliga as regras de estilo do ESLint pra os dois não brigarem.

### Débito técnico

Zerado em 2026-08-24. O ESLint roda com **0 erros e 0 warnings**, e as regras do
React Compiler (`purity`, `set-state-in-effect`, `refs`, `exhaustive-deps`)
estão como `error` — não como aviso.

O que resta está em [`pendencias.txt`](pendencias.txt), com contexto. O único
item de higiene aberto: `pnpm format` nunca rodou no repositório (~95 arquivos
fora do padrão). Deve ir num commit isolado, senão o diff de formatação enterra
o resto.

## Deploy

O server vai pra produção como imagem Docker. O build é feito da **raiz** do
monorepo, não de dentro de `server/` — o `pnpm-lock.yaml` mora lá e sem ele não
há instalação reproduzível.

```bash
docker build -f server/Dockerfile -t qro-server .
```

### Como a imagem é montada

| Etapa | O que acontece |
|---|---|
| Manifests primeiro | Só os `package.json` + lockfile são copiados antes do install, então a camada de dependências sobrevive a commits de código |
| `pnpm build` | esbuild empacota o server num bundle único, **inlinando `@mq/shared`** |
| `pnpm deploy --legacy --prod` | Gera uma árvore autocontida com `dist` + `prisma` + `node_modules` de produção |
| `prisma generate` no `/deploy` | O deploy reinstala do zero e não traz o client gerado — sem este passo o container sobe sem `.prisma/client` |
| Runtime | `node:24-alpine` (469 MB), usuário `node` (uid 1000), `dumb-init` como PID 1 |

> **Por que bundle e não `tsc`:** `@mq/shared` exporta TypeScript cru
> (`main: src/index.ts`). O `tsc` deixaria `import '@mq/shared'` intacto no
> `dist`, e em runtime o Node resolveria para um `.ts` — que só funciona por
> causa do type stripping do Node 24 e desaparece numa imagem que não carrega o
> código-fonte do monorepo.

> **Alpine, verificado.** A base pesa 135 MB contra 331 MB do `bookworm-slim`.
> Foi testado contra Postgres real que `argon2` e o engine musl do Prisma
> funcionam. Build e runtime precisam usar a **mesma libc** — o engine é
> compilado no build e copiado para o runtime.

> **Por que `dumb-init`:** o Node como PID 1 ignora `SIGTERM` por padrão. Sem ele
> o orquestrador acaba matando no timeout, o shutdown gracioso nunca roda e as
> conexões em voo são cortadas no meio.

### Front-end

Os três apps viram imagem nginx a partir do mesmo Dockerfile parametrizado:

```bash
docker build -f apps/Dockerfile   --build-arg APP=cliente   --build-arg VITE_API_URL=https://api.qro.com.br   -t qro-cliente .
```

> **`VITE_API_URL` é build-time, não runtime.** O Vite substitui
> `import.meta.env.VITE_API_URL` por texto literal dentro do bundle. Passar a
> variável no `docker run` não tem efeito nenhum — cada ambiente precisa do
> próprio build. No compose ela aparece em `build.args`, não em `environment`,
> justamente por isso.

Cada imagem tem ~74 MB, roda como uid 101 (`nginx-unprivileged`) e serve:

| Caminho | Comportamento |
|---|---|
| `/assets/*` | `Cache-Control: immutable, max-age=1y` — o Vite põe hash no nome |
| `/health` | Liveness para o orquestrador |
| qualquer outra | **SPA fallback** para `index.html`, com `no-cache` |

O SPA fallback não é opcional: sem ele, abrir ou recarregar `/m/{qrToken}`
devolve 404 do nginx — o cliente que escaneia o QR da mesa cai numa página de
erro.

A CSP é montada no build a partir do mesmo `VITE_API_URL`, incluindo o
`wss://` derivado (o navegador trata websocket como origem separada). Se a URL
usada no build divergir da API real, o app carrega e não consegue falar com ela
— e o erro só aparece no console do navegador.

> Se preferir Vercel/Netlify/Cloudflare Pages, nada disso atrapalha: é conectar
> o repositório, apontar o build para `apps/<app>` e configurar o rewrite de SPA
> na plataforma.

### Subir a stack completa (VPS / homologação)

```bash
cp .env.prod.example .env.prod     # preencher os segredos e o VITE_API_URL
docker compose -f docker-compose.prod.yml --env-file .env.prod --profile with-db up -d --build
```

Sobe cinco serviços: `postgres`, `migrate` (one-shot), `server`, `cliente`,
`restaurante` e `dono`. Os apps publicam em `127.0.0.1:8081-8083` por padrão —
quem fala com a internet e termina TLS é o reverse proxy na frente.

O `--profile with-db` sobe um Postgres junto. Em provedor gerenciado (Fly,
Railway, Render, ECS), omita o profile e aponte `DATABASE_URL` para o banco do
provedor.

O serviço `migrate` roda `prisma migrate deploy` e sai; o `server` só sobe depois
que ele termina com sucesso — assim nunca se serve tráfego com schema
desatualizado.

> Os dois compose têm nome de projeto próprio (`qro-prod` no de
> produção). Sem isso o compose herda o nome do diretório e o `postgres` de
> produção substitui o container de desenvolvimento na mesma máquina.

### Probes

| Rota | Papel | Toca o banco? |
|---|---|---|
| `GET /health` | **Liveness** — o processo está vivo? Se falhar, reiniciar o container | Não, de propósito |
| `GET /ready` | **Readiness** — dá para mandar tráfego? Se falhar, tirar da rotação | Sim (`SELECT 1`) |

A separação é deliberada: um `/health` que consulta o banco faz o orquestrador
**matar o container** a cada indisponibilidade do Postgres, quando o correto
seria apenas parar de rotear.

### Configuração recusada no boot

Com `NODE_ENV=production`, o server **se recusa a subir** se:

- `JWT_SECRET` tiver menos de 32 caracteres ou for um valor de exemplo
- `CORS_ORIGINS` contiver `*`, apontar para `localhost`/`127.0.0.1`, ou usar `http://`

Todos os problemas são reportados de uma vez, não um por tentativa de deploy.
Gere o segredo com `openssl rand -base64 48`.

### Checklist antes do primeiro deploy

- [ ] `JWT_SECRET` gerado com `openssl rand -base64 48` e guardado no cofre de secrets do provedor
- [ ] `CORS_ORIGINS` com os domínios https reais dos três apps
- [ ] `TRUST_PROXY=true` **apenas** se houver reverse proxy/ingress na frente — sem proxy, qualquer um forja `X-Forwarded-For` e escapa do rate limit
- [ ] Postgres com backup automático configurado (o `docker-compose.prod.yml` não faz backup)
- [ ] TLS terminando no proxy (nginx/Caddy/Traefik) ou no load balancer do provedor
- [ ] `SERVER_PORT` em `127.0.0.1` quando houver proxy, para não expor a porta direto

## Segurança

| Camada | O que faz |
|---|---|
| **Rate limit** | 300 req/min por IP no global; **10/min no `POST /api/r/auth/login`**, onde cada tentativa custa um `argon2.verify` |
| **Helmet** | `nosniff`, `X-Frame-Options`, HSTS (só em produção) |
| **CORS** | Lista explícita de origens; `*` é recusado no boot |
| **Body limit** | 256 KB — o maior pedido legítimo tem alguns KB |
| **Redaction de log** | `authorization` e `cookie` viram `[redigido]`; sem isso todo request logaria o qrToken da mesa e o JWT da cozinha em texto puro |
| **Error handler** | 5xx desconhecido devolve só `{ error, requestId }` — erro de driver carrega host, query e às vezes credencial |
| **Load shedding** | Event loop travado por mais de 1s passa a recusar tráfego novo |
| **Rota `_dev`** | Só é registrada com `NODE_ENV=development`; ela não tem autenticação |

### Autenticação do Socket.io

Cada conexão precisa se identificar no handshake:

```ts
io(API_BASE, { auth: { kind: 'mesa' | 'cozinha', token } })
```

E a entrada em sala é conferida contra essa identidade:

- `order:{orderId}` — só a mesa **dona** do pedido entra
- `kitchen:{slug}` — só a cozinha **daquele slug** entra

Sem isso qualquer pessoa entraria em `kitchen:{slug}` de terceiros e assistiria
ao movimento de uma cozinha concorrente em tempo real.

Trocar de mesa (`TableEntryScreen`) e deslogar (`AuthGuard`) derrubam o socket:
o handshake antigo carrega a credencial antiga e continuaria autorizado.

## Multi-tenant e modelo de negócio

O sistema é um **SaaS**: cada cliente pagante é uma `Account`, e tudo abaixo
dela pertence a esse cliente e não pode ser visto por nenhum outro.

```
Account  (o cliente pagante — plano, status, equipe)
  └── Space  (o espaço físico — tipo, comissão padrão, dia de fechamento)
        ├── Table    (mesa, acessada por QR)
        └── Kitchen  (uma casinha, com acordo financeiro próprio)
```

### O faturamento da cozinha não é do dono

O dono só vê quanto uma cozinha vendeu quando o acordo tem **comissão**. Aí o
bruto é a base do que ele cobra — e sem ele a cozinha não teria como conferir a
conta. Com aluguel fixo, não aparece: R$ 3.000 de aluguel são R$ 3.000 tenha ela
vendido dez pratos ou mil.

O consentimento é o próprio acordo. Aceitar um convite com comissão já autoriza;
não existe um segundo checkbox, e não deve passar a existir.

A linha não é "dinheiro se esconde". É **nunca identificar quanto é de cada
restaurante**. Onde a resposta quebra por cozinha, a regra vale; onde ela é um
agregado do espaço, conta tudo.

| Rota | O que faz |
|---|---|
| `GET /api/a/cozinhas` | Configuração. Nome, status e acordo à mostra; o **movimento do dia** vem `null` — nem com comissão. Exceção: a cozinha que o próprio usuário opera. |
| `GET /api/a/financeiro` | Quebra por cozinha. O bruto do **ciclo** só aparece com comissão, porque aí é a base da conta. O total do rodapé soma só o visível. |
| `GET /api/a/overview` | Agregado do espaço. Conta todas as cozinhas. |
| `GET /api/a/mesas` | Agregado do espaço. Conta todas as cozinhas. |
| `GET /api/a/mesas/desempenho` | Agregado do espaço. Conta todas as cozinhas. |

**Pedido nenhuma delas mostra.** Não existe fila do espaço, sala de socket do
dono, nem campo que diga *o que* foi pedido — só contagem e valor. O que cada
mesa pediu, de quem e quando é operação do restaurante; o dono aluga o ponto,
não acompanha o balcão dos inquilinos. No **restaurante único** isso não é
limitação: lá o dono é a cozinha, e o mesmo login abre a fila no app do
restaurante.

O que sustenta o segundo grupo é a **ausência de quebra por cozinha** na
resposta — não há o que identificar. Há testes conferindo as chaves de cada uma
e procurando slug de cozinha no JSON inteiro: se alguém acrescentar um
`porCozinha` ali, eles caem e a regra passa a valer naquela rota também.

Por que a mesa conta tudo: filtrar por acordo faria a mesa boa da cozinha
só-aluguel parecer fraca no ranking, e o dono mudaria o salão de lugar por causa
de um número errado.

Duas coisas que parecem detalhe e não são:

**Oculto é `null`, nunca `0`.** Zero se lê como "essa cozinha não vendeu nada" —
o dono concluiria que ela está morrendo e agiria em cima disso.

**No financeiro, o total soma só o visível.** Esconder linha por linha e
totalizar todo mundo no rodapé se desfaz com uma subtração na mesma tela; praça
de alimentação tem poucas cozinhas, então é conta de guardanapo. Por isso os
totais de lá vêm com `grossParcial` e `cozinhasOcultas`.

**Custo assumido.** Somando as mesas e subtraindo o total visível do financeiro
chega-se à *soma* das cozinhas ocultas: com duas ou mais, não identifica
nenhuma; com uma só, identifica ela. A troca foi feita de olhos abertos — o dono
precisa do desempenho do salão mais do que esse caso custa.

A regra mora em `server/src/lib/faturamento.ts`, num lugar só. `KitchenCharge`
congela o `chargeCommission` do mês, então um ciclo fechado sob aluguel fixo
continua protegido mesmo que a comissão seja ligada depois.

### Um login para quem é dono e cozinha ao mesmo tempo

No restaurante único, o dono **é** o operador da cozinha. Exigir duas contas e
dois apps para tocar o próprio negócio seria inaceitável, então `AccountUser`
pode carregar um `kitchenId`: com esse vínculo, o token de dono também abre
`/api/r/*`.

A assimetria é proposital e não deve ser "simplificada":

| Direção | Vale? |
|---|---|
| Dono → cozinha | Sim, e só com o vínculo **reconferido no banco** a cada request — o token vale sete dias e pode ter sido revogado nesse intervalo. |
| Cozinha → dono | **Nunca.** Não existe caminho, e não deve passar a existir. |

Descer de privilégio dentro da própria conta é seguro; subir não seria. No modo
restaurante único a comissão e o aluguel nascem desligados — não faz sentido
cobrar de si mesmo, e deixar ligado encheria o financeiro de dívidas do dono
com ele próprio.

### Regra de isolamento

Nenhuma query pode atravessar `Account`. Toda rota resolve o escopo a partir da
credencial e filtra por ele:

| Credencial | Caminho até o escopo |
|---|---|
| `qrToken` da mesa | `Table` → `Space` |
| JWT da cozinha | `Kitchen` → `Space` |
| JWT do dono | `AccountUser` → `Account` |

Em `modules/admin.ts` isso é centralizado no helper `espacoDaConta()`. Buscar um
`Space` por id ou slug sem conferir a conta é o vazamento clássico de
multi-tenant — os updates usam `updateMany` com `spaceId` no `where` justamente
por isso.

> **Dois totais, de propósito.** `Order.totalCents` é o que foi **pedido** —
> snapshot histórico que não se reescreve. `totalAtivoCents()` é o que se
> **paga**: soma `qty × preço` dos itens não cancelados, então acompanha
> cancelamento e redução de quantidade sozinho. Toda soma de dinheiro nova usa
> a segunda; somar a primeira só é correto quando a pergunta for literalmente
> "quanto foi pedido originalmente".

> **`Kitchen.slug` é único por quintal, não no sistema.** Dois clientes podem ter
> cada um a sua `lou-burger`. É por isso que as salas de Socket.io são
> endereçadas por **ID** (`lib/salas.ts`) — com slug, as duas cairiam na mesma
> sala e uma veria os pedidos da outra.

> **Os dois JWT compartilham o `JWT_SECRET`.** Sem o campo `kind` no payload, um
> token de cozinha seria criptograficamente válido nas rotas do dono. Os dois
> plugins de auth conferem `kind` explicitamente.

### O dinheiro não passa pelo app

Cada cozinha cobra direto do cliente no próprio caixa. No fim do ciclo, **a
cozinha deve** comissão + aluguel ao dono do quintal — por isso o modelo se
chama `KitchenCharge` (cobrança) e não *payout*. O app nunca segura dinheiro de
terceiro, o que evita a implicação regulatória de intermediar pagamento.

O acordo é por cozinha, com comissão e aluguel **independentes**:

| Campo | Efeito |
|---|---|
| `chargeCommission` | Liga/desliga a comissão |
| `commissionPct` | `null` herda `Space.defaultCommissionPct` |
| `chargeRent` | Liga/desliga o aluguel da casinha |
| `rentCents` | Valor fixo mensal |

Dá para cobrar só um, os dois ou nenhum — o caso da cozinha âncora que entra sem
cobrança no primeiro ano. O cálculo vive em [`lib/cobranca.ts`](server/src/lib/cobranca.ts),
é função pura e tem 22 testes.

### Ciclo de cobrança

Enquanto o mês corre, `GET /api/a/financeiro` calcula **ao vivo** a partir dos
pedidos. `POST /api/a/financeiro/fechar` congela: grava uma `KitchenCharge` por
cozinha com os valores do acordo vigente naquele momento.

O snapshot é proposital — renegociar a comissão depois não pode mexer no que já
foi cobrado. O fechamento recusa mês em andamento e recusa fechar duas vezes.

### Papéis

| Papel | Pode |
|---|---|
| `owner` | Tudo, incluindo fechar ciclo e mexer no plano |
| `admin` | Opera o quintal e o financeiro, sem mexer em conta/plano |
| `staff` | Salão: mesas e pedidos ao vivo. **Não** vê financeiro |

Conta `suspensa` (inadimplente) continua lendo, mas não escreve — o
`exigeContaAtiva` devolve `402`. Conta `cancelada` não loga.

### Rotas do dono

| Método | Rota | Papel mínimo |
|---|---|---|
| `POST` | `/api/a/auth/login` | pública |
| `GET` | `/api/a/auth/me` | staff |
| `GET` | `/api/a/overview` | staff |
| `GET` | `/api/a/cozinhas` | staff |
| `PATCH` | `/api/a/cozinhas/:slug/acordo` | admin |
| `POST` | `/api/a/cozinhas/convite` | admin |
| `GET` | `/api/a/financeiro?refMonth=AAAA-MM` | admin |
| `POST` | `/api/a/financeiro/fechar` | **owner** |
| `PATCH` | `/api/a/cobrancas/:id` | admin |
| `GET` | `/api/a/mesas` | staff |
| `PATCH` | `/api/a/mesas/:numero` | staff |

### Verificando o isolamento

Há um segundo tenant de teste e uma sonda que tenta 20 ataques plausíveis de um
cliente contra o outro:

```bash
pnpm --filter @mq/server seed:tenant2      # cria o 2º cliente do SaaS
pnpm --filter @mq/server isolamento        # roda a sonda
```

Ela cobre: dono enxergando só o próprio quintal, acesso cruzado por slug,
escrita no acordo do outro, papéis dentro da conta, token de um app usado no
outro, e mesa de um quintal abrindo o outro.

Isso roda no CI, no job `isolamento` — com Postgres real e os dois tenants
semeados antes.

## Operação

| Assunto | Onde |
|---|---|
| Banco: provedor, restore, dados sensíveis | [`docs/runbook-banco.md`](docs/runbook-banco.md) |
| Logs, request id, métricas, alertas | [`docs/observabilidade.md`](docs/observabilidade.md) |
| Histórico de versões | [`CHANGELOG.md`](CHANGELOG.md) |

### Banco de dados

Produção usa **Postgres gerenciado**. O serviço `postgres` do
`docker-compose.prod.yml` está atrás do profile `with-db` e serve para
desenvolvimento e homologação — **ele não tem backup**.

Antes do primeiro cliente pagante, leia o runbook: ele lista o que exigir do
provedor (PITR, retenção, restore self-service) e o procedimento de teste de
restore. Backup que nunca foi restaurado não é backup.

### Onboarding de um cliente novo

`db:seed` **apaga o banco** e existe só para desenvolvimento. Para criar uma
conta de verdade existe o `bootstrap`, que vai junto no bundle e roda na imagem
de produção:

```bash
docker run --rm   -e DATABASE_URL="$DATABASE_URL"   -e CONTA_SLUG=quintal-ubatuba   -e CONTA_NOME="Quintal Ubatuba"   -e DONO_EMAIL=roberto@exemplo.com   -e ESPACO_SLUG=ubatuba-centro   -e ESPACO_NOME="Quintal Ubatuba · Centro"   -e PLANO=praca   -e MESAS=16   ghcr.io/<org>/<repo>/server node dist/bootstrap.js
```

Cria conta, dono, quintal e mesas com `qrToken` aleatório. Recusa slug ou
e-mail já usados.

**Nenhuma senha é gerada.** O dono recebe um link de uso único para criar a
própria — por e-mail se o Resend estiver configurado, ou impresso no terminal
para você mandar à mão. A conta nasce sem senha utilizável, então o link é a
única entrada.

`PLANO` é obrigatório e é ele que decide o formato — não há `TIPO`, porque o
tipo do espaço é consequência do plano:

```bash
-e PLANO=praca          # várias cozinhas, entram por convite
-e PLANO=restaurante -e RESTAURANTE_NOME="Cantina da Rosa"
```

No plano Restaurante a cozinha nasce junto, já vinculada ao dono e com a
cobrança desligada — não se cobra comissão de si mesmo.

Tudo numa transação só: conta sem dono é conta em que ninguém consegue entrar,
e não há rota para consertar isso depois.

### Observabilidade

Toda resposta traz `x-request-id`; em 5xx ele também vem no corpo. É o que liga
a reclamação do usuário ao log.

`GET /metrics` serve métricas Prometheus — latência por rota e contadores de
negócio (pedidos criados por quintal, logins falhados, ciclos fechados). Fica
**desabilitada por padrão**: só existe com `METRICS_TOKEN` definido, e responde
404 sem o token.

O **Sentry** está integrado e **desligado** — enquanto `SENTRY_DSN` estiver
vazio, não há requisição de rede nem custo. Só 5xx desconhecido vira evento, e
o `beforeSend` apaga `authorization`, `qrToken`, senhas e hashes antes de
qualquer envio (14 testes cobrem isso). Ver
[`docs/observabilidade.md`](docs/observabilidade.md).

### Versionamento

A versão que vale é a do `package.json` da raiz, injetada no bundle pelo esbuild
e servida em `GET /`. Os workspaces ficam em `0.0.1` de propósito — são
privados e nunca publicados. Ao lançar, crie a tag `vX.Y.Z`; o CI publica a
imagem com ela.

## Roadmap

**Os três apps falam com a API.** Não sobrou mock em nenhum deles.

- [x] Estrutura do monorepo e design system
- [x] Backend do cliente (autenticação, REST, real-time)
- [x] App do cliente ligado na API, com fechar conta
- [x] App do restaurante ligado na API — fila, cardápio, perfil, métricas
- [x] App do dono ligado na API — visão geral, cozinhas, financeiro, mesas
- [x] Multi-tenant: `Account` acima de `Space`, isolamento em toda query
- [x] Alteração de pedido pela cozinha, com resposta do cliente
- [x] Upload de foto no cardápio
- [x] Convite de cozinha do início ao fim, e primeiro acesso por link
- [x] Planos (`restaurante` / `praca`) decidindo formato e teto de cozinhas
- [ ] **Cobrança da assinatura** — sem provedor de pagamento, ninguém assina
      sozinho; hoje quem cria conta é um operador rodando `bootstrap`
- [x] Recuperar senha, com o link expirando em uma hora e derrubando as
      sessões abertas
- [ ] **Deploy em produção** — imagens prontas, provedor de banco não escolhido
      e nenhum backup restaurado ainda
- [ ] Alertas lendo o `/metrics`
- [x] PWA do app restaurante — instalável no tablet e no desktop, com o
      shell em cache e a API sempre na rede
- [x] Web push do restaurante — aviso de tela apagada, com a inscrição do
      aparelho morrendo junto com a sessão na troca de senha
- [ ] App nativo do restaurante via Capacitor (Google Play)

O que falta em detalhe, com o porquê de cada decisão, está em
[`pendencias.txt`](pendencias.txt).

## Estrutura do repositório

```
.
├── .github/workflows/
│   └── ci.yml               # typecheck · lint · test · build
├── apps/
│   ├── cliente/             # Web mobile, conectado ao backend
│   ├── restaurante/         # Web mobile, na API
│   ├── dono/                # Web responsivo, na API
│   ├── Dockerfile           # imagem nginx, parametrizada por APP
│   └── nginx.conf.template  # SPA fallback, cache e CSP
├── packages/
│   ├── design-system/       # Tokens, componentes e preset Tailwind
│   └── shared/              # Tipos e schemas compartilhados front↔back
├── server/                  # API Fastify + Prisma + Socket.io
│   ├── prisma/              # só o que é do Prisma
│   │   ├── schema.prisma
│   │   ├── migrations/
│   │   └── seed.ts
│   ├── scripts/
│   │   ├── seed-tenant2.ts  # 2º cliente do SaaS, pra provar o isolamento
│   │   └── isolamento.mjs   # sonda: 20 ataques de um tenant contra o outro
│   ├── src/
│   │   ├── lib/             # regras puras: planos, faturamento, cobranca,
│   │   │                    # orderStatus, alteracao, imagem, email, senha…
│   │   ├── modules/         # rotas por domínio (admin.ts = app do dono)
│   │   ├── plugins/         # security, observabilidade, auth, socket
│   │   ├── test/            # prismaMock compartilhado pelos testes de rota
│   │   ├── app.ts           # buildApp() — monta sem escutar (testável)
│   │   ├── bootstrap.ts     # cria conta de cliente novo (vai no bundle)
│   │   └── server.ts        # entrypoint: escuta, sinais, shutdown
│   ├── build.mjs            # bundle esbuild — inlina @mq/shared
│   ├── Dockerfile           # multi-stage, roda como uid 1000
│   └── tsconfig.json
├── docs/
│   ├── runbook-banco.md     # provedor, restore, dados sensíveis
│   ├── observabilidade.md   # logs, request id, métricas, alertas
│   └── design-system/       # Documentação do sistema visual (.md)
│       └── qro/
│           ├── MASTER.md
│           └── pages/       # Overrides por persona
├── .vscode/                 # formatOnSave, TS do workspace, extensões
├── CHANGELOG.md
├── LICENSE                  # proprietária — não é código aberto
├── pendencias.txt           # o que falta, com contexto (ler antes de retomar)
├── docker-compose.yml       # PostgreSQL para desenvolvimento
├── docker-compose.prod.yml  # stack de produção (name: qro-prod)
├── .dockerignore
├── .env.prod.example
├── eslint.config.mjs        # flat config, um bloco por contexto
├── vitest.config.ts         # um projeto de teste por workspace
├── pnpm-workspace.yaml      # membros do workspace + allowBuilds
├── .prettierrc.json
├── .editorconfig
├── .nvmrc
└── package.json             # scripts do monorepo
```

## Licença

**Software proprietário. Todos os direitos reservados.** Este não é um projeto
de código aberto — veja [`LICENSE`](LICENSE).

Nenhuma licença de uso é concedida. Copiar, modificar, redistribuir ou executar
este software para fins comerciais exige autorização prévia e por escrito dos
titulares.

As dependências de terceiros continuam regidas pelas respectivas licenças
próprias; a relação está nos `package.json` e no `pnpm-lock.yaml`.

---

<div align="center">
<sub>Construído para espaços que abrigam várias cozinhas e querem operar como um só.</sub>
</div>
