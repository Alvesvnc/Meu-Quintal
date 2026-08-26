-- AlterTable
ALTER TABLE "menu_items" ADD COLUMN     "archivedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "menu_items_kitchenId_archivedAt_idx" ON "menu_items"("kitchenId", "archivedAt");
