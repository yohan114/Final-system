const { PrismaClient } = require("@prisma/client");
const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3");
const crypto = require("crypto");
const path = require("path");

// Open SQLite database in the project root
const dbPath = "file:" + path.resolve("dev.db");
const adapter = new PrismaBetterSqlite3({
  url: dbPath,
});
const prisma = new PrismaClient({ adapter });

// Hashing functions (must match PBKDF2 parameters in auth.ts)
const ITERATIONS = 10000;
const KEY_LEN = 64;
const DIGEST = "sha512";

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LEN, DIGEST).toString("hex");
  return `${salt}:${hash}`;
}

// No hardcoded passwords in source. Each account draws its password from an env
// var, or gets a random one printed once. All seeded accounts are forced to
// change their password on first login (mustChangePassword).
function resolvePassword(envVar, generatedLabel) {
  const fromEnv = process.env[envVar];
  if (fromEnv) return { password: fromEnv, generated: false };
  const password = crypto.randomBytes(9).toString("base64url");
  console.log(`  Generated ${generatedLabel} password (save it now): ${password}`);
  return { password, generated: true };
}

async function seedUser(username, name, role, envVar) {
  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) return;
  const { password } = resolvePassword(envVar, `${username} (${role})`);
  await prisma.user.create({
    data: {
      username,
      name,
      passwordHash: hashPassword(password),
      role,
      mustChangePassword: true,
    },
  });
  console.log(`Created ${role} user: '${username}' (must change password on first login)`);
}

async function main() {
  console.log("Seeding database at:", dbPath);
  await seedUser("admin", "System Admin", "ADMIN", "SEED_ADMIN_PASSWORD");
  await seedUser("ho", "Head Office Approver", "HEADOFFICE", "SEED_HO_PASSWORD");
  await seedUser("sk", "Storekeeper One", "SK", "SEED_SK_PASSWORD");
}

main()
  .catch((e) => {
    console.error("Seeding failed:", e);
    process.exit(1);
  });
