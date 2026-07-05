// E&C Super Master System — UNIFIED SERVER
//
// One Node process hosts all five systems on one port, so a small VPS runs a
// single `npm run start:unified` and nothing else. Each system keeps its own
// login, dashboard and database — this file only owns the socket and routes
// each request to the right app by the leftmost host label:
//
//   portal.<domain>            → Master Portal   (this repo, Next.js)
//   fuel.portal.<domain>       → Fuel & Billing  (Fuel-System-V2, Next.js)
//   stores.portal.<domain>     → Main Stores     (Main-stros-system, Next.js)
//   workshop.portal.<domain>   → Workshop        (Store-Database, Express)
//   oil.portal.<domain>        → Oil Stock Book  (oil-stock-book, Express)
//   anything else              → Master Portal
//
// Server-to-server (the portal's health/KPI/cost polling) uses loopback paths
// instead of hostnames:  /__sys/<systemKey>/api/*  → that system's /api/*.
// Only /api/* is reachable through this channel — pages are host-routed only.
//
// Each Next app is booted from ITS OWN directory and node_modules via the
// custom-server API (next({ dir }).prepare() + getRequestHandler()), so builds,
// assets and Prisma clients stay fully per-app. The Express apps export their
// `app` (listen() is skipped when embedded).
//
// Env collisions are solved with per-app names, set here (absolute) if unset:
//   DATABASE_URL / PORTAL_DATABASE_URL → portal DB
//   FUEL_DATABASE_URL                  → Fuel DB
//   MAINSTORES_DATABASE_URL            → Main Stores DB
// (Workshop + Oil Book resolve their DB paths from their own __dirname.)
// Portal tokens: each system prefers <SYS>_PORTAL_TOKEN, so setting the four
// portal-side token vars configures BOTH sides of every pair in this process.

import { createServer } from "node:http";
import { createRequire } from "node:module";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORTAL_DIR = path.resolve(__dirname, "..");

// ── 1. Environment ───────────────────────────────────────────────────────────
// Load the portal repo's .env first: values set here win over every app's own
// .env (later loads never override keys that already exist).
const require_ = createRequire(import.meta.url);
let dotenv = null;
try {
  dotenv = require_(path.join(PORTAL_DIR, "node_modules", "dotenv"));
  dotenv.config({ path: path.join(PORTAL_DIR, ".env") });
} catch {
  /* dotenv optional — plain process env still works */
}

// Each app's own .env, loaded WITHOUT overriding anything already set — so an
// app keeps its standalone config (e.g. Fuel's FUEL_AUTH_SECRET) while the
// unified .env stays the single source of truth for shared/conflicting keys.
function loadAppEnv(dir) {
  if (!dotenv) return;
  const file = path.join(dir, ".env");
  if (!fs.existsSync(file)) return;
  const parsed = dotenv.parse(fs.readFileSync(file));
  for (const [key, value] of Object.entries(parsed)) {
    if (!(key in process.env)) process.env[key] = value;
  }
}

const PORT = parseInt(process.env.PORT || "4400", 10);
const EC_ROOT = process.env.EC_ROOT || path.dirname(PORTAL_DIR);

const dirOf = (envName, fallbackName) => {
  const dir = process.env[envName] || path.join(EC_ROOT, fallbackName);
  return path.resolve(dir);
};

const APPS = {
  fuel: { dir: dirOf("FUEL_APP_DIR", "Fuel-System-V2"), kind: "next", sub: "fuel", name: "Fleet Fuel & Billing" },
  mainstores: { dir: dirOf("MAINSTORES_APP_DIR", "Main-stros-system"), kind: "next", sub: "stores", name: "Main Stores Console" },
  workshop: { dir: dirOf("WORKSHOP_APP_DIR", "Store-Database"), kind: "express-cjs", sub: "workshop", entry: "server.js", name: "Workshop & Stores" },
  oilbook: { dir: dirOf("OILBOOK_APP_DIR", "oil-stock-book"), kind: "express-esm", sub: "oil", entry: "server/index.js", name: "Oil Stock Book" },
};

// Per-app DB URLs — absolute, set only when not already configured, BEFORE any
// app code loads. A bare relative DATABASE_URL would resolve against this
// process's cwd and point every Prisma app at the wrong file.
const setIfUnset = (key, value) => {
  if (!process.env[key]) process.env[key] = value;
};
setIfUnset("PORTAL_DATABASE_URL", `file:${path.join(PORTAL_DIR, "data", "portal.db")}`);
setIfUnset("DATABASE_URL", process.env.PORTAL_DATABASE_URL); // pin it so no app's .env can claim it
setIfUnset("FUEL_DATABASE_URL", `file:${path.join(APPS.fuel.dir, "data", "app.db")}`);
setIfUnset("MAINSTORES_DATABASE_URL", `file:${path.join(APPS.mainstores.dir, "dev.db")}`);

