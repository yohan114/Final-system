-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_OilRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceRef" TEXT NOT NULL,
    "product" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'issue',
    "qty" REAL NOT NULL,
    "amountCents" INTEGER NOT NULL DEFAULT 0,
    "machineCode" TEXT,
    "machineId" TEXT,
    "siteRef" TEXT,
    "occurredAt" DATETIME NOT NULL,
    "month" TEXT NOT NULL,
    CONSTRAINT "OilRecord_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "MachineMap" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_OilRecord" ("amountCents", "id", "machineCode", "machineId", "month", "occurredAt", "product", "qty", "siteRef", "sourceRef") SELECT "amountCents", "id", "machineCode", "machineId", "month", "occurredAt", "product", "qty", "siteRef", "sourceRef" FROM "OilRecord";
DROP TABLE "OilRecord";
ALTER TABLE "new_OilRecord" RENAME TO "OilRecord";
CREATE UNIQUE INDEX "OilRecord_sourceRef_key" ON "OilRecord"("sourceRef");
CREATE INDEX "OilRecord_month_idx" ON "OilRecord"("month");
CREATE INDEX "OilRecord_machineId_idx" ON "OilRecord"("machineId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
