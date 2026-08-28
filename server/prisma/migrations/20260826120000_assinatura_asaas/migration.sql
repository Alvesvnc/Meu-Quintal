-- CreateEnum
CREATE TYPE "AssinaturaStatus" AS ENUM ('nenhuma', 'aguardando', 'ativa', 'atrasada', 'encerrada');

-- CreateTable
CREATE TABLE "assinaturas" (
    "id" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "status" "AssinaturaStatus" NOT NULL DEFAULT 'nenhuma',
    "provedor" TEXT NOT NULL DEFAULT 'asaas',
    "asaasCheckoutId" TEXT,
    "asaasSubscriptionId" TEXT,
    "asaasCustomerId" TEXT,
    "precoMensalCents" INTEGER,
    "proximaCobrancaEm" TIMESTAMP(3),
    "pagoEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assinaturas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eventos_de_cobranca" (
    "id" UUID NOT NULL,
    "eventoId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "assinaturaId" UUID,
    "payload" JSONB NOT NULL,
    "efeito" TEXT,
    "recebidoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eventos_de_cobranca_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "assinaturas_accountId_key" ON "assinaturas"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "assinaturas_asaasCheckoutId_key" ON "assinaturas"("asaasCheckoutId");

-- CreateIndex
CREATE UNIQUE INDEX "assinaturas_asaasSubscriptionId_key" ON "assinaturas"("asaasSubscriptionId");

-- CreateIndex
CREATE INDEX "assinaturas_asaasCustomerId_idx" ON "assinaturas"("asaasCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "eventos_de_cobranca_eventoId_key" ON "eventos_de_cobranca"("eventoId");

-- CreateIndex
CREATE INDEX "eventos_de_cobranca_assinaturaId_recebidoEm_idx" ON "eventos_de_cobranca"("assinaturaId", "recebidoEm");

-- AddForeignKey
ALTER TABLE "assinaturas" ADD CONSTRAINT "assinaturas_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eventos_de_cobranca" ADD CONSTRAINT "eventos_de_cobranca_assinaturaId_fkey" FOREIGN KEY ("assinaturaId") REFERENCES "assinaturas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

