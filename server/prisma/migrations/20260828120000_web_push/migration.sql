-- Aviso com o app fechado: a cozinha inscreve o APARELHO, nao a pessoa.
--
-- Ate aqui o aviso era so in-app (socket + som + vibracao), o que exige a aba
-- aberta na frente. Isto cobre o resto: tela apagada, app em segundo plano,
-- operador longe do balcao.
--
-- Tabela nova e vazia — sem backfill, sem coluna NOT NULL pra popular. E a
-- migration mais simples possivel de proposito: ligar push nao pode ser uma
-- operacao arriscada num banco de producao com pedido rodando.

CREATE TABLE "push_subscriptions" (
    "id" UUID NOT NULL,
    "kitchenId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastOkAt" TIMESTAMP(3),

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- UNICO no sistema, nao por cozinha: o `endpoint` ja e emitido pelo navegador
-- por instalacao, entao dois iguais seriam o MESMO aparelho. Sem isto, cada
-- reinscricao (que acontece sozinha quando o navegador rotaciona a chave)
-- criaria uma linha nova e a cozinha receberia o aviso em duplicata.
CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");

CREATE INDEX "push_subscriptions_kitchenId_idx" ON "push_subscriptions"("kitchenId");

-- Por usuario: e a busca de "apagar as inscricoes de quem trocou a senha",
-- que roda dentro da transacao de troca de senha (modules/acesso.ts).
CREATE INDEX "push_subscriptions_userId_idx" ON "push_subscriptions"("userId");

-- CASCADE: cozinha apagada leva as inscricoes junto. Nao ha o que preservar —
-- aviso de uma cozinha que nao existe mais nao tem destinatario.
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_kitchenId_fkey"
    FOREIGN KEY ("kitchenId") REFERENCES "kitchens"("id") ON DELETE CASCADE ON UPDATE CASCADE;
