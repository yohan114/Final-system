-- CreateTable
CREATE TABLE "MachineMap" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "canonicalCode" TEXT NOT NULL,
    "label" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SiteMap" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "canonicalKey" TEXT NOT NULL,
    "label" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SystemEntity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "systemKey" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "localId" TEXT NOT NULL,
    "code" TEXT,
    "label" TEXT,
    "extra" TEXT,
    "matchType" TEXT,
    "machineId" TEXT,
    "siteId" TEXT,
    "syncedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SystemEntity_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "MachineMap" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SystemEntity_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "SiteMap" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "MachineMap_canonicalCode_key" ON "MachineMap"("canonicalCode");

-- CreateIndex
CREATE UNIQUE INDEX "SiteMap_canonicalKey_key" ON "SiteMap"("canonicalKey");

-- CreateIndex
CREATE INDEX "SystemEntity_kind_machineId_idx" ON "SystemEntity"("kind", "machineId");

-- CreateIndex
CREATE INDEX "SystemEntity_kind_siteId_idx" ON "SystemEntity"("kind", "siteId");

-- CreateIndex
CREATE INDEX "SystemEntity_systemKey_kind_idx" ON "SystemEntity"("systemKey", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "SystemEntity_systemKey_kind_localId_key" ON "SystemEntity"("systemKey", "kind", "localId");
