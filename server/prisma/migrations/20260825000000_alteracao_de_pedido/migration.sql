-- CreateEnum
CREATE TYPE "ChangeStatus" AS ENUM ('pendente', 'aceita', 'recusada', 'expirada');

-- CreateTable
CREATE TABLE "order_changes" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "kitchenId" UUID NOT NULL,
    "status" "ChangeStatus" NOT NULL DEFAULT 'pendente',
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "order_changes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_change_items" (
    "id" UUID NOT NULL,
    "changeId" UUID NOT NULL,
    "orderItemId" UUID NOT NULL,
    "qtyAnterior" INTEGER NOT NULL,
    "qtyProposta" INTEGER NOT NULL,

    CONSTRAINT "order_change_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "order_changes_orderId_status_idx" ON "order_changes"("orderId", "status");

-- CreateIndex
CREATE INDEX "order_changes_kitchenId_status_idx" ON "order_changes"("kitchenId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "order_change_items_changeId_orderItemId_key" ON "order_change_items"("changeId", "orderItemId");

-- AddForeignKey
ALTER TABLE "order_changes" ADD CONSTRAINT "order_changes_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_changes" ADD CONSTRAINT "order_changes_kitchenId_fkey" FOREIGN KEY ("kitchenId") REFERENCES "kitchens"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_change_items" ADD CONSTRAINT "order_change_items_changeId_fkey" FOREIGN KEY ("changeId") REFERENCES "order_changes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_change_items" ADD CONSTRAINT "order_change_items_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

