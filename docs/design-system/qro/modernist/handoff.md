# Handoff: Redesign "Modernist" — QRO

Guia para implementar o redesign visual nos apps do monorepo `qro-frontend` (React + Vite + Tailwind + pnpm workspaces). Escrito para ser executado pelo Claude Code sem contexto adicional.

## Visão geral

O front atual (Fraunces + DM Sans + JetBrains Mono, paleta terracota/creme) é textual demais. Este redesign troca a identidade pelo sistema **Modernist**: tudo em **Archivo**, vermelho `#ec3013` sobre fundo claro, **grid modular visível**, **raio de canto 0 em tudo**, réguas fortes de 2px, labels sempre alinhados à esquerda (inclusive dentro de botões), fotografia em **preto e branco** e status comunicado por **cor, ícone, miniatura e barra de progresso** — não por texto.

## Sobre os arquivos de design

Os arquivos deste pacote são **referências de design em HTML** (protótipos de aparência e comportamento), **não código de produção**. A tarefa é **recriar estas telas dentro do codebase existente** — React + TypeScript + Tailwind, mantendo a arquitetura atual (hooks de API, stores Zustand, sockets, rotas). Nada da lógica muda; muda o visual e a composição das telas.

- `prototipo.dc.html` — as 7 telas redesenhadas (abra no navegador a partir desta pasta). Os quadros pontilhados são placeholders de foto (componente de mockup `image-slot.js` — ignorar na implementação; no app real são as fotos servidas pela API, ver `apps/cliente/src/lib/fotos.ts`).
- `ds/styles.css` — **fonte da verdade dos tokens** (cores, ramps, tipo, espaçamento, sombras) e das classes base (`.btn`, `.tag`, `.hr`, `.grayscale`…). Portar os valores para o pacote `packages/design-system`; não copiar o arquivo cru.

## Fidelidade

**Alta (hi-fi).** Recriar pixel a pixel: cores, tipografia, espaçamentos, réguas e estados são finais. Onde este README e o HTML divergirem, vale o HTML.

## Tokens de design

### Cores (substituem `packages/design-system/src/tokens/colors.ts`)

| Token | Valor | Uso |
|---|---|---|
| `bg` | `#f3f2f2` | fundo de página |
| `surface` | `#eae9e9` | superfícies secundárias (faixa do carrinho fixo) |
| `text` | `#201e1d` | tinta padrão |
| `accent` | `#ec3013` | AÇÃO PRIMÁRIA, célula ativa, poster de status |
| `divider` | `color-mix(in srgb, #201e1d 40%, transparent)` | réguas 2px e bordas 1px |
| `neutral-100…900` | `#f8f4f4 #eae7e7 #d7d3d3 #bab6b6 #9b9797 #7d7979 #605d5d #444141 #2d2b2b` | ramp neutra |
| `accent-100…900` | `#fff2ef #ffe0d9 #ffc4b8 #ff9783 #ff563c #dd2b0f #ae1800 #7c1405 #4d170e` | tints (100–300), hover (600), texto sobre tint (700–800) |

Regras de uso: acento com moderação (ação primária + ênfase pequena); texto em vermelho tamanho-parágrafo usa `accent-700`, nunca `accent` puro; tints de fundo usam `accent-100`; hover de botão sólido = `accent-600`, pressed = `accent-700`. **Não existe verde/amarelo de status** — estado se diferencia por preenchimento (feito = `neutral-900`, atual = `accent` pulsando, futuro = `neutral-300`).

### Tipografia (substitui Fraunces/DM Sans/JetBrains em `type.ts` + `fonts.css`)

- Uma família só: **Archivo**, pesos 400 / 600 / 800.
  `@import url('https://fonts.googleapis.com/css2?family=Archivo:wght@400;600;800&display=swap')`
