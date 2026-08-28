---
project: QRO
generated: 2026-05-26
revised: 2026-08-27
category: Food-court multi-cozinha (3 personas: cliente · restaurante · dono)
status: source-of-truth
system: Modernist
---

# QRO — Design System Master

> **Hierarquia:** a referência canônica é o handoff em
> [`modernist/handoff.md`](modernist/handoff.md) e o protótipo
> [`modernist/prototipo.dc.html`](modernist/prototipo.dc.html) (abrir no
> navegador a partir daquela pasta). **Onde este documento e o protótipo
> divergirem, vale o protótipo.** Este MASTER resume o sistema e diz onde cada
> decisão mora no código; `pages/[persona].md` cobre o que é específico de cada
> app.

> **Divergência deliberada do handoff — 2026-08-27.** O handoff manda todo
> `<img>` de conteúdo em preto e branco (`grayscale(1) contrast(1.08)`), pra que
> o vermelho fosse o único portador de cor. **Não seguimos.** Em teste com fotos
> reais ficou claro que prato é vendido pela cor — o dourado da brasa, o verde
> da salada —, e em cinza a comida some justamente na tela cuja função é dar
> vontade. O resto do sistema não mudou: a interface continua monocromática com
> um acento só, e a cor entra apenas pela fotografia. Este é o único ponto em
> que o código diverge do protótipo de propósito.

> **Nota de revisão — 2026-08-27.** O sistema anterior (*Nature Distilled ×
> Editorial Grid*: terracota `#C9532E`, Fraunces itálico, DM Sans, JetBrains
> Mono, verde-mata pra "pronto", cantos arredondados) foi **substituído** pelo
> Modernist. Este arquivo era a fonte da verdade daquele sistema; se você chegou
> aqui procurando `#C9532E` ou `font-display italic`, eles não existem mais em
> lugar nenhum do código. O histórico está no git.

---

## 1. Visão & personalidade

**O quintal vira o restaurante.** Cinco cozinhas, um pedido só.

O sistema não é um "app de delivery". É um espaço físico que ganhou software — e
o software tem que sumir. A tela é usada de pé, com fome, num salão barulhento,
segurando o celular com uma mão. O que ela precisa entregar em meio segundo é:
**o que tem, quanto custa, e se já posso levantar pra buscar.**

| Pilar | O que significa |
|---|---|
| **Grade visível** | Réguas sólidas de 2px separam seções; 1px separa linhas de lista. A hierarquia vem da linha, não da sombra nem do card flutuando. |
| **Raio zero** | Nada é arredondado. Nem botão, nem tag, nem ponto pulsante, nem chave liga/desliga. Bloco é bloco. |
| **Foto sem tratamento** | A foto sai como a cozinha enviou: sem filtro, sem tingimento, sem sobreposição. O acento é a única cor da INTERFACE; a cor da foto é da comida. |
| **Estado é bloco** | Pedido pronto não é um card com borda destacada: é um pôster vermelho sólido com uma frase. |
| **Alinhado à esquerda** | Título, corpo, rótulo e o texto DENTRO dos botões largos, todos na mesma coluna. Valor e ícone vão pro fim com `margin-left: auto`. |

**NÃO** é bento grid, **NÃO** é glassmorphism, **NÃO** é editorial com capitular
e itálico. Menos texto, mais foto, status por cor e progresso gráfico.

---

## 2. Tokens — paleta Modernist

Fonte da verdade em código: `packages/design-system/src/tokens/colors.ts`.
O CSS de referência do handoff está em `modernist/ds/styles.css` — serve pra
conferir valor, não pra copiar cru.

