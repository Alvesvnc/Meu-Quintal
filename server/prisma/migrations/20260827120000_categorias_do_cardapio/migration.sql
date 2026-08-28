-- Os topicos do cardapio passam a ser da COZINHA, nao do sistema.
--
-- O enum MenuCategory tinha quatro valores fixos (entradas/pratos/sobremesas/
-- bebidas). Nao serve pra padaria, bar ou sorveteria — e renomear exigia
-- migration. Agora e tabela: cada cozinha escreve, renomeia e ordena os topicos
-- dela, e o item aponta pro ID, entao renomear nao move item de lugar.
--
-- COLUNA NOT NULL EM TABELA COM DADO: os tres passos de sempre — cria nulavel,
-- popula, so entao trava. Ver a migration 20260824000000_multi_tenant_e_cobranca.

-- ─── 1. A tabela nova ───────────────────────────────────────────────────────
CREATE TABLE "menu_categories" (
    "id" UUID NOT NULL,
    "kitchenId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "menu_categories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "menu_categories_kitchenId_name_key" ON "menu_categories"("kitchenId", "name");
CREATE INDEX "menu_categories_kitchenId_sortOrder_idx" ON "menu_categories"("kitchenId", "sortOrder");

ALTER TABLE "menu_categories" ADD CONSTRAINT "menu_categories_kitchenId_fkey"
    FOREIGN KEY ("kitchenId") REFERENCES "kitchens"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── 2. Backfill: as quatro de antes, para TODA cozinha ─────────────────────
--
-- Todas as quatro, e nao so as que a cozinha usava: hoje o editor de item
-- oferece as quatro a qualquer cozinha, entao criar so as usadas TIRARIA opcao
-- de quem ja estava aqui. Vazia nao aparece pro cliente — o cardapio pula secao
-- sem item — e a cozinha apaga a que nao quiser.
INSERT INTO "menu_categories" ("id", "kitchenId", "name", "sortOrder")
SELECT gen_random_uuid(), k."id", padrao."name", padrao."sortOrder"
FROM "kitchens" k
CROSS JOIN (VALUES
    ('Entradas',   0),
    ('Pratos',     1),
    ('Sobremesas', 2),
    ('Bebidas',    3)
) AS padrao("name", "sortOrder");

-- ─── 3. A coluna, primeiro nulavel ──────────────────────────────────────────
ALTER TABLE "menu_items" ADD COLUMN "categoriaId" UUID;

UPDATE "menu_items" mi
SET "categoriaId" = mc."id"
FROM "menu_categories" mc
WHERE mc."kitchenId" = mi."kitchenId"
  AND mc."name" = CASE mi."category"::text
        WHEN 'entradas'   THEN 'Entradas'
        WHEN 'pratos'     THEN 'Pratos'
        WHEN 'sobremesas' THEN 'Sobremesas'
        WHEN 'bebidas'    THEN 'Bebidas'
      END;

-- Rede de seguranca: item cuja cozinha sumiu no meio do caminho travaria o
-- SET NOT NULL abaixo com uma mensagem que nao explica nada. Se sobrou algum
-- sem categoria, a migration para AQUI, dizendo o que aconteceu.
DO $$
DECLARE orfaos INTEGER;
BEGIN
    SELECT COUNT(*) INTO orfaos FROM "menu_items" WHERE "categoriaId" IS NULL;
    IF orfaos > 0 THEN
        RAISE EXCEPTION 'backfill incompleto: % item(ns) de cardapio sem categoria', orfaos;
    END IF;
END $$;

-- ─── 4. Agora sim, obrigatoria ──────────────────────────────────────────────
ALTER TABLE "menu_items" ALTER COLUMN "categoriaId" SET NOT NULL;

CREATE INDEX "menu_items_categoriaId_idx" ON "menu_items"("categoriaId");

-- RESTRICT e a regra de negocio: apagar categoria com item dentro deixaria o
-- item sem onde aparecer. A rota exige um destino pros itens antes de apagar.
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_categoriaId_fkey"
    FOREIGN KEY ("categoriaId") REFERENCES "menu_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── 5. O enum sai ──────────────────────────────────────────────────────────
ALTER TABLE "menu_items" DROP COLUMN "category";
DROP TYPE "MenuCategory";
