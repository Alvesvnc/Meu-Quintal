-- CreateTable
CREATE TABLE "kitchen_users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "kitchenId" UUID NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'owner',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "kitchen_users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "kitchen_users_email_key" ON "kitchen_users"("email");

-- CreateIndex
CREATE INDEX "kitchen_users_kitchenId_idx" ON "kitchen_users"("kitchenId");

-- AddForeignKey
ALTER TABLE "kitchen_users" ADD CONSTRAINT "kitchen_users_kitchenId_fkey" FOREIGN KEY ("kitchenId") REFERENCES "kitchens"("id") ON DELETE CASCADE ON UPDATE CASCADE;
