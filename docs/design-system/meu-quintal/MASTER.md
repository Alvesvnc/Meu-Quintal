---
project: Meu Quintal
generated: 2026-05-26
category: Food-court multi-cozinha (3 personas: cliente · restaurante · dono)
status: source-of-truth
---

# Meu Quintal — Design System Master

> **Hierarquia:** Antes de construir uma página, **leia primeiro** `docs/design-system/meu-quintal/pages/[persona].md`. Se existir, sobrescreve este MASTER. Caso contrário, siga estritamente o que está aqui.

---

## 1. Visão & personalidade

**O quintal vira o restaurante.** Cinco cozinhas, um pedido só.

O sistema não é uma "delivery app". É um espaço físico (uma casa, um pátio, uma esquina) que ganhou software. A linguagem visual deve refletir isso: **calor, mão humana, tipografia com personalidade, materialidade**.

| Pilar | O que significa |
|---|---|
| **Tátil** | Superfícies sólidas, hairlines finas (não shadow pesado), botões com peso. Nada de glassmorphism, nada de vidro fosco. |
| **Editorial** | Tipografia conduz a hierarquia, não cor. Fraunces italic carrega título; números monoespaçados pra valor/qty/tempo. |
| **Terra** | Paleta restrita, quente, com 1 verde mata pra confirmação. Vermelho só pra alerta. |
| **Honesto** | Sem skeumorfismo, sem confeitaria UI. Botão é botão, lista é lista. O design some quando você está com fome. |

**Inspiração visual:** entre *Nature Distilled* (terracota, sand, cream, organic feel) e *Editorial Grid* (asymmetric grid, drop caps, pull-quote em Fraunces italic). **NÃO** é bento grid, **NÃO** é glassmorphism, **NÃO** é "AI native".

---

## 2. Tokens — paleta Quintal

```ts
// design-system/tokens/colors.ts
export const colors = {
  // Brand
  primary:        '#C9532E', // terracota — CTA, marca, foco
  primaryWash:    '#C9532E15', // 8% — fundo seleção, hover sutil
  primaryDeep:    '#A8451E', // hover/pressed
  accent:         '#3F7A4B', // verde mata — sucesso, "pronto", repasse OK
  accentWash:     '#3F7A4B12',

  // Surface
  bg:             '#EFECE5', // creme — fundo geral
  surface:        '#FAF7F0', // off-white — cards
  surfaceDeep:    '#1C1814', // dark — app restaurante (escuridão de cozinha)
  surfaceDeepCard:'#272320',

  // Ink (texto)
  ink:            '#1F1A14', // títulos, valores
  inkMuted:       '#5B5347', // body, descrições
  inkDim:         '#8A7F70', // metadados, labels
  inkInverse:     '#F4EFE6', // texto sobre dark

  // Linhas
  hairline:       '#D9D2C3', // borda card padrão
  hairlineSoft:   '#E8E2D2', // divisor interno

  // Estado
  warn:           '#C68A1A', // amarelo mel — atenção (atraso, esgotando)
  danger:         '#B8341A', // vermelho fogo — cancelar, esgotado
  success:        '#3F7A4B', // = accent
} as const;
```

### Quando usar cada cor

| Token | Uso | NÃO usar pra |
|---|---|---|
| `primary` | CTA principal, foco de input, item selecionado, valor total do carrinho, ícone "pedir" | Texto longo, fundo de página |
| `accent` | Status "pronto", confirmação, repasse pago, sucesso | CTA principal (compete com primary) |
| `warn` | Pedido atrasando, item esgotando (>5 min, <3 unidades) | Estado neutro |
| `danger` | Cancelamento, esgotado, conflito | Confirmação positiva |
| `bg` cream | Fundo geral cliente + dono | App restaurante (usar `surfaceDeep`) |
| `surfaceDeep` | Reservado pra eventual dark mode futuro — não usado hoje | — |

**Regra:** nunca usar mais de **2 acentos** na mesma tela (primary + accent ou primary + warn). Estado é sinalizado por **tipografia + ícone + cor**, nunca só cor.

---

## 3. Tipografia

