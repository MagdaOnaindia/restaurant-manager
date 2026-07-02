-- CreateEnum
CREATE TYPE "CheckStatus" AS ENUM ('OPEN', 'PARTIALLY_PAID', 'PAID', 'CLOSED', 'CANCELLED');

-- CreateTable
CREATE TABLE "checks" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "tableId" TEXT,
    "tableName" TEXT NOT NULL,
    "status" "CheckStatus" NOT NULL DEFAULT 'OPEN',
    "publicToken" TEXT NOT NULL,
    "notes" TEXT,
    "openedById" TEXT,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "check_lines" (
    "id" TEXT NOT NULL,
    "checkId" TEXT NOT NULL,
    "menuItemId" TEXT,
    "name" TEXT NOT NULL,
    "unitPriceCents" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "paidUnits" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "check_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "checks_publicToken_key" ON "checks"("publicToken");

-- CreateIndex
CREATE INDEX "checks_restaurantId_status_idx" ON "checks"("restaurantId", "status");

-- CreateIndex
CREATE INDEX "checks_tableId_idx" ON "checks"("tableId");

-- CreateIndex
CREATE INDEX "check_lines_checkId_idx" ON "check_lines"("checkId");

-- AddForeignKey
ALTER TABLE "checks" ADD CONSTRAINT "checks_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checks" ADD CONSTRAINT "checks_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "tables"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "check_lines" ADD CONSTRAINT "check_lines_checkId_fkey" FOREIGN KEY ("checkId") REFERENCES "checks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "check_lines" ADD CONSTRAINT "check_lines_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "menu_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