- Headings/labels/botões: Archivo **800**, `line-height 1.12`, `letter-spacing -0.015em` (títulos) ou `+0.06–0.08em` + uppercase (labels/kickers de 10–12px).
- Corpo: Archivo 400, 13–15px, `line-height 1.5`. Nomes de item: 600.
- Números (preços, horários, contadores): `font-variant-numeric: tabular-nums` — substitui o papel do JetBrains Mono.
- Escala usada nos mocks: 9–11px labels/tags · 12–13px meta · 14–16px corpo/nomes · 20–28px títulos de tela · 26px contadores da fila · 56px contador "~8 MIN".

### Espaço, raio, sombra

- Espaçamento: `4 / 8 / 12 / 16 / 24 / 32px` (mapear em `space.ts` / preset Tailwind).
- **Raio: 0px em TUDO** (`rounded-none`). Remover todos os `rounded-*` atuais.
- Sombras: `sm: 0 1px 2px rgba(45,43,43,.14)` · `md: 0 3px 10px rgba(45,43,43,.16)` · `lg: 0 12px 32px rgba(45,43,43,.22)`. Usar pouco; a hierarquia vem das réguas.
- Réguas: seções principais separadas por **2px** sólidos na cor `divider`; linhas internas de lista, 1px.

## Regras globais do sistema

1. **Tudo alinhado à esquerda** — títulos, copy e labels dentro de botões largos (`justify-content: flex-start`; valor/ícone à direita via `margin-left: auto`).
2. **Fotos em P&B**: todo `<img>` de conteúdo envolto num wrapper com `filter: grayscale(1) contrast(1.08)` (classe utilitária `grayscale-photo` no preset). Nunca colorizar/tingir imagem.
3. **Ícones Lucide** (`lucide-react`, já compatível com o stack) — stroke 2, em `currentColor`. Substituem os glifos de texto atuais (`✓ ◐ ○`, `×`).
4. Estados: hover de sólido → `accent-600`; hover de outline/ghost → tint `neutral 7%`; `focus-visible { outline: 2px solid accent; offset: 2px }`; disabled 45% opacity. Sem focus azul default.
5. Célula/aba ativa = **bloco sólido `accent` com texto `bg`** (não sublinhado, não pill).
6. Pulso "ao vivo": quadrado 8–10px `accent` + `@keyframes` opacity 1→0.3→1, 1.6s infinite (respeitar `prefers-reduced-motion`).
7. Tags: 9–11px Archivo 800 uppercase, padding `2px 8px`, sem raio — variantes: sólida (`accent`/`bg`), outline (`1px accent`, texto `accent`), tint (`accent-100`/`accent-800`), neutra sólida (`neutral-900`/`bg`).

## Telas

Cada tela abaixo existe no HTML de referência com o mesmo número. Mapa tela → arquivo do repo no fim.

### 01 · Cozinhas (Home cliente) — `LandingScreen.tsx`, `KitchenCard.tsx`, `AppHeader.tsx`, `BottomTabs.tsx`
- **Header**: barra com régua inferior 2px — marca "QRO" (Archivo 800, 16px) à esquerda, tag outline "MESA 07" à direita. Remover o parágrafo com capitular (first-letter) atual.
- **Abertura**: linha "ao vivo" (quadrado pulsante + `AGORA · 19:36` label 11px) e título `5 cozinhas abertas.` (30px, 800, -0.02em). Nada mais de prosa.
- **Grade de cozinhas**: 2 colunas, gap `24×12px`. Card = foto 4:5 P&B → nome com índice em vermelho (`01 Parrilla do Fundo`, 15px 800) → meta 12px `neutral-600` com ícone relógio: `~25 min · R$ 28–74`. Aviso de fechamento = tag sólida `FECHA 22H`. Sem tagline (o texto sai; a foto vende).
- **Tab bar inferior**: grid 2 células, régua superior 2px, ícone 22px + label 11px 800 empilhados e alinhados à esquerda; célula ativa = bloco `accent` sólido; badge de contagem = quadradinho sólido invertido. Altura ≥ 56px.