```ts
// design-system/tokens/type.ts
export const fonts = {
  display: '"Fraunces", Georgia, serif',     // títulos, números grandes em italic
  sans:    '"DM Sans", system-ui, sans-serif', // UI inteira
  mono:    '"JetBrains Mono", ui-monospace, monospace', // valores, IDs, tempo
};

export const fontFeatures = {
  fraunces: "'liga' 1, 'ss01' 1", // ligaturas + alt 'a'
  fraunces_italic: "'liga' 1, 'ss01' 1, 'ss02' 1", // + alt 'e'
};
```

### Hierarquia

| Token | Tamanho | Peso | Fonte | Uso |
|---|---|---|---|---|
| `display-xl` | clamp(40px, 5vw, 56px) | 500 italic | Fraunces | Hero brief, vazio celebrativo |
| `display-lg` | 32px | 500 italic | Fraunces | Título de tela, nome de cozinha |
| `display-md` | 24px | 500 | Fraunces | Seção dentro da tela |
| `body-lg` | 17px | 400 | DM Sans | Body principal mobile |
| `body` | 15px | 400 | DM Sans | Body padrão |
| `body-sm` | 13px | 400 | DM Sans | Metadata, descrição curta |
| `label` | 11px | 500 | DM Sans | UPPERCASE letter-spacing 0.08em, label de campo |
| `mono-lg` | 22px | 500 | JetBrains Mono | Valor total, contador |
| `mono` | 14px | 500 | JetBrains Mono | Preço, ID do pedido, tempo restante |
| `mono-sm` | 11px | 400 | JetBrains Mono | Hex de cor, código de mesa |

### Regras de uso

- **Sempre que houver "1 cozinha", "2 cozinhas"**, plural em **italic Fraunces** se for chamada editorial; sans se for label de UI.
- **Valor monetário**: SEMPRE mono. `R$ 24,90` (vírgula, não ponto).
- **Tempo**: SEMPRE mono. `~12 min` / `3:42`.
- **Não usar** Fraunces non-italic em UI corrida — fica letrado demais. Só em pull-quote, headline editorial, brand mark.
- **Não usar** DM Sans pra valores numéricos.
- **`textWrap: 'pretty'`** em headlines de até 3 linhas; `'balance'` em sub-heads de 1-2 linhas.

---

## 4. Espaçamento, raio, sombra

```ts
export const space = {
  0: 0, 1: 2, 2: 4, 3: 8, 4: 12, 5: 16, 6: 20, 7: 24, 8: 32, 9: 40, 10: 48, 11: 64,
};

export const radius = {
  none: 0,
  sm:   4,   // tags, badges
  md:   8,   // inputs, botões
  lg:   12,  // cards
  xl:   16,  // sheet, dialog
  pill: 999,
};

export const shadow = {
  none: 'none',
  hairline: '0 0 0 1px rgba(31,26,20,0.06)', // preferido — usar em vez de shadow
  soft: '0 1px 2px rgba(31,26,20,0.04), 0 4px 12px rgba(31,26,20,0.04)',
  sheet: '0 12px 32px rgba(31,26,20,0.12)', // só p/ bottom sheet, dialog
};
```

**Filosofia:** preferir **hairline + bg sutil** em vez de shadow flutuante. Sombra só onde algo realmente flutua (sheet, dialog, FAB).

---

## 5. Componentes-base

### Botão

```tsx
// Variantes
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

// Specs
primary:   bg=primary,    text=#FFF,        hover=primaryDeep,  pressed=primaryDeep + scale(0.98)
secondary: bg=surface,    text=ink,         border=hairline,    hover=primaryWash
ghost:     bg=transparent,text=ink,         hover=primaryWash
danger:    bg=danger,     text=#FFF,        hover=#9A2B16

// Tamanhos
sm: h=36, px=12, font=13/500, radius=md
md: h=44, px=16, font=15/500, radius=md  ← default (toque mínimo)
lg: h=52, px=20, font=17/500, radius=md  ← cliente/restaurante (mais toque)
```

**Loading:** desabilita + spinner inline mono à esquerda. **Nunca** sumir com o label.

### Card

```tsx
card-default: bg=surface, border=1px solid hairline, radius=lg, padding=20
card-elevated: + shadow=soft  (só p/ destaque pontual)
card-flush: bg=bg, border=0, padding=0  (lista de cozinhas — card é a foto + nome)
```

### Input

```tsx
h=48, padding=14, radius=md, border=1px solid hairline, font=15/400
focus: border=primary + ring=3px primaryWash
error: border=danger + msg below in body-sm danger
```

