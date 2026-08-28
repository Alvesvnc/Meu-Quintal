---
persona: cliente
device: mobile web (PWA)
entry: QR code na mesa
auth: nenhuma — token de mesa efêmero
---

# Cliente — overrides

> Lê MASTER.md primeiro. Aqui só o que diverge ou especializa.

> **Revisão 2026-08-27 — sistema Modernist.** O MASTER foi reescrito e o
> desenho canônico das telas é o protótipo em
> `../modernist/prototipo.dc.html`. As decisões abaixo que falam de Fraunces,
> DM Sans, JetBrains Mono, terracota, verde-mata, cantos arredondados ou raiz de
> fonte customizada **não valem mais** — ficam registradas por serem o motivo de
> o app ter sido do jeito que era. O que continua valendo está marcado.

## Contexto de uso

- **Onde:** sentado(a) numa mesa do quintal, esperando comer.
- **Quem:** alguém que NUNCA usou o app antes (taxa de novos = 100%, sempre).
- **Mãos:** uma só (a outra segura conversa, criança, copo).
- **Atenção:** dividida — conversa na mesa rola em paralelo.
- **Pressa:** moderada na ida (montar pedido), alta na volta (cadê meu prato).

→ **Implicação:** zero onboarding, zero tutorial, zero "bem-vindo!". A primeira tela JÁ é útil.

## Decisões específicas

### Tipografia mobile-first

**Revisado.** O app rodava com `html { font-size: 17px }` pra compensar a
distância olho-tela. Isso escalava junto TODAS as classes de espaço do Tailwind,
que são rem: `p-4` saía 17px, `h-16` saía 68, e cada régua do desenho errava por
um pixel que ia acumulando. A raiz voltou pros 16px do navegador e a leitura
passou a vir do desenho — foto grande, título de 30px, nome de item em 600.

- Raiz: **16px** (padrão do navegador). Corpo em `text-body` = 15px.
- Botão CTA: **lg** (h=52) sempre. ✅ continua valendo.
- Nome de cozinha: **Archivo 800 16px**, com o índice em `accent`.
- Preço: **Archivo 800** com `tabular`. Total final em `display-md` (26px).

### Padrões de tela

#### Header sticky minimal
```
┌─────────────────────────────────────────┐
│  ← Mesa 12          ⌕ buscar  · 3 items │  ← chip carrinho conta itens
└─────────────────────────────────────────┘
```
**Revisado.** Hoje são dois cabeçalhos, e não um configurável:

- `AppHeader` nas telas que são "casa" (cozinhas, carrinho, pedidos): marca
  `QRO` à esquerda, tag de mesa à direita, régua de 2px embaixo. 56px.
- `TelaHeader` nas telas de dentro (cardápio, item, acompanhar): botão voltar de
  40×40 com moldura + contexto (nome da cozinha, `#A2F4 · MESA 07`).
- O carrinho saiu do cabeçalho: tem célula na barra de baixo e faixa fixa no
  cardápio. Três lugares pra mesma coisa disputavam atenção com o título.

#### Lista de cozinhas (Tela 01) — grade 2 colunas

**Decisão validada em 2026-05-26:** testamos feed editorial vertical vs. grade 2 colunas. Grade ganhou — encaixa mais cozinhas no fold e a foto 4:5 ainda domina sem virar miniatura. Mantém a identidade editorial (`01.` mono, nome Fraunces, tagline curta) mas em densidade que respeita o tempo de quem está com fome.

```
┌──────────┐  ┌──────────┐
│  FOTO    │  │  FOTO    │
│   4:5    │  │   4:5    │
└──────────┘  └──────────┘
01. Lou Bur…  02. Cumbuc…
~12 min ·     ~18 min ·
R$ 18–46      R$ 22–58
Hamb. de      Moqueca,
pasto, bata…  peixe do…
```

A grade continua sendo a decisão. ✅ O que mudou dentro dela:

- Grid `grid-cols-2 gap-x-3 gap-y-6`, padding lateral 16px.
- Foto 4:5 **em P&B**, sem raio, com o espaço reservado mesmo sem foto.
- `01` em `accent`, na mesma linha do nome (sem ponto).
- Nome em **Archivo 800 16px**.
- Meta `~25 min · R$ 28–74` em 12px `neutral-600`, com ícone de relógio.
- **A tagline saiu.** Em duas colunas ela virava duas linhas de cinza por card, e
  o olho passava por seis blocos de texto antes da quinta cozinha. A foto vende.