### 02 · Cardápio — `MenuScreen.tsx`, `MenuItemRow.tsx`, `TabBar.tsx`
- **Topo**: botão voltar 40×40 (borda 1px, chevron-left) + nome da cozinha 800 + tag mesa; régua 2px.
- **Hero**: foto da cozinha full-width, 170px, P&B, régua 2px abaixo. Faixa de meta (11px 800 uppercase): `🔥 BRASA · ⏱ ~25 MIN · R$ 28–74` (ícones Lucide `flame`/`clock`).
- **Seções**: células iguais, 11px 800 uppercase, divisórias 1px; ativa = bloco `accent`. Sticky no scroll (manter `useActiveSection`). Os títulos são escritos pela cozinha (desde 2026-08-27), então a quantidade varia: até 3 numa linha, 4 em 2×2, 5+ em linhas de 3 — a última linha estica para fechar a largura. A conta mora em `lib/gradeDeSecoes.ts`, e a tela desconta essa altura ao rolar até uma seção.
- **Itens em GRADE 2 colunas** (layout novo padrão): foto quadrada P&B → tag opcional (`NOVO` sólida / `ÚLTIMOS 3` outline) → nome 14px 600 → linha preço 15px 800 + **botão `+` 40×40 sólido `accent`** (hover `accent-600`). Item esgotado: opacity .45 + tag neutra sólida `ESGOTADO`, botão disabled. Manter também a variante lista compacta (thumb 64px + nome + preço + botão 44×44) como fallback para cozinhas sem fotos.
- **Barra de carrinho fixa** (aparece com itens): faixa `surface` com régua 2px, contendo botão-bloco `accent`: ícone cesta + `VER CARRINHO · 3` à esquerda, `R$ 114` à direita (tabular).

### 03 · Detalhe do item — `ItemDetailSheet.tsx`
- Topo: voltar 40×40 + kicker da cozinha 12px `neutral-700`.
- Foto 4:3 P&B full-width; abaixo, linha de paginação: quadradinhos 10px (ativo `accent`, demais `neutral-300`) + `1 / 3` à direita; régua 2px.
- Corpo (16px de padding): tag do badge → título 24px 800 → descrição 13px `neutral-700` (máx. 2 linhas) → preço 26px 800 → `.hr`.
- **Quantidade**: label uppercase à esquerda; stepper colado sem gap: `−` 44×44 borda 1px · valor 48×44 (borda topo/baixo, 17px 800 tabular) · `+` 44×44 sólido `accent`.
- **Observações**: label uppercase + input do sistema (36px min, fundo `surface`, borda 1px, caret `accent`), placeholder `ex: sem chimichurri`.
- Rodapé fixo: régua 2px + botão-bloco `accent` 52px: `ADICIONAR` esquerda, `R$ 74` direita.

### 04 · Carrinho — `CartScreen.tsx`, `QtyStepper.tsx`
- Header padrão. Título `Seu pedido.` 26px + sub 12px `3 itens · 2 cozinhas`.
- **Grupo por cozinha**: nome uppercase 12px 800 com régua 2px abaixo. Linha de item: thumb 52px P&B · nome 14px 600 + preço unitário 12px `neutral-600` (`2 × R$ 28`) · stepper compacto 34px (mesma anatomia do 03). Linhas separadas por 1px.
- **Rodapé**: régua 2px; `TOTAL` label uppercase vs `R$ 114` 28px 800 tabular; nota 12px com ícone cédula `Cada cozinha cobra na retirada.`; botão-bloco `MANDAR PEDIDO` + chevron à direita, 52px.

