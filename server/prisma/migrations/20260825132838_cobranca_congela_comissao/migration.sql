-- Congela no historico se o acordo tinha comissao quando o ciclo fechou.
--
-- E este campo que decide se o dono pode ver `grossCents` da cobranca. Ler o
-- acordo ATUAL da cozinha nao serve: renegociar hoje passaria a revelar o
-- faturamento de meses que estavam protegidos pelo acordo da epoca.
ALTER TABLE "kitchen_charges" ADD COLUMN "chargeCommission" BOOLEAN NOT NULL DEFAULT true;

-- Backfill do que ja existe. `commissionPct > 0` e a melhor inferencia
-- disponivel: quando a comissao estava desligada, calcularCobranca gravou 0.
-- Um acordo de 0% com comissao ligada e indistinguivel aqui — cai no lado
-- conservador (oculto), que e o lado certo pra errar.
UPDATE "kitchen_charges" SET "chargeCommission" = ("commissionPct" > 0);