- `closingNote` vira tag **sólida** `accent` (não havia mais amarelo de aviso).
- Abaixo de 3 cozinhas a tela cai na variante em lista: com duas, a grade
  desperdiça meia tela numa célula vazia.

#### Cardápio de uma cozinha (Tela 02)

- Tabs sticky com as seções que a própria cozinha escreveu (não há mais lista fixa): grade de células iguais que quebra linha, sem rolagem horizontal.
- Item de cardápio = row horizontal: foto 88×88 esquerda, conteúdo+preço direita.
- Adicionar = botão `+` 44×44 à direita do preço (não no card todo — evita add acidental ao tentar abrir detalhe).
- Tap no row inteiro (exceto +) abre detalhe.

#### Carrinho multi-restaurante (Tela 04) ★ tela-marco

Esta é a tela-chave do produto. Override forte:

- **Agrupar por cozinha** com hairline + label uppercase mono entre grupos:
  ```
  ─── LOU BURGER · ~12 min ───
  [item] [item] [item]

  ─── CUMBUCA CAIÇARA · ~18 min ───
  [item]
  ```
- Cada item: nome + qty stepper (- 2 +) + preço mono à direita. Swipe-left revela "remover" (mas botão remover no detalhe também — não esconder só atrás de gesto).
- **Sumário sticky bottom** com:
  - Total em mono 28px primary
  - Sub: "3 itens · 2 cozinhas · tempo estimado **~18 min**" (o maior dos tempos, mono)
  - CTA `lg` "Pagar R$ 86,40" — primary
- **NUNCA** mostrar "frete" / "taxa de serviço" surpresa no checkout. Se houver, mostra desde o carrinho.

#### Acompanhamento ao vivo (Tela 05) ★ tela-marco

- Status por cozinha em colunas verticais (uma seção por cozinha):
  ```
  LOU BURGER ─────────────────── ~6 min restantes
    ✓ Recebido       19:22
    ◐ Preparando     19:24  ← pulse sutil
    ○ Pronto
    ○ Retirado

  CUMBUCA CAIÇARA ────────────── pronto pra retirar
    ✓ Recebido       19:22
    ✓ Preparando     19:23
    ✓ Pronto         19:38  ← chip primary "RETIRE NO BALCÃO"
    ○ Retirado
  ```
- Quando um item fica **pronto**, vibra uma vez (50ms) — só essa vez, só esse evento.
- Sem som (mesa pública, respeito).
- Tempo restante em mono primary se ≤ 5min, ink caso contrário.
- Status nunca regride visualmente — se servidor mandar regressão (raro), animação fade, não pulse.

### Estados vazios

- Tela cardápio sem itens: pull-quote Fraunces italic "Essa cozinha está fechando o turno." + CTA secondary "Voltar pro quintal".
- Carrinho vazio: pull-quote "O carrinho está pronto." + linha sutil "Adicione itens de qualquer cozinha do quintal."
- **NÃO** usar ilustração custom de "carrinho vazio". É ruído.

### Erros
- Pagamento falhou: bottom sheet com title Fraunces "Não rolou.", body curto com motivo real (não "erro genérico"), 2 CTAs lado-a-lado: "Tentar de novo" (primary), "Chamar um humano" (secondary — toca campainha real no balcão do dono).

### O que evitar especificamente no cliente
- ❌ Pedir cadastro/login/email — tela tem que ser usável sem isso. Email/telefone só no fim, pra recibo, opcional.
- ❌ Animações de "adicionou ao carrinho" voando — feedback é bump no chip + haptic 10ms.
- ❌ "Sugerido pra você", "quem comprou X também comprou Y" — primeira sessão, sem dados, fake.
- ❌ Dark mode auto — fundo cream o tempo todo. Cozinha tá iluminada, mesa tá iluminada.
- ❌ Mapa do quintal no MVP — adia. Lista é suficiente.

## Telas do app cliente

| # | Nome | Rota |
|---|---|---|
| 01 | Pós-QR · lista de cozinhas | `/m/:tableToken` |
| 02 | Cardápio de uma cozinha | `/m/:tableToken/k/:kitchenSlug` |
| 03 | Detalhe do item | `/m/:tableToken/k/:kitchenSlug/i/:itemId` (modal sheet, não tela cheia) |
| 04 | Carrinho | `/m/:tableToken/carrinho` |
| 05 | Acompanhamento | `/m/:tableToken/pedido/:orderId` |
| 06 | Avaliação | `/m/:tableToken/pedido/:orderId/avaliar` (após "retirado") |