### 05 · Meus pedidos — `OrdersListScreen.tsx` ★ (a tela "80% texto")
Substituir as rows textuais + mini-timeline de bolinhas por blocos gráficos:
- Cabeçalho: linha ao vivo + título `1 pedido pronto.` (28px). Sem parágrafos.
- **Poster PRONTO** (pedido com `status==='pronto'`): bloco **sólido `accent`**, texto `bg`, padding 16 — ícone `bell-ring` 28px + hora 13px na primeira linha; kicker `PARRILLA DO FUNDO · #A2F4` 11px; **`Retire no balcão.` 26px 800**; linha de **miniaturas dos itens 44px** (P&B, é isso que substitui "2 itens" em texto) + `2 ITENS · R$ 90`; barra de progresso segmentada 4×6px (feitos = `bg`, restante = `accent-400`).
- **Card em andamento**: borda 2px `divider`, padding 16 — nome + `#id` 14px 800; chip de tempo tint (`accent-100`/`accent-800`, ícone timer, `~4 MIN`); miniaturas 44px + `2 ITENS · R$ 24`; **barra segmentada 4 células** (recebido `neutral-900` · atual `accent` pulsando · futuras `neutral-300`) com label do estágio atual 11px `accent-700` à esquerda e hora à direita. A barra segmentada substitui a MiniTimeline de 4 rótulos.
- Pedido cancelado: card com tag neutra sólida `CANCELADO`, conteúdo riscado.
- **Rodapé**: régua 2px; `TOTAL DA MESA` vs `R$ 114` 28px; botão outline `FECHAR CONTA · <COZINHA>` com valor à direita (um por cozinha com conta aberta; após solicitar, vira bloco tint `accent-100` com `AGUARDANDO COBRANÇA · há 3 min`). Manter `ConfirmSheet` existente (restilizar: raio 0, título 800, ações flush-left).
- Tab bar com `PEDIDOS` ativo + badge.

### 06 · Acompanhar pedido — `TrackScreen.tsx`
- Topo: voltar + `#A2F4 · MESA 07` 12px.
- **Hero de tempo**: kicker da cozinha em `accent`; **`~8` a 56px 800 + `MIN` 18px** na mesma linha de base + `para ficar pronto` 12px à direita; **barra de progresso 10px** (`accent` sobre `neutral-200`, largura = % do SLA decorrido via `useMinutosDesde`). Quando `pronto`: hero vira poster sólido `accent` "Retire no balcão." (mesmo padrão da tela 05); quando `retirado`: barra cheia `neutral-900` e título `Pedido completo.`.
- **Etapas**: 4 linhas com 1px entre elas — quadrado 30×30 (feito: `neutral-900` + check `bg`; atual: `accent` pulsando + ícone flame; futuro: borda 1px, texto `neutral-500`) · label 14px (600 no feito/atual) · hora tabular à direita (`—` se não houve).
- **Itens**: kicker `ITENS`; linha = thumb 40px P&B + `1×` 13px 800 tabular + nome 14px. Cancelado: opacity .7, nome riscado, tag neutra sólida `CANCELADO` à direita. Ajuste de total = faixa tint `accent-100` com ícone alerta: `Total ajustado: ~~R$ 106~~ → **R$ 90**`.
- Rodapé: pulso + `ATUALIZANDO AO VIVO` 10px. Manter `AlteracaoSheet` (restilizar no sistema: raio 0, countdown 800 tabular, ações em bloco).

### 07 · Fila da cozinha — `QueueScreen.tsx`, `OrderCard.tsx`, `StatusTabs.tsx` (app restaurante)
- Header: nome da cozinha 800 + pulso `ABERTA · 19:36`.
- **Abas de status = placar**: 3 células iguais com **contagem 26px 800** sobre label 11px; ativa = bloco `accent`. Substitui as tabs textuais.
- **Card de pedido**: borda 2px; cabeçalho = **tile da mesa 54×54** (fundo `neutral-900`, número 22px 800; se atrasado, tile `accent`) + `MESA 07` 15px 800 + `#A2F4 · há 4 min` 12px com ícone relógio + tag de status à direita (`NOVO` outline / `ATRASADO` sólida — card atrasado também ganha **borda 2px `accent`**).
- Itens entre réguas 1px: **quadrado de quantidade 30×30** com borda (`1×`, 13px 800) + nome **16px 600** (legível de longe). Observação = faixa tint `accent-100`: `OBS · sem chimichurri` em `accent-800`.
- **Proposta de alteração pendente**: bloco tint `accent-100` com borda 1px `accent`: `AGUARDANDO O CLIENTE` 11px 800 + **countdown `3:12` 17px 800 tabular** (usa `useAgora`); linha `Provoleta: ~~2×~~ → 1×`; nota 11px. No estado "ir na mesa" (`escalonamento.ts`), título vira `VÁ ATÉ A MESA 12` e o bloco escurece (`accent-200`).
- **CTA**: botão-bloco `accent` 52–56px, label à esquerda (`ACEITAR PEDIDO` / `MARCAR PRONTO` + ícone sino / `ENTREGUE`), chevron/ícone à direita. Ações secundárias como texto-botão 11px 800 uppercase (`ALTERAR ITENS · CANCELAR`, hover `accent`).
- Manter som/vibração e sockets como estão.

