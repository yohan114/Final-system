-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PortalUser" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "siteId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PortalUser_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "SiteMap" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_PortalUser" ("active", "createdAt", "id", "name", "passwordHash", "role", "updatedAt", "username") SELECT "active", "createdAt", "id", "name", "passwordHash", "role", "updatedAt", "username" FROM "PortalUser";
DROP TABLE "PortalUser";
ALTER TABLE "new_PortalUser" RENAME TO "PortalUser";
CREATE UNIQUE INDEX "PortalUser_username_key" ON "PortalUser"("username");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