```ts
export const colors = {
  bg:      '#f3f2f2', // fundo de página
  surface: '#eae9e9', // superfícies secundárias (faixa fixa do carrinho)
  ink:     '#201e1d', // tinta padrão
  accent:  '#ec3013', // AÇÃO PRIMÁRIA, célula ativa, pôster de status
  divider: 'rgba(32, 30, 29, 0.40)', // réguas 2px e bordas 1px — a MESMA cor
};

// Rampa neutra
100 #f8f4f4 · 200 #eae7e7 · 300 #d7d3d3 · 400 #bab6b6 · 500 #9b9797
600 #7d7979 · 700 #605d5d · 800 #444141 · 900 #2d2b2b

// Rampa do acento
100 #fff2ef · 200 #ffe0d9 · 300 #ffc4b8 · 400 #ff9783 · 500 #ff563c
600 #dd2b0f · 700 #ae1800 · 800 #7c1405 · 900 #4d170e
```

### Quando usar cada cor

| Papel | Token |
|---|---|
| Ação primária, aba/célula ativa, pôster de pronto | `accent` |
| Hover de sólido / pressed | `accent-600` / `accent-700` |
| Texto vermelho em tamanho de parágrafo | `accent-700` pra cima — **nunca** `accent` puro, que não passa contraste em 13px |
| Fundo lavado (chip de tempo, faixa de observação) | `accent-100`, texto em `accent-800` |
| Meta, rótulo secundário | `neutral-600` / `neutral-700` |
| Etapa concluída, tag de fim de linha (`CANCELADO`, `ESGOTADO`) | `neutral-900` |
| Etapa futura | `neutral-300` |

**Não existe verde nem amarelo de status.** Estado se diferencia por
preenchimento: feito = `neutral-900`, atual = `accent` pulsando, futuro =
`neutral-300`. Os antigos `success`/`warn`/`danger` continuam existindo como
apelidos apontando pra tons desta paleta, só pra não quebrar as telas do dono —
não use em código novo.

---

## 3. Tipografia

**Uma família só: Archivo**, em 400 / 600 / 800.

```
@import url('https://fonts.googleapis.com/css2?family=Archivo:wght@400;600;800&display=swap')
```

- **Títulos, rótulos e botões:** 800. Títulos com `letter-spacing: -0.015em`;
  rótulos e kickers de 10–12px em `uppercase` com `+0.06–0.08em`.
- **Corpo:** 400, 13–15px, `line-height 1.5`. **Nome de item:** 600.
- **Números** (preço, hora, contador, countdown): `font-variant-numeric:
  tabular-nums` — é isso que substituiu o papel do JetBrains Mono. No Tailwind,
  a classe é `tabular`.
- **Não há itálico.** Archivo não tem face itálica nos pesos carregados; o
  navegador sintetizaria uma oblíqua torta. Ênfase é peso.

Escala em `packages/design-system/src/tokens/type.ts`, **em pixel e nunca em
rem**: cada app tem seu próprio `html { font-size }`, e um token em rem faria a
mesma régua de 11px sair com três alturas diferentes.

| Token | Tamanho | Onde |
|---|---|---|
| `display-xl` | 56px | o "~8" da tela de acompanhar |
| `display-lg` | 30px | título de tela — "5 cozinhas abertas." |
| `display-md` | 26px | título de bloco, totais |
| `display-sm` | 24px | título do item aberto |
| `counter` | 26px | contagem do placar da fila |
| `body-lg` / `body` / `body-sm` | 16 / 15 / 13px | nomes, corpo, descrição |
| `meta` | 12px | metadados |
| `label` / `label-sm` / `tag` | 11 / 10 / 9px | rótulos e tags uppercase |

---

## 4. Espaçamento, raio, sombra

- **Espaço:** 4 / 8 / 12 / 16 / 24 / 32px. É a escala do Tailwind com raiz de
  16px — por isso o preset **não** sobrescreve `theme.spacing`, e por isso
  nenhum app customiza `html { font-size }`. `p-4` são 16px em todos os três.
- **Raio: 0 em TUDO.** O preset zera todas as chaves de `borderRadius`,
  inclusive `full`. Sobrou `rounded-round` pro caso raro de precisar de um
  círculo de verdade.
