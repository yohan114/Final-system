// M13-P2 · Full-history import — pulls the complete records out of the four
// systems' SQLite databases into the master database, so every analytics view
// runs against ONE database. Reads each source read-only and upserts by
// sourceRef, so re-running is always safe (idempotent); machines resolve to
// the canonical registry (MachineMap) by normalized E&C code, created on
// first sight. Run:  npm run import:history   (re-run any time / via cron).
import "dotenv/config";
import path from "node:path";
import fs from "node:fs";
import Database from "better-sqlite3";
import { prisma } from "../src/lib/db";
import { normCode } from "../src/lib/spine";

const ROOT = path.resolve(__dirname, "..");
const appDir = (env: string, mono: string, legacy: string) =>
  process.env[env] || (fs.existsSync(path.join(ROOT, "apps", mono)) ? path.join(ROOT, "apps", mono) : path.join(path.dirname(ROOT), legacy));

const FUEL_DB = path.join(appDir("FUEL_APP_DIR", "fuel", "Fuel-System-V2"), "data", "app.db");
const STORES_DB = path.join(appDir("MAINSTORES_APP_DIR", "stores", "Main-stros-system"), "dev.db");
const WORKSHOP_DB = path.join(appDir("WORKSHOP_APP_DIR", "workshop", "Store-Database"), "inventory.db");
const OILBOOK_DB = path.join(appDir("OILBOOK_APP_DIR", "oilbook", "oil-stock-book"), "data", "oilbook.db");

function toDate(v: unknown): Date | null {
  if (v == null) return null;
  if (typeof v === "number") return new Date(v);
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? null : d;
}
const monthOf = (d: Date) => d.toISOString().slice(0, 7);
const cents = (n: unknown) => Math.round((Number(n) || 0) * 100);

// Canonical machine resolver, cached. Real registries (asset tables, E&C
// numbers) may CREATE canonical machines; free-text references (a vehicle
// typed on an MRN line) only LINK when the code already exists — otherwise
// they would flood the registry with junk entries.
const machineCache = new Map<string, string | null>();
async function machineIdFor(
  codeRaw: unknown,
  label?: string | null,
  opts: { createIfMissing?: boolean } = { createIfMissing: true }
): Promise<string | null> {
  const code = normCode(codeRaw == null ? "" : String(codeRaw));
  if (!code) return null;
  if (machineCache.has(code)) return machineCache.get(code) ?? null;
  let id: string | null = null;
  if (opts.createIfMissing !== false) {
    const row = await prisma.machineMap.upsert({
      where: { canonicalCode: code },
      update: {},
      create: { canonicalCode: code, label: label || code },
    });
    id = row.id;
  } else {
    const row = await prisma.machineMap.findUnique({ where: { canonicalCode: code } });
    id = row?.id ?? null;
  }
  machineCache.set(code, id);
  return id;
}

interface Tally { table: string; rows: number; cents: number }
const tallies: Tally[] = [];
const note = (table: string, rows: number, c = 0) => {
  tallies.push({ table, rows, cents: c });
  console.log(`  ✓ ${table}: ${rows} rows${c ? ` · Rs ${Math.round(c / 100).toLocaleString("en-LK")}` : ""}`);
};

