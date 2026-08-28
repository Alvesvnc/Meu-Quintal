-- A foto de capa da cozinha passa a ser um arquivo NOSSO, nao uma URL colada a
-- mao. `photoUrl` fica: e o que as cozinhas ja cadastradas tem, e apagar
-- deixaria a lista do quintal sem foto de um dia pro outro.
-- AlterTable
ALTER TABLE "kitchens" ADD COLUMN "photoKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "kitchens_photoKey_key" ON "kitchens"("photoKey");
