# Runbook — banco de dados

Este documento existe para o dia ruim. Se você está lendo por causa de um
incidente, vá direto para [Restaurar um backup](#restaurar-um-backup).

## Decisão: Postgres gerenciado

Decidido em 2026-08-24. Produção usa **Postgres de provedor gerenciado**
(Neon, Supabase, RDS, Railway, Cloud SQL — a escolha específica ainda está
aberta). O serviço `postgres` do `docker-compose.prod.yml` fica atrás do profile
`with-db` e serve para **desenvolvimento e homologação**, não para produção.

**Por quê:** backup, point-in-time recovery, réplica e failover são problemas
resolvidos e caros de fazer bem. Um `pg_dump` em cron gravando no mesmo host do
banco não protege contra a perda do host — que é justamente o cenário em que se
precisa de backup.

## O que exigir do provedor antes de assinar

Não confie na palavra "backup incluso". Confirme item a item:

- [ ] **Backup automático diário**, sem você precisar configurar
- [ ] **PITR (point-in-time recovery)** — restaurar para um instante arbitrário,
      não só para o snapshot da meia-noite. É a diferença entre perder 30
      segundos e perder um dia inteiro de pedidos após um `DELETE` errado.
- [ ] **Retenção mínima de 7 dias**, idealmente 30
- [ ] **Restore self-service**, sem abrir ticket e esperar suporte
- [ ] **Backup em região diferente** da instância primária
- [ ] **Export para fora do provedor** (`pg_dump`) — sem isso você fica preso, e
      a migração para outro provedor vira um projeto
- [ ] **Conexão exigindo TLS** (`sslmode=require` na `DATABASE_URL`)

## Testar o restore (obrigatório, trimestral)

**Backup que nunca foi restaurado não é backup — é esperança.** Agende:

1. Restaure o backup mais recente para uma instância nova (não a de produção).
2. Aponte um server local para ela:
   ```bash
   DATABASE_URL="postgresql://...instancia-restaurada..." pnpm --filter @mq/server dev
   ```
3. Confirme que os dados vieram:
   ```sql
   SELECT
     (SELECT count(*) FROM accounts)        AS contas,
     (SELECT count(*) FROM spaces)          AS espacos,
     (SELECT count(*) FROM kitchens)        AS cozinhas,
     (SELECT count(*) FROM orders)          AS pedidos,
     (SELECT count(*) FROM kitchen_charges) AS cobrancas,
     (SELECT max("createdAt") FROM orders)  AS pedido_mais_recente;
   ```
4. Confirme que o schema está na versão certa:
   ```bash
   pnpm --filter @mq/server exec prisma migrate status
   ```
5. Anote **quanto tempo levou**. Esse número é o seu RTO real; sem medir, ele é
   um chute.
6. Destrua a instância de teste.

## Restaurar um backup

> **Antes de qualquer coisa: pare o server.** Restaurar com a aplicação
> escrevendo produz um estado misturado, pior que o incidente original.

```bash
# 1. Tirar o server do ar (o /ready passa a falhar e o LB para de rotear)
docker compose -f docker-compose.prod.yml --env-file .env.prod stop server

# 2. Restaurar pelo painel do provedor (PITR para o instante ANTES do incidente)

# 3. Conferir que o schema bate com as migrations do código
DATABASE_URL="<url-restaurada>" pnpm --filter @mq/server exec prisma migrate status

# 4. Se houver migration pendente, aplicar
DATABASE_URL="<url-restaurada>" pnpm --filter @mq/server db:deploy

# 5. Voltar o server
docker compose -f docker-compose.prod.yml --env-file .env.prod start server

# 6. Confirmar
curl -fsS https://api.seudominio.com.br/ready
```

### Se o restore veio de uma versão antiga do schema

`prisma migrate deploy` aplica o que falta. O caminho contrário — banco **à
frente** do código — não tem solução automática: faça deploy da versão da
aplicação correspondente àquele schema antes de mexer no banco.

## Export manual (antes de operação arriscada)

Rode antes de migration grande, mudança de provedor ou qualquer coisa que
mexa em dados em massa:

```bash
pg_dump "$DATABASE_URL" --format=custom --no-owner --no-acl \
  --file="quintal-$(date +%Y%m%d-%H%M).dump"

# restaurar
pg_restore --dbname="$DATABASE_URL_DESTINO" --no-owner --no-acl --clean \
  quintal-20260824-1530.dump
```

> `--format=custom` (e não SQL puro) permite restaurar tabelas isoladas e é
> bem menor. `--no-owner --no-acl` evita erro de permissão quando a origem e o
> destino têm usuários diferentes — o caso normal entre provedores.

## Migrations em produção

Quem aplica é o serviço `migrate` do compose, que roda `prisma migrate deploy` e
sai; o `server` só sobe depois que ele termina com sucesso. Nunca há tráfego
contra um schema desatualizado.

**Nunca use `prisma migrate dev` em produção** — ele pode resetar o banco. O
comando de produção é `migrate deploy`, que só aplica o que falta e nunca apaga.

Antes de uma migration destrutiva (`DROP COLUMN`, `DROP TABLE`, mudança de
tipo): faça o export manual acima. `migrate deploy` não pergunta nada.

## Dados sensíveis

Um dump deste banco contém:

- `account_users.passwordHash` e `kitchen_users.passwordHash` (argon2 — caro de
  quebrar, mas não é motivo para vazar)
- `tables.qrToken` — **credencial em texto puro**. Quem tem o token acessa a
  mesa. Um dump vazado dá acesso de cliente a todas as mesas de todos os
  quintais.
- E-mails de donos e operadores de cozinha (LGPD)

Trate dump como segredo: não commite, não mande por chat, apague depois de usar.

## O que ainda falta

- [ ] Escolher o provedor
- [ ] Rodar o primeiro teste de restore e anotar o tempo
- [ ] Definir de quem é a responsabilidade de conferir o backup mensalmente
- [ ] Alerta de "backup falhou" chegando em algum lugar que alguém lê
