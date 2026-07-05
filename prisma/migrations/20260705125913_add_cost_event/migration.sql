-- CreateTable
CREATE TABLE "CostEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "systemKey" TEXT NOT NULL,
    "sourceRef" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "occurredAt" DATETIME NOT NULL,
    "machineCode" TEXT,
    "siteRef" TEXT,
    "qty" REAL,
    "amountCents" INTEGER NOT NULL,
    "machineId" TEXT,
    "siteId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CostEvent_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "MachineMap" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CostEvent_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "SiteMap" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "CostEvent_month_idx" ON "CostEvent"("month");

-- CreateIndex
CREATE INDEX "CostEvent_month_siteId_idx" ON "CostEvent"("month", "siteId");

-- CreateIndex
CREATE INDEX "CostEvent_month_machineId_idx" ON "CostEvent"("month", "machineId");

-- CreateIndex
CREATE UNIQUE INDEX "CostEvent_systemKey_sourceRef_key" ON "CostEvent"("systemKey", "sourceRef");
