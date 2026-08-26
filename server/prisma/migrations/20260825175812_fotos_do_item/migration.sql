-- CreateTable
CREATE TABLE "menu_item_photos" (
    "id" UUID NOT NULL,
    "menuItemId" UUID NOT NULL,
    "storageKey" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "bytes" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "menu_item_photos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "menu_item_photos_storageKey_key" ON "menu_item_photos"("storageKey");

-- CreateIndex
CREATE INDEX "menu_item_photos_menuItemId_sortOrder_idx" ON "menu_item_photos"("menuItemId", "sortOrder");

-- AddForeignKey
ALTER TABLE "menu_item_photos" ADD CONSTRAINT "menu_item_photos_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "menu_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
