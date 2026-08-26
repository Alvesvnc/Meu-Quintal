-- CreateEnum
CREATE TYPE "TipoDeEspaco" AS ENUM ('food-court', 'restaurante-unico');

-- AlterTable
ALTER TABLE "account_users" ADD COLUMN     "kitchenId" UUID;

-- AlterTable
ALTER TABLE "spaces" ADD COLUMN     "tipo" "TipoDeEspaco" NOT NULL DEFAULT 'food-court';

-- CreateIndex
CREATE INDEX "account_users_kitchenId_idx" ON "account_users"("kitchenId");

-- AddForeignKey
ALTER TABLE "account_users" ADD CONSTRAINT "account_users_kitchenId_fkey" FOREIGN KEY ("kitchenId") REFERENCES "kitchens"("id") ON DELETE SET NULL ON UPDATE CASCADE;
