// Online backup of the Main Stores database — the one E&C system that shipped
// without a backup mechanism. Produces a consistent snapshot (safe under WAL)
// into ./backups and keeps the newest N. Schedule via cron / Task Scheduler:
//   node scripts/backup.js
// The off-machine copy (deploy/backup-all.* in the Final-system repo) then
// carries these snapshots off the box.

const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

const src = (process.env.DATABASE_URL || "file:./dev.db").replace(/^file:/, "");
const srcPath = path.resolve(src);
const dir = path.resolve("backups");
const KEEP = Number(process.env.BACKUP_KEEP || 30);

async function main() {
  if (!fs.existsSync(srcPath)) {
    console.error("Database not found:", srcPath);
    process.exit(1);
  }
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dest = path.join(dir, `dev_${stamp}.db`);

  const db = new Database(srcPath, { readonly: true });
  await db.backup(dest);
  db.close();
  console.log("backup ->", dest);

  // Retention: keep the newest KEEP (ISO timestamps sort chronologically).
  const files = fs.readdirSync(dir).filter((f) => /^dev_.*\.db$/.test(f)).sort();
  for (const f of files.slice(0, Math.max(0, files.length - KEEP))) {
    fs.rmSync(path.join(dir, f), { force: true });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
