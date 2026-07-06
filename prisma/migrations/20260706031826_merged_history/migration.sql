-- CreateTable
CREATE TABLE "FuelRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceRef" TEXT NOT NULL,
    "machineCode" TEXT,
    "machineId" TEXT,
    "siteRef" TEXT,
    "fuelKind" TEXT,
    "source" TEXT,
    "litres" REAL NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "issuedBy" TEXT,
    "voided" BOOLEAN NOT NULL DEFAULT false,
    "occurredAt" DATETIME NOT NULL,
    "month" TEXT NOT NULL,
    CONSTRAINT "FuelRecord_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "MachineMap" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IncomeRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceRef" TEXT NOT NULL,
    "machineCode" TEXT,
    "machineId" TEXT,
    "siteRef" TEXT,
    "rentalCents" INTEGER NOT NULL DEFAULT 0,
    "fuelCents" INTEGER NOT NULL DEFAULT 0,
    "taxCents" INTEGER NOT NULL DEFAULT 0,
    "totalCents" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "invoiceNo" TEXT,
    "occurredAt" DATETIME NOT NULL,
    "month" TEXT NOT NULL,
    CONSTRAINT "IncomeRecord_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "MachineMap" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MeterRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceRef" TEXT NOT NULL,
    "machineCode" TEXT,
    "machineId" TEXT,
    "value" REAL NOT NULL,
    "readingType" TEXT NOT NULL,
    "occurredAt" DATETIME NOT NULL,
    "month" TEXT NOT NULL,
    CONSTRAINT "MeterRecord_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "MachineMap" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MaintenanceRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceRef" TEXT NOT NULL,
    "systemKey" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "machineCode" TEXT,
    "machineId" TEXT,
    "siteRef" TEXT,
    "description" TEXT,
    "status" TEXT,
    "driverName" TEXT,
    "jobNo" TEXT,
    "partsCents" INTEGER NOT NULL DEFAULT 0,
    "labourCents" INTEGER NOT NULL DEFAULT 0,
    "totalCents" INTEGER NOT NULL DEFAULT 0,
    "openedAt" DATETIME,
    "closedAt" DATETIME,
    "occurredAt" DATETIME NOT NULL,
    "month" TEXT NOT NULL,
    CONSTRAINT "MaintenanceRecord_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "MachineMap" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StoreRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceRef" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "category" TEXT,
    "machineCode" TEXT,
    "machineId" TEXT,
    "qty" REAL NOT NULL,
    "unitCents" INTEGER NOT NULL DEFAULT 0,
    "amountCents" INTEGER NOT NULL DEFAULT 0,
    "grnNumber" TEXT,
    "supplier" TEXT,
    "mrnNum" TEXT,
    "occurredAt" DATETIME NOT NULL,
    "month" TEXT NOT NULL,
    CONSTRAINT "StoreRecord_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "MachineMap" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OilRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceRef" TEXT NOT NULL,
    "product" TEXT NOT NULL,
    "qty" REAL NOT NULL,
    "amountCents" INTEGER NOT NULL DEFAULT 0,
    "machineCode" TEXT,
    "machineId" TEXT,
    "siteRef" TEXT,
    "occurredAt" DATETIME NOT NULL,
    "month" TEXT NOT NULL,
    CONSTRAINT "OilRecord_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "MachineMap" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BatteryRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceRef" TEXT NOT NULL,
    "vehicleNo" TEXT,
    "machineCode" TEXT,
    "machineId" TEXT,
    "brand" TEXT,
    "amountCents" INTEGER NOT NULL DEFAULT 0,
    "installedAt" DATETIME,
    "warrantyMonths" INTEGER,
    "occurredAt" DATETIME NOT NULL,
    "month" TEXT NOT NULL,
    CONSTRAINT "BatteryRecord_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "MachineMap" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MachineSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "machineId" TEXT NOT NULL,
    "systemKey" TEXT NOT NULL,
    "status" TEXT,
    "meterValue" REAL,
    "meterType" TEXT,
    "siteRef" TEXT,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MachineSnapshot_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "MachineMap" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "FuelRecord_sourceRef_key" ON "FuelRecord"("sourceRef");

-- CreateIndex
CREATE INDEX "FuelRecord_month_idx" ON "FuelRecord"("month");

-- CreateIndex
CREATE INDEX "FuelRecord_machineId_occurredAt_idx" ON "FuelRecord"("machineId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "IncomeRecord_sourceRef_key" ON "IncomeRecord"("sourceRef");

-- CreateIndex
CREATE INDEX "IncomeRecord_month_idx" ON "IncomeRecord"("month");

-- CreateIndex
CREATE INDEX "IncomeRecord_machineId_idx" ON "IncomeRecord"("machineId");

-- CreateIndex
CREATE UNIQUE INDEX "MeterRecord_sourceRef_key" ON "MeterRecord"("sourceRef");

-- CreateIndex
CREATE INDEX "MeterRecord_machineId_occurredAt_idx" ON "MeterRecord"("machineId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "MaintenanceRecord_sourceRef_key" ON "MaintenanceRecord"("sourceRef");

-- CreateIndex
CREATE INDEX "MaintenanceRecord_month_idx" ON "MaintenanceRecord"("month");

-- CreateIndex
CREATE INDEX "MaintenanceRecord_machineId_idx" ON "MaintenanceRecord"("machineId");

-- CreateIndex
CREATE INDEX "MaintenanceRecord_status_idx" ON "MaintenanceRecord"("status");

-- CreateIndex
CREATE UNIQUE INDEX "StoreRecord_sourceRef_key" ON "StoreRecord"("sourceRef");

-- CreateIndex
CREATE INDEX "StoreRecord_month_idx" ON "StoreRecord"("month");

-- CreateIndex
CREATE INDEX "StoreRecord_machineId_idx" ON "StoreRecord"("machineId");

-- CreateIndex
CREATE UNIQUE INDEX "OilRecord_sourceRef_key" ON "OilRecord"("sourceRef");

-- CreateIndex
CREATE INDEX "OilRecord_month_idx" ON "OilRecord"("month");

-- CreateIndex
CREATE INDEX "OilRecord_machineId_idx" ON "OilRecord"("machineId");

-- CreateIndex
CREATE UNIQUE INDEX "BatteryRecord_sourceRef_key" ON "BatteryRecord"("sourceRef");

-- CreateIndex
CREATE INDEX "BatteryRecord_machineId_idx" ON "BatteryRecord"("machineId");

-- CreateIndex
CREATE UNIQUE INDEX "MachineSnapshot_machineId_systemKey_key" ON "MachineSnapshot"("machineId", "systemKey");