## Interações & comportamento

- Navegação, rotas, sheets, contadores, socket, vibração: **inalterados** — reusar `useOrders`, `useFila`, `useMinutosDesde`, `useAgora`, stores e mutations existentes.
- Transições: `transition-colors 150ms ease-out` em hovers; sem animações decorativas. Pulso só em "ao vivo"/estágio atual, com `motion-reduce:animate-none`.
- Loading: manter mensagens curtas atuais, restiladas (Archivo 800, flush-left) — sem spinner novo.
- Estados vazios: título 800 grande + uma linha 400 + ação; tom dos textos permanece o atual (misto: direto com toques leves — `Sem pedidos novos. Respira.` fica).
- Acessibilidade: hit targets ≥ 44px; `aria-label` nos botões de ícone; contraste: texto vermelho pequeno sempre `accent-700+`.

## Estado

Nenhum estado novo. Único acréscimo opcional: preferência grade/lista do cardápio (`localStorage`, default grade).

## Plano de execução sugerido (ordem)

1. `packages/design-system`: trocar `fonts.css` (Archivo), `colors.ts`, `type.ts`, `space.ts`, `tailwind-preset.ts` (radius 0, sombras, cores acima); atualizar `Button` (flush-left, raio 0, variantes sólida/outline/ghost), `Chip`→tags, `Divider`→régua 2px, `Sheet`/`ConfirmSheet` (raio 0, elevação `lg`).
2. Adicionar `lucide-react` ao workspace; criar util `grayscale-photo`.
3. App cliente: telas 01→06 na ordem acima.
4. App restaurante: tela 07 (+ aplicar tokens às telas restantes por consistência).
5. Rodar testes existentes (`cart.test.ts`, `escalonamento.test.ts`, `hooks.test.tsx`) — nada de lógica deve quebrar.

## Mapa tela → código

| # | Tela | Arquivos principais |
|---|---|---|
| 01 | Cozinhas | `apps/cliente/src/screens/LandingScreen.tsx`, `components/KitchenCard.tsx`, `AppHeader.tsx`, `BottomTabs.tsx` |
| 02 | Cardápio | `apps/cliente/src/screens/MenuScreen.tsx`, `components/MenuItemRow.tsx`, `TabBar.tsx` |
| 03 | Detalhe do item | `apps/cliente/src/screens/ItemDetailSheet.tsx`, `components/QtyStepper.tsx` |
| 04 | Carrinho | `apps/cliente/src/screens/CartScreen.tsx` |
| 05 | Meus pedidos | `apps/cliente/src/screens/OrdersListScreen.tsx` |
| 06 | Acompanhar | `apps/cliente/src/screens/TrackScreen.tsx`, `components/AlteracaoSheet.tsx` |
| 07 | Fila | `apps/restaurante/src/screens/QueueScreen.tsx`, `components/OrderCard.tsx`, `StatusTabs.tsx` |
| — | Tokens/base | `packages/design-system/src/**` |

## Assets

- Fonte: Archivo (Google Fonts).
- Ícones: Lucide (`lucide-react`): `clock`, `timer`, `flame`, `check`, `plus`, `minus`, `chevron-left`, `chevron-right`, `bell`, `bell-ring`, `receipt-text`, `shopping-basket`, `utensils`, `banknote`, `triangle-alert`.
- Fotos: as reais da API (`fotos.ts`) — apenas ganham o wrapper P&B. Placeholders do mock não vão para produção.

## Arquivos deste pacote

- `prototipo.dc.html` — protótipo das 7 telas (referência visual canônica).
- `ds/styles.css` — tokens + classes base do sistema Modernist.
- `image-slot.js` — suporte do protótipo (ignorar na implementação).
