---
persona: restaurante
device: mobile PWA (iPad-friendly opcional)
entry: login email/senha — 1 conta por cozinha
auth: JWT persistente, biometria opcional
---

# Restaurante — overrides

> Lê MASTER.md primeiro. Aqui só o que diverge ou especializa.

## Contexto de uso

- **Onde:** balcão da cozinha. Ambiente quente, possivelmente com gordura, vapor.
- **Quem:** cozinheiro(a) com mãos ocupadas, atendente que pisca rápido entre cliente e tela.
- **Distância do olho:** 60–100cm (telefone na bancada). Texto **maior**.
- **Iluminação:** forte. Cream com contraste alto (ink/bg 12.4:1) lê bem.
- **Tempo de decisão por toque:** <1s. Se demorar mais, perdeu.
- **Atualização:** real-time crítico. Pedido novo TEM que aparecer em <2s.

→ **Implicação:** UI brutalmente densa em conteúdo, fonte grande, contraste alto, zero perda de tempo em chrome.

## Decisões específicas

### Paleta cream (reversão da decisão dark)

**Atualizado em 2026-05-26:** o app restaurante usa a **mesma paleta cream do cliente** (bg #EFECE5, ink #1F1A14, primary #C9532E, accent #3F7A4B).

A intenção inicial era dark permanente pra reduzir fadiga em cozinha com luz forte. Na prática, validar visualmente mostrou que:
- Continuidade visual entre cliente e restaurante reforça a marca Meu Quintal
- O contraste cream + ink + terracota já é forte o suficiente pra leitura em ambiente iluminado
- Manter dark exigia duplicar tokens (`inkInverse*`, `surfaceDeep*`, `hairlineDark`) e quebrava componentes do design-system

Se no futuro a fadiga visual virar problema real reportado por usuários (cozinheiros usando 8h+ por dia), reabrir essa decisão.

### Tipografia maior + mais densa

- Body base: **18px** (não 17 cliente, não 15 master) — distância maior do olho.
- Nome de item de pedido: **20px** DM Sans 600 (não Fraunces — Fraunces italic mistura mal com leitura rápida em pressão).
- Tempo / cronômetro: **mono 28px 500** primary se >X min limite, inkInverse caso contrário.
- ID do pedido: mono 13px dim, sempre visível (referência verbal: "pedido #2421 sai").
- **Sem Fraunces italic** em UI corrida desse app. Reservar pra header marca + tela vazia.

### Touch maior

- Botão padrão: **lg** (h=52) sempre. Botões de ação crítica em pedido: **xl** (h=64).
- Tap target mínimo: **56×56px** (não 48 do cliente) — luva, gordura, urgência.
- Distância entre botões críticos: ≥ **16px** — evita "pronto" virar "cancelar" por toque sujo.

### Layout-chave: Tela 01 — Fila de pedidos ★

Pedidos em **colunas de status horizontais** (Kanban-style), arrastáveis com tap-and-hold:

```
┌─ NOVOS (3) ────────┬─ PREPARANDO (2) ───┬─ PRONTOS (1) ──────┐
│                    │                    │                    │
│ #2421  Mesa 12     │ #2418  Mesa 04     │ #2419  Mesa 09     │
│ ~3 min             │ ~8 min ◐ pulse    │ pronto 19:38       │
│ ─────────          │ ─────────          │ ─────────          │
│ 1× Smash Lou       │ 2× Cumbuca grande  │ 1× Smash veg       │
│ 1× Smash veg       │ 1× Suco maracujá   │ 1× Batata-doce     │
│ ─────────          │                    │                    │
│ [ACEITAR XL]       │ [PRONTO XL]        │ [RETIRADO XL]      │
└────────────────────┴────────────────────┴────────────────────┘
```

- 3 colunas no portrait do telefone → vira **swipe entre colunas** (mas SEMPRE mostra coluna atual + preview da próxima na borda).
- Cada card de pedido tem **só 1 ação primária** por status. Secundárias (cancelar, contato cliente) via long-press → action sheet.
- Pedido novo entra com **slide + flash primaryWash 1x** + vibração 200ms + (opcional) som curto. Som é toggle nas settings, default ON.
- Cronômetro conta UPWARDS desde aceito ("preparando há 8 min"), não countdown. Atraso = primary quando ultrapassa SLA da cozinha.
- Atraso crítico (> 2× SLA): card ganha border-left 4px primary + chip "ATRASADO" mono uppercase.

### Tela 02 — Push de novo pedido (lockscreen)

- Notificação **rica**: nome cozinha + Mesa + 2 primeiros itens + tempo desde criação.
- Ação rápida na notificação: "Aceitar" (abre app na coluna PREPARANDO scrollada pro item) ou "Não consigo agora" (volta o item pro pool, dispara alerta pro dono).

### Tela 04 — Editar cardápio

- Toggle "esgotado" em cada item: **switch grande à esquerda** do nome (mais usado, fica no thumb-reach).
- Preço editável inline com `mono` — tap abre teclado numérico, vírgula como separador (forçar).
- Adicionar item = FAB primary canto inferior direito, NÃO header.

### Tela 05 — Métricas

- Não é dashboard analytics. É **carro-chefe da semana** + **ticket médio** + **horários de pico** em 3 cards verticais grandes, scroll vertical.
- Gráfico só onde faz sentido (horário): bar chart simples, sem legendas excessivas, eixo Y oculto, valores em mono nos picos.

### Estados especiais

- Sem pedido nenhum: tela centralizada com Fraunces italic "Sem pedidos. Respira." + relógio mono grande mostrando hora atual.
- Conexão perdida: banner sticky topo `danger` + mono "Sem conexão · tentando…" + última atualização em mono.
- Pedido cancelado pelo cliente: card desliza pra fora + toast `warn` "Mesa 09 cancelou · pedido #2417" — não-bloqueante.

### O que evitar especificamente no restaurante

- ❌ Animações decorativas — só feedback funcional (pedido novo, pronto, atraso).
- ❌ Modais bloqueantes pra coisa que pode ser toast (cancelamento de cliente, novo item esgotado).
- ❌ Menu hamburger — navegação é 3 tabs bottom: **Fila · Cardápio · Eu** (mais usado primeiro).
- ❌ Texto fino (font-weight 300/400) — mínimo 400, body é 500.
- ❌ Notificação genérica "Você tem um novo pedido" — sempre rica com conteúdo.
- ❌ Confirmação dupla pra "pronto" / "retirado" — 1 tap basta. Erro raro, undo via swipe é suficiente.

## Telas do app restaurante

| # | Nome | Rota |
|---|---|---|
| 01 | Fila de pedidos | `/r/fila` (default) |
| 02 | Push notificação | OS-level + deep link `/r/pedido/:id` |
| 03 | Histórico do dia | `/r/historico` |
| 04 | Editar cardápio | `/r/cardapio` |
| 05 | Métricas | `/r/metricas` |
| 06 | Conta / sair | `/r/eu` |
