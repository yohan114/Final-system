import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

const adapter = new PrismaBetterSqlite3({
  // PORTAL_DATABASE_URL first so the portal keeps its own DB when co-hosted in
  // the unified E&C server, where a bare DATABASE_URL would be ambiguous.
  url: process.env.PORTAL_DATABASE_URL || process.env.DATABASE_URL || "file:./data/portal.db",
});

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// WAL mode keeps reads fast while the poller writes StatusSample rows.
prisma.$executeRawUnsafe("PRAGMA journal_mode=WAL;").catch((err) => {
  console.error("Failed to enable WAL mode on SQLite:", err);
});