async function importFuelSystem() {
  if (!fs.existsSync(FUEL_DB)) return console.log("  – fuel DB not found, skipped");
  const db = new Database(FUEL_DB, { readonly: true });

  const issues = db.prepare(`
    SELECT i.id, i.litres, i.totalCost, i.fuelKind, i.source, i.issueDate, i.voided,
           a.code AS assetCode, a.site AS assetSite, u.username AS issuedBy
    FROM FuelIssue i JOIN Asset a ON a.id = i.assetId LEFT JOIN User u ON u.id = i.issuedById`).all() as any[];
  let sum = 0;
  for (const r of issues) {
    const at = toDate(r.issueDate)!;
    sum += r.totalCost;
    await prisma.fuelRecord.upsert({
      where: { sourceRef: `fuel:issue:${r.id}` },
      update: { voided: !!r.voided, amountCents: r.totalCost, litres: r.litres },
      create: {
        sourceRef: `fuel:issue:${r.id}`,
        machineCode: normCode(r.assetCode) || null,
        machineId: await machineIdFor(r.assetCode),
        siteRef: r.assetSite || null,
        fuelKind: r.fuelKind, source: r.source, litres: r.litres,
        amountCents: r.totalCost, issuedBy: r.issuedBy || null,
        voided: !!r.voided, occurredAt: at, month: monthOf(at),
      },
    });
  }
  note("FuelRecord", issues.length, sum);

  const bills = db.prepare(`
    SELECT id, periodKey, assetCode, projectName, rentalAmountCents, fuelCostCents,
           ssclCents, vatCents, grandTotalCents, status, invoiceNumber, periodStart
    FROM Bill`).all() as any[];
  let billSum = 0;
  for (const r of bills) {
    const at = toDate(r.periodStart)!;
    billSum += r.grandTotalCents;
    await prisma.incomeRecord.upsert({
      where: { sourceRef: `fuel:bill:${r.id}` },
      update: { status: r.status, totalCents: r.grandTotalCents },
      create: {
        sourceRef: `fuel:bill:${r.id}`,
        machineCode: normCode(r.assetCode) || null,
        machineId: await machineIdFor(r.assetCode),
        siteRef: r.projectName || null,
        rentalCents: r.rentalAmountCents, fuelCents: r.fuelCostCents,
        taxCents: (r.ssclCents || 0) + (r.vatCents || 0),
        totalCents: r.grandTotalCents, status: r.status,
        invoiceNo: r.invoiceNumber || null,
        occurredAt: at, month: r.periodKey || monthOf(at),
      },
    });
  }
  note("IncomeRecord", bills.length, billSum);

  const meters = db.prepare(`
    SELECT m.id, m.value, m.readingType, m.readingDate, a.code AS assetCode
    FROM MeterReading m JOIN Asset a ON a.id = m.assetId`).all() as any[];
  for (const r of meters) {
    const at = toDate(r.readingDate)!;
    await prisma.meterRecord.upsert({
      where: { sourceRef: `fuel:meter:${r.id}` },
      update: { value: r.value },
      create: {
        sourceRef: `fuel:meter:${r.id}`,
        machineCode: normCode(r.assetCode) || null,
        machineId: await machineIdFor(r.assetCode),
        value: r.value, readingType: r.readingType,
        occurredAt: at, month: monthOf(at),
      },
    });
  }
  note("MeterRecord", meters.length);

  const services = db.prepare(`
    SELECT s.id, s.serviceDate, s.serviceType, s.costCents, s.partsCents, s.labourCents,
           s.jobNo, s.note, a.code AS assetCode, a.site AS assetSite
    FROM ServiceRecord s JOIN Asset a ON a.id = s.assetId`).all() as any[];
  let svcSum = 0;
  for (const r of services) {
    const at = toDate(r.serviceDate)!;
    svcSum += r.costCents || 0;
    await prisma.maintenanceRecord.upsert({
      where: { sourceRef: `fuel:service:${r.id}` },
      update: { totalCents: r.costCents || 0 },
      create: {
        sourceRef: `fuel:service:${r.id}`,
        systemKey: "fuel", kind: "service",
        machineCode: normCode(r.assetCode) || null,
        machineId: await machineIdFor(r.assetCode),
        siteRef: r.assetSite || null,
        description: [r.serviceType, r.note].filter(Boolean).join(" — ") || null,
        status: "DONE", jobNo: r.jobNo || null,
        partsCents: r.partsCents || 0, labourCents: r.labourCents || 0,
        totalCents: r.costCents || 0,
        occurredAt: at, month: monthOf(at),
      },
    });
  }
  note("MaintenanceRecord (fuel services)", services.length, svcSum);

  // Live machine snapshot: status + latest meter per asset.
  const assets = db.prepare(`SELECT id, code, status, site FROM Asset`).all() as any[];
  const latestMeter = db.prepare(
    `SELECT value, readingType FROM MeterReading WHERE assetId = ? ORDER BY value DESC LIMIT 1`);
  let snaps = 0;
  for (const a of assets) {
    const machineId = await machineIdFor(a.code);
    if (!machineId) continue;
    const meter = latestMeter.get(a.id) as any;
    await prisma.machineSnapshot.upsert({
      where: { machineId_systemKey: { machineId, systemKey: "fuel" } },
      update: { status: a.status, meterValue: meter?.value ?? null, meterType: meter?.readingType ?? null, siteRef: a.site || null },
      create: { machineId, systemKey: "fuel", status: a.status, meterValue: meter?.value ?? null, meterType: meter?.readingType ?? null, siteRef: a.site || null },
    });
    snaps++;
  }
  note("MachineSnapshot (fuel)", snaps);
  db.close();
}