- **Réguas:** seções separadas por 2px (`border-rule`, `border-t-rule`), linhas
  internas de lista por 1px. Mesma cor nos dois pesos.
- **Sombra:** recurso de último caso. `sm 0 1px 2px` · `md 0 3px 10px` ·
  `lg 0 12px 32px`, todas em `rgba(45,43,43,·)`. `lg` só no sheet, que precisa
  se descolar da tela por baixo — ali não há régua entre os dois.

---

## 5. Componentes-base

Todos em `packages/design-system/src/components/`.

### Botão (`Button`)
Archivo 800 uppercase. `fullWidth` alinha à **esquerda** e o valor vai pro fim
com `ml-auto`; sem `fullWidth`, centraliza. Alturas: `sm` 40 · `md` 44 ·
`lg` 52 · `xl` 56.

| Variante | Aparência |
|---|---|
| `primary` | bloco `accent` sólido, texto `bg`; hover `accent-600`, pressed `accent-700` |
| `secondary` | contorno 1px `divider`; hover tinta 7% |
| `ghost` | texto `accent-700`; hover tint do acento |
| `danger` | bloco `neutral-900` sólido — **não** é vermelho: vermelho aqui significa "caminho principal", e destrutivo não é |

`loading` desenha um quadrado que pulsa no ritmo do "ao vivo". Sem spinner.

### Tag (`Chip`)
9–11px Archivo 800 uppercase, `padding: 2px 8px`, sem raio. Quatro variantes:
`solid` (ênfase máxima) · `outline` (contexto) · `tint` (apoio) · `neutral`
(fim de linha: `CANCELADO`, `ESGOTADO`).

### Régua (`Divider`)
`weight="rule"` = 2px, `weight="line"` = 1px. Com `label`, o rótulo fica **acima**
da linha e alinhado à esquerda — nunca no meio dela.

### Pulso (`Pulso`)
Quadrado 8–10px `accent`, opacidade 1 → 0.3 → 1 em 1.6s. **Só** a linha "ao
vivo" e o estágio atual de um pedido. Respeita `prefers-reduced-motion`.

### Barra segmentada (`BarraSegmentada`)
Células de 6px de altura. Substituiu a mini-timeline de quatro rótulos: quem
olha de longe lê a proporção antes de ler qualquer palavra. `invertida` para
sobre o pôster vermelho.

### Sheet / ConfirmSheet
Raio 0, `shadow-lg`, régua de 2px no topo. O slot `topo` põe contexto na mesma
faixa do botão de fechar, pra não gastar duas linhas de chrome antes da foto.

---

## 6. Iconografia

**Lucide** (`lucide-react`), `strokeWidth={2}`, sempre em `currentColor`.
Substituíram os glifos de texto (`✓ ◐ ○ ×`).

Vocabulário em uso: `clock`, `timer`, `flame`, `check`, `plus`, `minus`,
`chevron-left`, `chevron-right`, `bell-ring`, `receipt-text`,
`shopping-basket`, `utensils`, `utensils-crossed`, `banknote`,
`triangle-alert`, `user-round`, `x`.

**Banidos:** emoji como ícone de interface, ícone colorido, ícone preenchido
misturado com contorno na mesma tela.

---

## 7. Movimento

`transition-colors 150ms ease-out` em hover. **Sem animação decorativa.** O
único movimento contínuo é o pulso, e só onde ele significa "isto está
acontecendo agora". Tudo respeita `prefers-reduced-motion` — o global desliga
animação e transição de uma vez, e o pulso ainda leva `motion-reduce:animate-none`
por garantia.

---

## 8. Padrão visual signature

### a) A célula ativa é um bloco
Aba, categoria, placar: o item ativo é `accent` sólido com texto `bg`. Não é
sublinhado nem pílula. Num aparelho segurado com uma mão, o polegar cobre metade
da barra — um traço de 2px é a primeira coisa que some debaixo do dedo.