### Lista (mais usado no sistema)

```tsx
// Item de lista padrão (pedido, item cardápio, restaurante)
row: padding=16/20, border-bottom=hairlineSoft (último sem)
divider entre seções: 1px hairline + label uppercase letter-spacing
```

---

## 6. Iconografia — anti-genérica

**Regra:** Lucide e Heroicons são proibidos como kit padrão. Usamos um conjunto custom desenhado pro projeto.

### Estratégia

1. **Tipografia substitui ícone** sempre que possível. Ex: status do pedido em mono uppercase (`RECEBIDO`, `PREPARANDO`, `PRONTO`) > emoji-ícone.
2. **Glyphs feitos à mão** quando precisar de ícone: 16/20/24 grid, stroke 1.5px, terminação reta (não round). Pasta `packages/icons/`.
3. **Foto > ilustração**: para cozinhas, prato, mesa — sempre fotografia (real ou stock realista). Nada de ilustração flat genérica.
4. **Marcador editorial**: bullet em mono (`01.`, `02.`) > ícone redundante.

### Banidos
- ❌ Emoji como ícone (🍔, 🎉, ⚠️)
- ❌ Lucide/Heroicons importados direto
- ❌ Glassmorphism / blur / vidro fosco
- ❌ Gradiente roxo→rosa, gradiente AI
- ❌ Bento grid (cards quadrados com ícone grande + título 2 palavras)
- ❌ Ilustração flat "memphis" / "humaaans"
- ❌ Neumorfismo (sombra interna + externa)

---

## 7. Movimento

```ts
duration: { fast: 120, base: 200, slow: 320 };
ease: { out: 'cubic-bezier(0.2, 0.8, 0.2, 1)', spring: 'cubic-bezier(0.34, 1.3, 0.64, 1)' };
```

- **Padrão:** `transition: all 200ms cubic-bezier(0.2,0.8,0.2,1)`.
- Hover: muda **cor** (`primaryWash`) ou **opacity 0.92** — nunca `scale` (causa layout shift).
- Pressed: `scale(0.98)` em botões — só.
- Real-time (status do pedido mudou): pulse curto no item + bump no chip de status. 1x, sem loop.
- **`prefers-reduced-motion: reduce`** → reduzir tudo pra 0ms exceto loaders.

---

## 8. Padrão visual signature — Editorial Grid + Nature Distilled

O elemento que dá identidade ao Meu Quintal sem ser bento:

### a) Headlines em pull-quote

```tsx
// Hero do brief, tela vazia, dialog de confirmação
<h1 className="font-display italic text-display-lg leading-[1.18] text-pretty">
  Cinco cozinhas,
  <span className="text-primary"> um pedido só.</span>
</h1>
```

### b) Drop cap em primeira letra (só em telas-marco)

```tsx
// Tela 01 do cliente (pós-QR), tela onboarding
<p className="first-letter:font-display first-letter:italic first-letter:text-[56px] first-letter:float-left first-letter:mr-2 first-letter:leading-[0.9] first-letter:text-primary">
  Você está na Mesa 12. O quintal hoje tem cinco cozinhas abertas.
</p>
```

### c) Numeração mono editorial

Em vez de ícones-numeradores ou steppers genéricos:
```tsx
<span className="font-mono text-mono text-primary">01.</span> Pós-QR
```

### d) Hairline + label uppercase

Divisor de seção é uma linha hairline + label uppercase letter-spacing — não título Fraunces, não chip colorido:
```tsx
<div className="flex items-center gap-3 my-6">
  <hr className="flex-1 border-hairlineSoft" />
  <span className="text-label uppercase tracking-[0.08em] text-inkDim">Hoje · 19h22</span>
  <hr className="flex-1 border-hairlineSoft" />
</div>
```

### e) Fotografia em formato 4:5 (vertical)

Fotos de cozinha e prato sempre **4:5 vertical** com `object-fit: cover`. Tira o look "delivery app" (que usa quadrado).

---

## 9. Acessibilidade — não-negociável

- Contraste mínimo `4.5:1` em qualquer texto < 18px; `3:1` em texto >= 18px e UI.
  - ✓ verificado: ink/bg=12.4:1, inkMuted/bg=6.8:1, primary/bg=4.6:1, inkInverse/surfaceDeep=11.9:1.
