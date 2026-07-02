-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('STRIPE', 'CASH');

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "checkId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "tipCents" INTEGER NOT NULL DEFAULT 0,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "method" "PaymentMethod" NOT NULL DEFAULT 'STRIPE',
    "stripePaymentIntentId" TEXT,
    "payerName" TEXT,
    "receiptEmail" TEXT,
    "coverage" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "line_claims" (
    "id" TEXT NOT NULL,
    "checkId" TEXT NOT NULL,
    "lineId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "units" INTEGER NOT NULL,
    "paymentId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "line_claims_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payments_stripePaymentIntentId_key" ON "payments"("stripePaymentIntentId");

-- CreateIndex
CREATE INDEX "payments_checkId_idx" ON "payments"("checkId");

-- CreateIndex
CREATE INDEX "line_claims_lineId_idx" ON "line_claims"("lineId");

-- CreateIndex
CREATE INDEX "line_claims_checkId_sessionId_idx" ON "line_claims"("checkId", "sessionId");

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_checkId_fkey" FOREIGN KEY ("checkId") REFERENCES "checks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "line_claims" ADD CONSTRAINT "line_claims_checkId_fkey" FOREIGN KEY ("checkId") REFERENCES "checks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "line_claims" ADD CONSTRAINT "line_claims_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "check_lines"("id") ON DELETE CASCADE ON UPDATE CASCADE;
