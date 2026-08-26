-- CreateEnum
CREATE TYPE "AccountPlan" AS ENUM ('trial', 'basico', 'pro');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('ativa', 'suspensa', 'cancelada');

-- CreateEnum
CREATE TYPE "AccountRole" AS ENUM ('owner', 'admin', 'staff');

-- CreateEnum
CREATE TYPE "InviteKind" AS ENUM ('cozinha', 'equipe');

-- CreateEnum
CREATE TYPE "TableStatus" AS ENUM ('livre', 'ocupada', 'precisa-limpar');

-- CreateEnum
CREATE TYPE "CycleStatus" AS ENUM ('aberto', 'fechado');

-- CreateEnum
CREATE TYPE "ChargeStatus" AS ENUM ('aberta', 'fechada', 'paga', 'atrasada');

-- DropIndex
DROP INDEX "kitchens_slug_key";

-- AlterTable
ALTER TABLE "kitchens" ADD COLUMN     "chargeCommission" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "chargeRent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "commissionPct" DECIMAL(5,2),
ADD COLUMN     "rentCents" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
-- accountId entra NULAVEL de proposito: a tabela ja tem linhas e um NOT NULL
-- direto quebraria a migration. O backfill no fim do arquivo cria a conta,
-- liga os espacos orfaos nela e so entao aperta a coluna.
ALTER TABLE "spaces" ADD COLUMN     "accountId" UUID,
ADD COLUMN     "closingDay" INTEGER NOT NULL DEFAULT 5;

-- AlterTable
ALTER TABLE "tables" ADD COLUMN     "status" "TableStatus" NOT NULL DEFAULT 'livre';

-- CreateTable
CREATE TABLE "accounts" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "plan" "AccountPlan" NOT NULL DEFAULT 'trial',
    "status" "AccountStatus" NOT NULL DEFAULT 'ativa',
    "trialEndsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_users" (
    "id" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "role" "AccountRole" NOT NULL DEFAULT 'owner',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "account_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invites" (
    "id" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "spaceId" UUID,
    "email" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "kind" "InviteKind" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "role" "AccountRole",
    "kitchenName" TEXT,
    "chargeCommission" BOOLEAN,
    "commissionPct" DECIMAL(5,2),
    "chargeRent" BOOLEAN,
    "rentCents" INTEGER,

    CONSTRAINT "invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_cycles" (
    "id" UUID NOT NULL,
    "spaceId" UUID NOT NULL,
    "refMonth" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" "CycleStatus" NOT NULL DEFAULT 'aberto',
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_cycles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kitchen_charges" (
    "id" UUID NOT NULL,
    "cycleId" UUID NOT NULL,
    "kitchenId" UUID NOT NULL,
    "grossCents" INTEGER NOT NULL,
    "commissionPct" DECIMAL(5,2) NOT NULL,
    "commissionCents" INTEGER NOT NULL,
    "rentCents" INTEGER NOT NULL,
    "totalDueCents" INTEGER NOT NULL,
    "status" "ChargeStatus" NOT NULL DEFAULT 'aberta',
    "paidAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kitchen_charges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "accounts_slug_key" ON "accounts"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "account_users_email_key" ON "account_users"("email");

-- CreateIndex
CREATE INDEX "account_users_accountId_idx" ON "account_users"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "invites_tokenHash_key" ON "invites"("tokenHash");

-- CreateIndex
CREATE INDEX "invites_accountId_kind_idx" ON "invites"("accountId", "kind");

-- CreateIndex
CREATE INDEX "invites_email_idx" ON "invites"("email");

-- CreateIndex
CREATE INDEX "billing_cycles_spaceId_status_idx" ON "billing_cycles"("spaceId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "billing_cycles_spaceId_refMonth_key" ON "billing_cycles"("spaceId", "refMonth");

-- CreateIndex
CREATE INDEX "kitchen_charges_kitchenId_status_idx" ON "kitchen_charges"("kitchenId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "kitchen_charges_cycleId_kitchenId_key" ON "kitchen_charges"("cycleId", "kitchenId");

-- CreateIndex
CREATE UNIQUE INDEX "kitchens_spaceId_slug_key" ON "kitchens"("spaceId", "slug");

-- CreateIndex
CREATE INDEX "spaces_accountId_idx" ON "spaces"("accountId");

-- CreateIndex
CREATE INDEX "tables_spaceId_status_idx" ON "tables"("spaceId", "status");

-- AddForeignKey
ALTER TABLE "account_users" ADD CONSTRAINT "account_users_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invites" ADD CONSTRAINT "invites_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invites" ADD CONSTRAINT "invites_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spaces" ADD CONSTRAINT "spaces_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_cycles" ADD CONSTRAINT "billing_cycles_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kitchen_charges" ADD CONSTRAINT "kitchen_charges_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "billing_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kitchen_charges" ADD CONSTRAINT "kitchen_charges_kitchenId_fkey" FOREIGN KEY ("kitchenId") REFERENCES "kitchens"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ─────────────────────────────────────────────────────────────────────────────
-- BACKFILL: todo Space existente precisa de uma Account dona.
--
-- O banco anterior era single-tenant, entao nao ha como saber a quem cada
-- espaco pertence: todos vao pra uma conta de migracao. Se um dia isso rodar
-- num banco com espacos de clientes diferentes, REVISAR antes de aplicar.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO "accounts" ("id", "slug", "name", "plan", "status", "createdAt")
SELECT
  gen_random_uuid(),
  'conta-migrada',
  'Conta migrada (pre multi-tenant)',
  'pro',
  'ativa',
  CURRENT_TIMESTAMP
WHERE EXISTS (SELECT 1 FROM "spaces" WHERE "accountId" IS NULL);

UPDATE "spaces"
SET "accountId" = (SELECT "id" FROM "accounts" WHERE "slug" = 'conta-migrada')
WHERE "accountId" IS NULL;

-- Agora que nao ha mais nulo, a coluna pode virar obrigatoria de fato.
ALTER TABLE "spaces" ALTER COLUMN "accountId" SET NOT NULL;
