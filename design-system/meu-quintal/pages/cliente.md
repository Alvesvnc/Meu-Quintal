---
persona: cliente
device: mobile web (PWA)
entry: QR code na mesa
auth: nenhuma — token de mesa efêmero
---

# Cliente — overrides

> Lê MASTER.md primeiro. Aqui só o que diverge ou especializa.

## Contexto de uso

- **Onde:** sentado(a) numa mesa do quintal, esperando comer.
- **Quem:** alguém que NUNCA usou o app antes (taxa de novos = 100%, sempre).
- **Mãos:** uma só (a outra segura conversa, criança, copo).
- **Atenção:** dividida — conversa na mesa rola em paralelo.
- **Pressa:** moderada na ida (montar pedido), alta na volta (cadê meu prato).

→ **Implicação:** zero onboarding, zero tutorial, zero "bem-vindo!". A primeira tela JÁ é útil.

## Decisões específicas

### Tipografia mobile-first

- Body padrão: **17px** (não 15px do MASTER) — celular distante 30cm do olho cansado.
- Botão CTA: **lg** (h=52) sempre.
- Nome de cozinha em **Fraunces 22px regular** (não italic — mais legível em scroll rápido).
- Preço em **mono 17px 500**, ink. Total final em **mono 28px 500**, primary.

### Padrões de tela

#### Header sticky minimal
```
┌─────────────────────────────────────────┐
│  ← Mesa 12          ⌕ buscar  · 3 items │  ← chip carrinho conta itens
└─────────────────────────────────────────┘
```
- 56px altura, bg=bg, hairline-bottom, sem shadow.
- Voltar é texto "← Mesa 12" (sempre mostra contexto), não só seta.
- Carrinho é chip mono com número, não badge sobre ícone.

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

- Grid `grid-cols-2 gap-x-3 gap-y-7`, padding lateral 20px.
- Foto 4:5 com `rounded-lg`, hover `opacity-92` (não scale — sem layout shift).
- `01.` em mono primary 13px, baseline alinhada ao nome.
- Nome em **Fraunces 20px regular** (não italic — italic em card pequeno fica letrado).
- Meta `~12 min · R$ 18–46` em **mono 13px dim**, uma linha.
- Tagline truncada em 2 linhas (`-webkit-line-clamp: 2`) — body-sm muted.
- `closingNote` (ex: "fecha 22h") em mono uppercase warn.
- Sem chips de categoria coloridos. Sem rating estrelas (não temos rating ainda).

#### Cardápio de uma cozinha (Tela 02)

- Tabs horizontais sticky (entradas / pratos / sobremesas / bebidas) — **scroll-snap**, sem swipe trick.
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
