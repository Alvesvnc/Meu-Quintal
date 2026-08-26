-- O plano passa a dizer o FORMATO do negocio, nao um degrau generico.
--
-- De `trial | basico | pro` (nomes que nao diziam nada e nunca decidiram nada)
-- para `restaurante | praca`. O trial some do enum: quem testa ja assinou um
-- formato, e ate quando ele testa vive em accounts."trialEndsAt".
--
-- O BACKFILL OLHA O DADO, nao o nome antigo: conta cujo espaco e
-- restaurante-unico vira `restaurante`; qualquer outra vira `praca`. Mapear
-- pelo nome antigo poria a Cantina da Rosa (que era "trial") no plano errado.
--
-- VIA COLUNA TEMPORARIA, e nao `ALTER COLUMN ... USING`: o Postgres recusa
-- subquery dentro de USING ("cannot use subquery in transform expression"), e
-- o backfill precisa consultar `spaces`.

CREATE TYPE "AccountPlan_novo" AS ENUM ('restaurante', 'praca');

ALTER TABLE "accounts" ADD COLUMN "plan_novo" "AccountPlan_novo";

UPDATE "accounts" a
SET "plan_novo" = CASE
  WHEN EXISTS (
    SELECT 1 FROM "spaces" s
    WHERE s."accountId" = a."id" AND s."tipo" = 'restaurante-unico'
  ) THEN 'restaurante'::"AccountPlan_novo"
  ELSE 'praca'::"AccountPlan_novo"
END;

ALTER TABLE "accounts" ALTER COLUMN "plan_novo" SET NOT NULL;
ALTER TABLE "accounts" DROP COLUMN "plan";
ALTER TABLE "accounts" RENAME COLUMN "plan_novo" TO "plan";

DROP TYPE "AccountPlan";
ALTER TYPE "AccountPlan_novo" RENAME TO "AccountPlan";

-- Sem default: plano e escolha comercial, nao valor que aparece sozinho.