async function importWorkshop() {
  if (!fs.existsSync(WORKSHOP_DB)) return console.log("  – workshop DB not found, skipped");
  const db = new Database(WORKSHOP_DB, { readonly: true });

  const jobs = db.prepare(`
    SELECT id, jobNo, status, dateISO, projectName, vehicleMachinery, ecdNo, driverName,
           labourCost, recordedCost, details, repairType, startedAt, completedAt, closedAt
    FROM jobcards`).all() as any[];
  let jobSum = 0;
  for (const r of jobs) {
    const at = toDate(r.dateISO) ?? toDate(r.startedAt) ?? new Date();
    const total = Math.max(cents(r.recordedCost), cents(r.labourCost));
    jobSum += total;
    await prisma.maintenanceRecord.upsert({
      where: { sourceRef: `workshop:job:${r.id}` },
      update: { status: r.status || null, totalCents: total, closedAt: toDate(r.closedAt) ?? toDate(r.completedAt) },
      create: {
        sourceRef: `workshop:job:${r.id}`,
        systemKey: "workshop", kind: "jobcard",
        machineCode: normCode(r.ecdNo) || null,
        machineId: await machineIdFor(r.ecdNo, r.vehicleMachinery),
        siteRef: r.projectName || null,
        description: [r.vehicleMachinery, r.repairType, r.details].filter(Boolean).join(" — ").slice(0, 500) || null,
        status: r.status || null, driverName: r.driverName || null, jobNo: r.jobNo || null,
        labourCents: cents(r.labourCost), totalCents: total,
        openedAt: toDate(r.startedAt), closedAt: toDate(r.closedAt) ?? toDate(r.completedAt),
        occurredAt: at, month: monthOf(at),
      },
    });
  }
  note("MaintenanceRecord (workshop jobs)", jobs.length, jobSum);

  const receipts = db.prepare(`
    SELECT r.id, r.qty, r.unitPrice, r.grnNumber, r.supplierName, r.deliveryDateISO,
           i.itemName, i.category, i.vehicleMachinery, i.mrnNum, i.reqDateISO
    FROM receipts r JOIN items i ON i.id = r.itemId`).all() as any[];
  let grnSum = 0;
  for (const r of receipts) {
    const at = toDate(r.deliveryDateISO) ?? toDate(r.reqDateISO) ?? new Date();
    const amount = Math.round((Number(r.qty) || 0) * (Number(r.unitPrice) || 0) * 100);
    grnSum += amount;
    await prisma.storeRecord.upsert({
      where: { sourceRef: `workshop:receipt:${r.id}` },
      update: { qty: Number(r.qty) || 0, unitCents: cents(r.unitPrice), amountCents: amount },
      create: {
        sourceRef: `workshop:receipt:${r.id}`,
        itemName: r.itemName || "(unnamed item)",
        category: r.category || null,
        machineCode: null,
        machineId: await machineIdFor(r.vehicleMachinery, null, { createIfMissing: false }),
        qty: Number(r.qty) || 0,
        unitCents: cents(r.unitPrice), amountCents: amount,
        grnNumber: r.grnNumber || null, supplier: r.supplierName || null, mrnNum: r.mrnNum || null,
        occurredAt: at, month: monthOf(at),
      },
    });
  }
  note("StoreRecord (GRN lines)", receipts.length, grnSum);
  db.close();
}

