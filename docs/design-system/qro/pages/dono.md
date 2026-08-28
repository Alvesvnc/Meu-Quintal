---
persona: dono
device: web desktop (1280+) — não otimizar mobile, é admin
entry: login + 2FA opcional
auth: JWT + role=owner
---

# Dono do espaço — overrides

> Lê MASTER.md primeiro. Aqui só o que diverge ou especializa.

> **Revisão 2026-08-27 — sistema Modernist.** O app do dono **não foi
> redesenhado**: ele herdou a paleta, a tipografia e o raio zero pelos tokens
> compartilhados, e as telas seguem com a composição antiga. Onde este documento
> disser Fraunces, mono ou terracota, leia Archivo 800, `tabular` e `accent`. A
> composição das telas ainda está por fazer — ver MASTER.md §8.

## Contexto de uso

- **Onde:** mesa de escritório ou laptop no balcão. Calmo, foco analítico.
- **Quem:** pessoa que conhece o negócio inteiro — finanças, contratos, conflito entre cozinhas.
- **Frequência:** sessão diária de 10–30 min + picos no fechamento do mês.
- **Decisões:** repasse, onboarding/offboarding de cozinha, preço de aluguel/comissão, mapa de mesas.

→ **Implicação:** densidade de informação alta, tabelas com sort/filter, atalhos de teclado. Não é touch-first.

## Decisões específicas

### Layout — não é dashboard de SaaS genérico

#### Anti-pattern: bento de KPIs

NÃO É:
```
[REVENUE: R$ 12k ↑]  [ORDERS: 218 ↑]
[AOV: R$ 56,30   ]  [USERS: 0  → ]
```

É (editorial overview):

```
─── HOJE · 26 mai, 21h22 ─────────────────────

  Receita até agora                 Comissão do quintal
  R$ 12.480                         R$ 1.872  · 15%
  ▁▂▃▅▆▇▆▅▃▂▂▁▁    (mini-bar 24h)  ↑ 8% vs. terça passada

  ───────────────────────────────────────────

  5 cozinhas abertas · 218 pedidos · 12 mesas ocupadas

  ─── O QUE EXIGE SUA ATENÇÃO ──────────────

  • Lou Burger atrasando — 4 pedidos > SLA (12 min)
  • Saldo a repassar dia 5/jun: R$ 24.180

  ─── CARROS-CHEFE DO QUINTAL ─────────────

  01. Smash Lou           Lou Burger      42×
  02. Moqueca grande      Cumbuca Caiçara 28×
  03. Pastel de carne     Pasteloka       24×
```

Hierarquia pela tipografia, não por cards isolados. Fraunces nos números grandes. Mono nos contadores.

### Tabelas — primary da interface

- Toda lista é tabela densa, font 14px, row 44px, hairline-bottom em todas.
- Header sticky com sort indicators mono (`↑`, `↓`) discretos.
- Filtro por coluna em popover (não barra de filtros separada).
- Seleção múltipla com checkbox + barra de ação flutuante.
- Paginação: cursor-based, "carregar mais" no fim — não números 1 2 3 4.

### Tipografia (override)

- Body: **14px** (não 17/18 dos mobile — desktop). Linhas mais longas, ratio 1.5.
- Mono usado pesado: dinheiro, ID pedido, CNPJ, %, datas (YYYY-MM-DD).
- Fraunces só em: hero de overview, nome de seção principal, números-âncora da finance ("R$ 24.180").

### Cores específicas

- Mantém paleta MASTER (cream/ink/primary/accent).
- Adicionar: `chart-1..5` derivados — mas evitar gráfico colorido. Preferir **mono-bar + 1 cor primary** quando precisa destacar.
- Status repasse: pendente=warn, pago=accent, atrasado=danger. Em chip mono uppercase.

### Layout shell

```
┌─────────────────────────────────────────────────────────────┐
│  ⌂ QRO · qro.app/admin     Marina · Sair                   │  56px top bar
├──────┬──────────────────────────────────────────────────────┤
│      │                                                       │
│ Side │              Conteúdo                                 │
│ 240px│              max-w 1200px centralizado                │
│      │                                                       │
│      │                                                       │
└──────┴──────────────────────────────────────────────────────┘
```

Sidebar com seções editoriais (não ícones-only):

```
DIÁRIO
  Visão geral
  Pedidos ao vivo
  Mesas

CONFIGURAR
  Restaurantes
  Cardápios
  Mesas & QRs

FINANCEIRO
  Receita
  Repasses
  Comissões

EU
  Conta
  Equipe
  Sair
```

- Item ativo: bg=primaryWash, text=primary, border-left=2px primary. Sem ícone redundante.
- Section header (DIÁRIO, CONFIGURAR…): label uppercase mono 11px dim, mt-6 mb-2.

### Padrões de tela

#### Onboarding novo restaurante (Tela 03)

- **Wizard editorial em 1 página long-scroll**, não em 5 steps separados.
- Cada seção tem hairline divisor + label uppercase + título Fraunces.
- Auto-save ao sair de cada campo (mostra "salvo" mono em primary).
- Foto da cozinha = drop-zone editorial (4:5 vertical), preview real-time.
- Comissão = slider 10–25% + número editável mono. Default 15%.

#### Financeiro (Tela 04)

- Tabs: **Hoje · Mês atual · Histórico**.
- Card de repasse por cozinha = row com:
  - Nome cozinha (Fraunces 18)
  - Bruto (mono)
  - Comissão (mono dim)
  - Aluguel fixo (mono dim, se houver)
  - **A repassar** (mono primary)
  - Status repasse (chip)
  - Botão "Liberar" se cycle fechou
- Exportar CSV no canto = botão ghost.

#### Mesas & QR (Tela 05)

- Layout grid de mesas (mapa simples) — desenho do quintal customizável.
- Cada mesa = cell quadrada 64×64 com número, status (livre/ocupada/precisa-limpar).
- Tap em mesa = side panel direita 320px com: histórico do dia, QR baixável PDF, "reimprimir" / "desabilitar".

### Atalhos teclado

- `/` foca busca global (cmd+k style sem chrome — só input grande overlay)
- `g` então `o` = ir pra Overview, `g r` = Restaurantes, `g f` = Financeiro
- `?` mostra cheatsheet

### O que evitar especificamente no dono

- ❌ Skeleton loading exagerado em tabela — usar **placeholder text inline** "carregando…" mono.
- ❌ Modal pra editar valor — preferir **edit inline** (click no número, vira input).
- ❌ Charts coloridos arco-íris — paleta 1 cor + tons.
- ❌ Cards com "↑ 12% MoM" em todos os KPIs — só onde valor agregado, e em mono.
- ❌ Tour interativo first-time — tooltip discreto em features novas, máximo.
- ❌ Confetes / micro-celebrações no UI ("conseguiu R$ 1k!") — soa fake, prejudica seriedade de financeiro.
- ❌ Dark mode — admin é claro o tempo todo (decisão de domínio — finanças se lê melhor em cream).

## Telas do app dono

| # | Nome | Rota |
|---|---|---|
| 01 | Visão geral ★ | `/admin` |
| 02 | Restaurantes (lista + onboard) | `/admin/restaurantes` |
| 03 | Onboarding novo restaurante | `/admin/restaurantes/novo` |
| 04 | Financeiro | `/admin/financeiro` |
| 05 | Mesas & QR | `/admin/mesas` |
| 06 | Pedidos ao vivo (espectador) | `/admin/pedidos` |
| 07 | Conta / equipe | `/admin/conta` |
