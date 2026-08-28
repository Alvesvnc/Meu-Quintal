# Observabilidade

Quando alguém disser "deu erro ontem à tarde", deve existir um caminho de uma
linha até a resposta.

## As peças

| Peça | Onde | Responde |
|---|---|---|
| `x-request-id` | header de toda resposta | "qual log é o desta requisição?" |
| Log JSON | stdout (pino) | "o que aconteceu nessa requisição?" |
| `/metrics` | Prometheus | "isso é geral ou foi só com essa pessoa?" |
| Sentry | serviço externo, **opcional** | "o que quebrou e em que linha?" |

As três primeiras não dependem de conta em lugar nenhum e funcionam sozinhas. O
Sentry é opcional e vem desligado — ver [a seção dele](#sentry).

## request id

Toda resposta traz `x-request-id`. Em 5xx ele também vem no corpo:

```json
{ "error": "Erro interno.", "requestId": "req-1a2b" }
```

Se um proxy à frente já mandou `x-request-id`, o valor dele é preservado — é o
que costura o rastro entre serviços. Senão, usa o id do Fastify.

**No suporte:** peça o `requestId` da tela de erro. Com ele, achar o log é
trivial; sem ele, é procurar por horário e torcer.

## Ler os logs

O log é JSON de uma linha (pino). Em desenvolvimento sai formatado por
`pino-pretty`; em produção sai cru, para o agregador.

```bash
# tudo de uma requisição específica
docker logs qro-server 2>&1 | jq 'select(.reqId == "req-1a2b")'

# só os erros
docker logs qro-server 2>&1 | jq 'select(.level >= 50)'

# requisições acima de 500ms
docker logs qro-server 2>&1 | jq 'select(.responseTime > 500) | {url: .req.url, ms: .responseTime}'

# tentativa de usar token de um app no outro (sinal de sondagem)
docker logs qro-server 2>&1 | jq 'select(.msg | test("token de outro tipo"))'

# tentativa de acesso cruzado entre tenants
docker logs qro-server 2>&1 | jq 'select(.msg | test("tentou assinar"))'
```

> `authorization` e `cookie` saem como `[redigido]`. É de propósito: eles
> carregam o qrToken da mesa e o JWT da cozinha. Se você vir um token em claro
> no log, é bug — conserte antes de qualquer outra coisa.

## Métricas

`GET /metrics`, formato Prometheus. **Desabilitada por padrão**: só existe se
`METRICS_TOKEN` estiver definido, e exige esse token.

```bash
METRICS_TOKEN=$(openssl rand -hex 32)
curl -H "Authorization: Bearer $METRICS_TOKEN" https://api.seudominio.com.br/metrics
```

Sem o token a rota responde **404**, não 401 — um 401 confirmaria que há
métricas ali. `/metrics` expõe rotas, volumes e uso de memória: é
reconhecimento pronto para quem estiver sondando.

### O que é coletado

**Infra** (prefixo `mq_`, padrão do `prom-client`): CPU, memória, event loop,
GC, handles abertos.

**HTTP:**

```
mq_http_request_duration_seconds_bucket{method,route,status}
```

`route` é o template do Fastify (`/api/m/pedido/:id`), nunca a URL concreta —
usar a URL criaria uma série por pedido e explodiria a cardinalidade.

**Negócio:**

| Métrica | Para quê |
|---|---|
| `mq_pedidos_criados_total{space}` | Volume por quintal. Queda súbita = algo quebrou no fluxo do cliente |
| `mq_logins_falhados_total{app}` | Pico = ataque de força bruta ou tela de login quebrada |
| `mq_ciclos_fechados_total` | Confirma que o fechamento mensal rodou |

### Alertas que valem a pena

Ainda não configurados — precisa de um Prometheus/Grafana lendo o endpoint.

```promql
# 5xx acima de 1% por 5 minutos
sum(rate(mq_http_request_duration_seconds_count{status=~"5.."}[5m]))
  / sum(rate(mq_http_request_duration_seconds_count[5m])) > 0.01

# p95 do pedido acima de 1s
histogram_quantile(0.95,
  sum by (le) (rate(mq_http_request_duration_seconds_bucket{route="/api/m/pedido"}[5m]))) > 1

# força bruta no login
sum(rate(mq_logins_falhados_total[5m])) > 1

# nenhum pedido em 30 min no horário de pico
sum(increase(mq_pedidos_criados_total[30m])) == 0
```

## Sentry

**Desligado por padrão.** Enquanto `SENTRY_DSN` estiver vazio, nada acontece:
sem requisição de rede, sem hook, sem custo.

```bash
SENTRY_DSN=https://<chave>@o<org>.ingest.sentry.io/<projeto>
SENTRY_ENVIRONMENT=producao
SENTRY_TRACES_SAMPLE_RATE=0
```

No boot o server diz em qual estado está: `Sentry ativo (traces 0)` ou
`Sentry desligado (SENTRY_DSN vazio)`.

### Divisão de trabalho

| Pergunta | Ferramenta |
|---|---|
| "quanto e por quanto tempo" | `/metrics` (Prometheus) |
| "o que quebrou e em que linha" | Sentry |

Não são redundantes. O alerta vem da métrica; a causa, do Sentry.

### O que é enviado — e o que não é

Só **5xx desconhecido**. Ficam de fora, de propósito:

- 4xx (401 de token expirado, 429 de rate limit, 400 de validação) — é
  comportamento correto, não defeito
- 503 do load shedding — já é sinal de carga, e a métrica cobre melhor

Isso não é preciosismo: **no plano free a cota é fixa e o excedente é
descartado.** O momento de maior geração de eventos é justamente o do
incidente — um loop de erro numa rota quente queima o mês em horas e deixa você
cego na hora errada.

Além do filtro, o código agrupa por rota (`setFingerprint`): 200 ocorrências do
mesmo erro viram 1 issue com 200 eventos, não 200 issues.

**No painel do Sentry, ligue também:** spike protection e rate limit por DSN
key. O filtro do código não substitui isso.

### Tags em cada evento

| Tag | Para quê |
|---|---|
| `request_id` | Costura com a linha do log e com o `x-request-id` que o usuário viu |
| `account_id` | **Qual cliente do SaaS foi afetado.** Num sistema multi-tenant, erro sem dono é erro do qual você não sabe quem perdeu |
| `kitchen_id`, `space_id` | Escopo mais fino quando existir |
| `rota`, `metodo` | Agrupamento |

### Scrubbing

`sendDefaultPii: false` — IP, cookie e header não saem por padrão. Além disso,
o `beforeSend` em `server/src/lib/sentry.ts` varre recursivamente o evento e
apaga qualquer valor sob chave sensível: `authorization`, `qrToken`, `token`,
`password`, `passwordHash`, `cookie`, `jwt` e variações. Também descarta a
`query_string` inteira e limpa `breadcrumbs`.

Por que tanto cuidado: o `authorization` carrega o **qrToken da mesa** e o
**JWT da cozinha** — os mesmos que já são redigidos do log. Mandá-los para um
terceiro anularia aquele trabalho, e o vazamento seria silencioso, porque
ninguém inspeciona o que o SDK envia.

Isso é coberto por **14 testes** (`server/src/lib/sentry.test.ts`) que passam
eventos montados à mão pelo `beforeSend` real e verificam que o segredo não
sobrevive. Ao adicionar campo sensível novo, adicione à lista **e** ao teste.

### Tracing

`SENTRY_TRACES_SAMPLE_RATE` começa em **0**. Tracing gera um evento por
requisição — subir sem olhar o consumo esvazia a cota do free em horas. Se for
experimentar, comece em `0.05`.

Quando a amostragem passar de 0, a ordem de inicialização vira requisito: a
instrumentação automática precisa aplicar patch nos módulos antes de eles serem
carregados. Por isso existe `server/src/instrument.ts`, o primeiro import do
`server.ts` — o comentário lá explica por que uma chamada de função não
resolveria (em ESM os imports são hoisted).

### Custo em disco

O SDK arrasta OpenTelemetry como dependência: a imagem do server vai de 406 MB
para **469 MB**. É o preço de ter o Sentry disponível mesmo quando desligado —
o pacote está lá independentemente do DSN estar preenchido.

Se algum dia isso incomodar, a saída é um build sem o SDK (`external` no
esbuild já está, falta um flag de build para omitir a dependência). Não vale o
esforço no tamanho atual.

### Limites do plano free

- **Um usuário.** Entrou sócio ou funcionário, vira plano pago.
- **Alertas só por e-mail.** Integração com Slack/PagerDuty é Team+.
- **Cota fixa de eventos**, sem opção de estourar pagando — daí todo o cuidado
  acima.