// Bring in each app's standalone .env (unified values above stay authoritative).
for (const app of Object.values(APPS)) loadAppEnv(app.dir);

// ── 2. Boot each app ─────────────────────────────────────────────────────────
// A failed boot never kills the estate: that system serves 503 and the portal
// tile shows it down, matching the portal's graceful-degradation behaviour.

function unavailableHandler(name, err) {
  const message = `${name} failed to start: ${err.message}`;
  console.error(`  ✗ ${message}`);
  return (req, res) => {
    res.statusCode = 503;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ ok: false, error: `${name} is not available on this server.` }));
  };
}

async function bootNext(label, dir) {
  if (!fs.existsSync(path.join(dir, ".next"))) {
    throw new Error(`no production build in ${dir} — run \`next build\` there first`);
  }
  // Load Next from the app's OWN node_modules so versions/builds never mix.
  const appRequire = createRequire(path.join(dir, "package.json"));
  const nextModule = appRequire("next");
  const next = nextModule.default || nextModule;
  const app = next({ dev: false, dir, hostname: "127.0.0.1", port: PORT });
  await app.prepare();
  console.log(`  ✓ ${label} (Next.js) ready from ${dir}`);
  return app.getRequestHandler();
}

async function bootExpress(label, dir, entry, esm) {
  const file = path.join(dir, entry);
  if (!fs.existsSync(file)) throw new Error(`entry not found: ${file}`);
  let app;
  if (esm) {
    app = (await import(pathToFileURL(file).href)).default;
  } else {
    app = createRequire(import.meta.url)(file);
  }
  if (typeof app !== "function") throw new Error(`${entry} did not export an Express app`);
  console.log(`  ✓ ${label} (Express) ready from ${dir}`);
  return app;
}

console.log("E&C unified server — booting all systems in one process…");

const handlers = { portal: null };
try {
  handlers.portal = await bootNext("Master Portal", PORTAL_DIR);
} catch (err) {
  // Without the portal there is no front door — fail loudly.
  console.error(`FATAL: Master Portal failed to start: ${err.message}`);
  process.exit(1);
}
for (const [key, app] of Object.entries(APPS)) {
  try {
    handlers[key] =
      app.kind === "next"
        ? await bootNext(app.name, app.dir)
        : await bootExpress(app.name, app.dir, app.entry, app.kind === "express-esm");
  } catch (err) {
    handlers[key] = unavailableHandler(app.name, err);
  }
}

// ── 3. Route by host label / internal path ──────────────────────────────────
const SUB_TO_KEY = Object.fromEntries(Object.entries(APPS).map(([key, app]) => [app.sub, key]));

function dispatch(req, res) {
  // Internal server-to-server channel: /__sys/<key>/api/* → that system's /api/*.
  if (req.url.startsWith("/__sys/")) {
    const rest = req.url.slice("/__sys/".length);
    const slash = rest.indexOf("/");
    const key = slash === -1 ? rest : rest.slice(0, slash);
    const subPath = slash === -1 ? "/" : rest.slice(slash);
    if (handlers[key] && key !== "portal" && subPath.startsWith("/api/")) {
      req.url = subPath;
      return handlers[key](req, res);
    }
    res.statusCode = 404;
    return res.end("Not found");
  }

  const host = (req.headers.host || "").split(":")[0].toLowerCase();
  const label = host.split(".")[0];
  const key = SUB_TO_KEY[label];
  return (key ? handlers[key] : handlers.portal)(req, res);
}

const server = createServer((req, res) => {
  try {
    dispatch(req, res);
  } catch (err) {
    console.error("router error:", err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.end("Internal server error");
    }
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`\nE&C Super Master System — ONE process, ONE port: http://localhost:${PORT}`);
  console.log("  portal (default host)      → Master Portal");
  for (const [, app] of Object.entries(APPS)) {
    console.log(`  ${app.sub}.<portal host>${" ".repeat(Math.max(1, 12 - app.sub.length))}→ ${app.name}`);
  }
  console.log("  /__sys/<key>/api/*         → internal server-to-server channel\n");
});