- Touch target mínimo **44×44px** (em cliente/restaurante: **48×48px** porque é mobile primário).
- Foco visível em **TUDO** clicável: ring 3px `primaryWash` + border `primary`.
- Tab order = visual order. Skip-link na home de cada app.
- `prefers-reduced-motion`: respeitar.
- Inputs com `<label for>` sempre (não placeholder-only).

---

## 10. Stack & decisões

| Camada | Tech | Por quê |
|---|---|---|
| Web (3 apps) | React 18 + TypeScript + Vite + Tailwind 4 | Padrão do japtalk, build rápido |
| Estilo | Tailwind + tokens via CSS variables | Tokens vivem em 1 lugar, Tailwind via `theme.extend.colors` lê de `var(--mq-*)` |
| Estado server | TanStack Query | Cache + invalidation explícita |
| Estado client | Zustand | 3 stores: auth, cart (cliente), shift (restaurante) |
| Real-time | Socket.io | Status pedido cliente↔restaurante, fila |
| HTTP | Axios + interceptor (refresh token) | Mesmo do japtalk |
| Validação | Zod (server) + react-hook-form + zodResolver (client) | Schema único, server fonte de verdade |
| Backend | Fastify 4 + Prisma 5 | Mesmo do japtalk |
| DB | PostgreSQL + Redis (cache de fila) | — |
| Auth | JWT (@fastify/jwt) + Argon2 | Cliente é stateless (token de mesa); restaurante e dono têm conta |
| Pagamento | Stripe Connect (multi-vendor split) | Repasse automático por cozinha |
| QR | qrcode (server gera) | Mesa = ID + token efêmero |

---

## 11. Estrutura do monorepo

```
My Quintal/
├── package.json              # workspaces
├── design-system/            # docs (este arquivo)
├── packages/
│   └── design-system/        # tokens + componentes-base compartilhados
│       ├── src/
│       │   ├── tokens/       # colors, type, space, radius, shadow
│       │   ├── components/   # Button, Card, Input, Row, Sheet
│       │   ├── icons/        # SVG custom
│       │   └── index.ts
│       └── package.json
├── apps/
│   ├── cliente/              # web mobile PWA (sem cadastro, QR)
│   ├── restaurante/          # app mobile PWA (dark, fila)
│   └── dono/                 # web desktop admin
└── server/                   # Fastify + Prisma + Socket.io
    ├── prisma/schema.prisma
    └── src/
        ├── modules/{auth,table,kitchen,order,payment,owner}
        ├── plugins/
        └── server.ts
```

---

## 12. Checklist de entrega (por tela)

Antes de marcar uma tela como pronta:

- [ ] Cores via token (`var(--mq-primary)`) — nunca hex hardcoded
- [ ] Fonte via classe `font-display|sans|mono` — nunca `font-family` inline
- [ ] Toques ≥ 44px (cliente/restaurante: ≥ 48px)
- [ ] Foco visível em todos os interativos
- [ ] Estado vazio + erro + loading desenhados (não só happy path)
- [ ] Mobile 375 / tablet 768 / desktop 1280 testados (dono só 1024+)
- [ ] `prefers-reduced-motion` respeitado
- [ ] Sem emoji-ícone, sem Lucide importado direto
- [ ] Texto sem "lorem" — usar copy do domínio (pratos reais, nomes de cozinha plausíveis)
- [ ] Números monetários em mono, vírgula decimal

---

## Anti-patterns (resumo)

| ❌ Não | ✓ Sim |
|---|---|
| Glassmorphism, blur, vidro fosco | Surface sólida + hairline |
| Gradiente AI purple/pink | Cor sólida ou bg sutil `primaryWash` |
| Bento grid de cards quadrados | Lista vertical + editorial hairline divisor |
| Heroicons/Lucide padrão | Glyph custom 1.5px stroke |
| Emoji como ícone | Glyph custom OU label tipográfico |
| Scale-hover (`hover:scale-105`) | `hover:bg-primaryWash` ou `opacity-92` |
| "Loading..." genérico | Skeleton com hairline da forma final |
| Dark mode forçado em todos os apps | Só app restaurante é dark (decisão de domínio) |
| `R$24.90` ponto decimal | `R$ 24,90` vírgula, em mono |
| Lorem ipsum | Copy real do domínio (Lou Burger, R$ 28,00, Mesa 12) |
