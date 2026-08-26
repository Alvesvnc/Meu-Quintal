-- CreateEnum
CREATE TYPE "MotivoCancelamento" AS ENUM ('sem-ingrediente', 'equipamento', 'demanda-alta', 'fim-de-expediente', 'item-errado-no-cardapio', 'cliente-desistiu', 'outro');

-- AlterTable
ALTER TABLE "order_changes" ADD COLUMN     "motivo" "MotivoCancelamento" NOT NULL DEFAULT 'outro';

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "cancelMotivo" "MotivoCancelamento",
ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "canceledAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "order_items_kitchenId_canceledAt_idx" ON "order_items"("kitchenId", "canceledAt");