async function importOilBook() {
  if (!fs.existsSync(OILBOOK_DB)) return console.log("  – oil book DB not found, skipped");
  const db = new Database(OILBOOK_DB, { readonly: true });

  const txns = db.prepare(`
    SELECT t.id, t.kind, t.qty_received, t.qty_issued, t.txn_date, t.voided,
           p.name AS product, p.unit_price, fa.ec_code, pr.name AS project
    FROM transactions t
    JOIN products p ON p.id = t.product_id
    LEFT JOIN fleet_assets fa ON fa.id = t.asset_id
    LEFT JOIN projects pr ON pr.id = t.project_id
    WHERE t.voided = 0 AND t.kind IN ('issue','receive')`).all() as any[];
  let oilSum = 0;
  for (const r of txns) {
    const at = toDate(r.txn_date)!;
    const qty = r.kind === "issue" ? Number(r.qty_issued) || 0 : Number(r.qty_received) || 0;
    const amount = Math.round(qty * (Number(r.unit_price) || 0) * 100);
    if (r.kind === "issue") oilSum += amount;
    await prisma.oilRecord.upsert({
      where: { sourceRef: `oilbook:txn:${r.id}` },
      update: { qty, amountCents: amount },
      create: {
        sourceRef: `oilbook:txn:${r.id}`,
        product: r.product, kind: r.kind, qty, amountCents: amount,
        machineCode: normCode(r.ec_code) || null,
        machineId: await machineIdFor(r.ec_code),
        siteRef: r.project || null,
        occurredAt: at, month: monthOf(at),
      },
    });
  }
  note("OilRecord", txns.length, oilSum);

  const batteries = db.prepare(`
    SELECT b.id, b.vehicle_no, b.unit_cost, b.installed_date, b.warranty_months, b.created_at,
           fa.ec_code
    FROM batteries b LEFT JOIN fleet_assets fa ON fa.registration_norm = b.vehicle_no_norm`).all() as any[];
  let batSum = 0;
  for (const r of batteries) {
    const at = toDate(r.installed_date) ?? toDate(r.created_at) ?? new Date();
    batSum += cents(r.unit_cost);
    await prisma.batteryRecord.upsert({
      where: { sourceRef: `oilbook:battery:${r.id}` },
      update: { amountCents: cents(r.unit_cost), warrantyMonths: r.warranty_months ?? null },
      create: {
        sourceRef: `oilbook:battery:${r.id}`,
        vehicleNo: r.vehicle_no || null,
        machineCode: normCode(r.ec_code) || null,
        machineId: await machineIdFor(r.ec_code),
        amountCents: cents(r.unit_cost),
        installedAt: toDate(r.installed_date), warrantyMonths: r.warranty_months ?? null,
        occurredAt: at, month: monthOf(at),
      },
    });
  }
  note("BatteryRecord", batteries.length, batSum);

  const assets = db.prepare(`SELECT ec_code, status FROM fleet_assets WHERE ec_code IS NOT NULL AND ec_code != ''`).all() as any[];
  let snaps = 0;
  for (const a of assets) {
    const machineId = await machineIdFor(a.ec_code);
    if (!machineId) continue;
    await prisma.machineSnapshot.upsert({
      where: { machineId_systemKey: { machineId, systemKey: "oilbook" } },
      update: { status: a.status || null },
      create: { machineId, systemKey: "oilbook", status: a.status || null },
    });
    snaps++;
  }
  note("MachineSnapshot (oil book)", snaps);
  db.close();
}

async function importStores() {
  if (!fs.existsSync(STORES_DB)) return console.log("  – stores DB not found, skipped");
  const db = new Database(STORES_DB, { readonly: true });
  const machines = db.prepare(`
    SELECT m.code, m.name, m.status, m.condition, s.name AS siteName
    FROM Machine m LEFT JOIN Site s ON s.id = m.siteId`).all() as any[];
  let snaps = 0;
  for (const m of machines) {
    const machineId = await machineIdFor(m.code, m.name);
    if (!machineId) continue;
    await prisma.machineSnapshot.upsert({
      where: { machineId_systemKey: { machineId, systemKey: "mainstores" } },
      update: { status: [m.status, m.condition].filter(Boolean).join("/") || null, siteRef: m.siteName || null },
      create: { machineId, systemKey: "mainstores", status: [m.status, m.condition].filter(Boolean).join("/") || null, siteRef: m.siteName || null },
    });
    snaps++;
  }
  note("MachineSnapshot (main stores)", snaps);
  db.close();
}

async function main() {
  console.log("Importing full history into the master database…");
  console.log("— Fuel & Billing —");
  await importFuelSystem();
  console.log("— Workshop & Stores —");
  await importWorkshop();
  console.log("— Oil Stock Book —");
  await importOilBook();
  console.log("— Main Stores —");
  await importStores();

  const machines = await prisma.machineMap.count();
  console.log(`\nDone. Canonical machines in the registry: ${machines}.`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("IMPORT FAILED:", err);
  process.exit(1);
});
