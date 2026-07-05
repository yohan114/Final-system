import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL || "file:./data/portal.db",
});
const prisma = new PrismaClient({ adapter });

// One main link, four subs. Set PORTAL_PUBLIC_DOMAIN to the portal's public host
// (e.g. "portal.ec-workshops.online") and every system's browser-facing address
// is derived as "<subdomain>.<that domain>" — fuel.portal…, stores.portal…, etc.
// So the whole estate is configured from a single value.
//
// baseUrl = where the portal polls health (server-to-server, on the box) — stays
//           on localhost, never changes with the public domain.
// openUrl = where a person's browser goes to sign in to that system. Resolution
//           order: an explicit per-system override (<SYS>_OPEN_URL) → the derived
//           "<sub>.<PORTAL_PUBLIC_DOMAIN>" → the *_BASE_URL / localhost fallback.
const PORTAL_PUBLIC_DOMAIN = (process.env.PORTAL_PUBLIC_DOMAIN || "").trim().replace(/^https?:\/\//, "").replace(/\/+$/, "");

function resolveOpenUrl(explicit: string | undefined, subdomain: string, baseFallback: string): string {
  if (explicit && explicit.trim()) return explicit.trim();
  if (PORTAL_PUBLIC_DOMAIN) return `https://${subdomain}.${PORTAL_PUBLIC_DOMAIN}`;
  return baseFallback;
}

const SYSTEMS = [
  {
    key: "fuel",
    name: "Fleet Fuel & Billing",
    description:
      "Fuel requests, issues, bulk tanks, meter readings, service planner and monthly rental + fuel invoicing.",
    icon: "fuel",
    baseUrl: process.env.FUEL_BASE_URL || "http://localhost:3300",
    openUrl: resolveOpenUrl(process.env.FUEL_OPEN_URL, "fuel", process.env.FUEL_BASE_URL || "http://localhost:3300"),
    tokenEnv: "FUEL_PORTAL_TOKEN",
    sortOrder: 1,
  },
  {
    key: "mainstores",
    name: "Main Stores Console",
    description:
      "Machine & tool lifecycle: MRN request, Head-Office approval, workshop receipt, dispatch to site and return, with photo evidence.",
    icon: "boxes",
    baseUrl: process.env.MAINSTORES_BASE_URL || "http://localhost:1111",
    openUrl: resolveOpenUrl(process.env.MAINSTORES_OPEN_URL, "stores", process.env.MAINSTORES_BASE_URL || "http://localhost:1111"),
    tokenEnv: "MAINSTORES_PORTAL_TOKEN",
    sortOrder: 2,
  },
  {
    key: "workshop",
    name: "Workshop & Stores",
    description:
      "Materials (MRN/GRN + pricing), workshop job cards with per-job cost cockpit, and the operations approval workflow.",
    icon: "wrench",
    baseUrl: process.env.WORKSHOP_BASE_URL || "http://localhost:5000",
    openUrl: resolveOpenUrl(process.env.WORKSHOP_OPEN_URL, "workshop", process.env.WORKSHOP_BASE_URL || "http://localhost:5000"),
    tokenEnv: "WORKSHOP_PORTAL_TOKEN",
    sortOrder: 3,
  },
  {
    key: "oilbook",
    name: "Oil Stock Book",
    description:
      "Lubricant stock ledger with running balances, per-machine/project consumption, stock-take, requisitions and the battery register.",
    icon: "droplet",
    baseUrl: process.env.OILBOOK_BASE_URL || "http://localhost:3000",
    openUrl: resolveOpenUrl(process.env.OILBOOK_OPEN_URL, "oil", process.env.OILBOOK_BASE_URL || "http://localhost:3000"),
    tokenEnv: "OILBOOK_PORTAL_TOKEN",
    sortOrder: 4,
  },
];

async function main() {
  // 1. Portal admin — no hardcoded password in source.
  console.log("Seeding portal admin...");
  let adminPassword = process.env.SEED_PORTAL_ADMIN_PASSWORD;
  if (!adminPassword) {
    adminPassword = randomBytes(12).toString("base64url");
    console.log(`  Generated portal admin password (save it now): ${adminPassword}`);
  }
  const passwordHash = bcrypt.hashSync(adminPassword, 10);
  await prisma.portalUser.upsert({
    where: { username: "admin" },
    update: { passwordHash, role: "MASTER_ADMIN", name: "Portal Administrator", active: true },
    create: {
      username: "admin",
      name: "Portal Administrator",
      passwordHash,
      role: "MASTER_ADMIN",
      active: true,
    },
  });

  // 2. Register the four linked systems (idempotent on key).
  console.log("Registering linked systems...");
  for (const sys of SYSTEMS) {
    await prisma.system.upsert({
      where: { key: sys.key },
      update: {
        name: sys.name,
        description: sys.description,
        icon: sys.icon,
        baseUrl: sys.baseUrl,
        openUrl: sys.openUrl,
        tokenEnv: sys.tokenEnv,
        sortOrder: sys.sortOrder,
      },
      create: {
        key: sys.key,
        name: sys.name,
        description: sys.description,
        icon: sys.icon,
        baseUrl: sys.baseUrl,
        openUrl: sys.openUrl,
        tokenEnv: sys.tokenEnv,
        sortOrder: sys.sortOrder,
      },
    });
    console.log(`  ✓ ${sys.key} → open ${sys.openUrl} (health ${sys.baseUrl})`);
  }

  if (PORTAL_PUBLIC_DOMAIN) {
    console.log(`Main link: https://${PORTAL_PUBLIC_DOMAIN} — systems open on its sub-domains.`);
  } else {
    console.log("PORTAL_PUBLIC_DOMAIN not set — systems open on their *_BASE_URL / localhost fallback.");
  }
  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error("Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