### b) Numeração em vermelho
Cozinha na grade é `01 Parrilla do Fundo`, com o número em `accent`. Ordena sem
gastar uma linha dizendo "cozinha 1".

### c) O pôster de estado
A informação que pede movimento do corpo — "seu pedido está pronto" — não é um
card destacado: é o bloco inteiro invertido, com uma frase em 26px.

### d) Miniatura no lugar de contagem
"2 itens" em texto virou uma fileira de miniaturas de 44px. O nome fica no
`alt`. É a foto que diz qual pedido é aquele.

### e) Tile do número da mesa
Na fila, a mesa é um quadrado de 54×54 preenchido, com o número em 22px.
Atrasado, o tile fica vermelho e o card ganha contorno da mesma cor.

### f) Foto 4:5 na grade, 1:1 no item, 4:3 no detalhe
Sempre com o espaço reservado mesmo sem foto — senão a grade colapsa de altura
no meio do carregamento e a tela pula.

---

## 9. Acessibilidade — não-negociável

- Alvo de toque ≥ 44px. Onde o desenho pede 40 (voltar, `+` da grade), a área
  toda é clicável e há folga em volta.
- `aria-label` em todo botão só de ícone.
- Foco: `outline: 2px solid accent; offset: 2px`. Nunca o azul do navegador,
  nunca `outline: none` sem substituto.
- Contraste: vermelho pequeno sempre `accent-700` pra cima.
- Estado nunca sai só por cor: vem acompanhado de ícone, rótulo, preenchimento
  ou posição na barra.

---

## 10. Onde cada decisão mora

| O quê | Onde |
|---|---|
| Cores, tipo, espaço, raio, sombra | `packages/design-system/src/tokens/` |
| Preset do Tailwind (rampas, `border-rule`, `.tabular`, pulso) | `packages/design-system/src/tailwind-preset.ts` |
| Base global (Archivo, foco, reduce-motion) | `packages/design-system/src/global.css` |
| Componentes compartilhados | `packages/design-system/src/components/` |
| Telas do cliente (01–06) | `apps/cliente/src/` |
| Fila da cozinha (07) | `apps/restaurante/src/` |
| Referência canônica de desenho | `docs/design-system/qro/modernist/` |

---

## 11. Checklist de entrega (por tela)

- [ ] Nenhuma classe de raio. O padrão já é 0, então a ausência basta; o preset
      zera todas as chaves, mas escrever `rounded-lg` mente pra quem lê depois.
      `rounded-none` só onde ajuda a dizer que aquele canto é deliberadamente
      reto (campo de formulário, sheet, chave liga/desliga)
- [ ] Nenhum itálico, nenhuma segunda família
- [ ] Toda foto de conteúdo passa por `Foto` (espaço reservado + bloco neutro
      quando não há foto) e chega SEM filtro
- [ ] Seções separadas por régua de 2px; listas por 1px
- [ ] Rótulo de botão largo alinhado à esquerda, valor com `ml-auto`
- [ ] Todo número que forma coluna tem `tabular`
- [ ] Ícone Lucide com `aria-hidden`, botão de ícone com `aria-label`
- [ ] Estado legível sem depender de cor
- [ ] Ação secundária como texto-botão 11px 800 uppercase, não como segundo
      botão vermelho

---

## Anti-patterns (resumo)

| Não faça | Faça |
|---|---|
| Card flutuando com sombra | Bloco delimitado por régua |
| Verde pra "pronto", amarelo pra "atrasado" | Preenchimento: escuro = feito, vermelho = agora, claro = futuro |
| Timeline de bolinhas com quatro rótulos | Barra segmentada de quatro células |
| "2 itens" em texto | Fileira de miniaturas |
| Dois ou três botões vermelhos na mesma tela | Um bloco primário + texto-botões |
| Parágrafo explicando o que a tela já mostra | Título de uma frase e o conteúdo |
| Filtro, tingimento ou véu sobre a foto | A foto como veio; a cor da INTERFACE é só o acento |
