# E&C Super Master System — Deployment & Operations

The single source of truth for standing up and running the whole estate on one
machine — as **ONE Node process** (the unified server hosts the portal and all
four systems on one port), behind one reverse proxy, kept alive by a
supervisor, and backed up off-machine.

Config artifacts referenced here live in [`deploy/`](./deploy):
`Caddyfile` (reverse proxy), `ecosystem.config.js` (PM2 supervision),
`backup-all.ps1` / `backup-all.sh` (off-machine backups).

---

## 1. One process, one port (single source of truth)

The unified server — `Final-system/server/unified.mjs` — boots the Master
Portal plus all four systems inside a single Node process on port **4400** and
routes each request by hostname. A small VPS runs exactly two things: this
process and Caddy.

| Process | Port | Start command |
|---|---|---|
| **E&C unified server** (portal + all 4 systems) | **4400** | `npm run start:unified` in `Final-system` (set `EC_ROOT`) |
| Reverse proxy (Caddy) | **80 / 443** | `caddy run --config deploy/Caddyfile` |

`EC_ROOT` is the folder holding the five repo checkouts (defaults to the
parent of `Final-system`). Folder names are the repo names; override any
location with `FUEL_APP_DIR` / `MAINSTORES_APP_DIR` / `WORKSHOP_APP_DIR` /
`OILBOOK_APP_DIR`.

**Before first start (and after every update):** build each Next app once —
`next build` in `Final-system`, `Fuel-System-V2` and `Main-stros-system`, and
`npm run build` in `oil-stock-book/client`. The unified server serves the
production builds.

Each system keeps its **own login, own dashboard, and own database** — the
unified server only owns the socket. Every system can still run standalone
(`npm start` / `node server.js` in its repo) for development; the old
five-process port map (3000/1111/3300/5000/4400) still applies there.

> Inside the unified process, requests to `/__sys/<systemKey>/api/*` form the
> portal's server-to-server channel to each system (health, KPIs, costs) —
> API-only, token-authed by each system as usual.

## 2. Subdomain map — one main link, four subs

The portal is the **one main link**; each system opens on a **sub-domain of the
portal host**, so the estate reads as a single hierarchy. Caddy terminates TLS
and proxies **every host to the same unified process (:4400)**, which routes by
hostname internally:

| Host | → | System |
|---|---|---|
| `portal.ec-workshops.online` — **main** | :4400 | Master Portal |
| `fuel.portal.ec-workshops.online` | :4400 | Fuel & Billing |
| `stores.portal.ec-workshops.online` | :4400 | Main Stores |
| `workshop.portal.ec-workshops.online` | :4400 | Workshop & Stores |
| `oil.portal.ec-workshops.online` | :4400 | Oil Stock Book |

**DNS:** point one wildcard record `*.portal.ec-workshops.online` (plus the apex
`portal.ec-workshops.online`) at this machine — that single record covers all
four subs. Or add the four A records individually if you prefer no wildcard.

**TLS:** Caddy provisions a certificate **per host** automatically (Let's
Encrypt); every host is named explicitly in `deploy/Caddyfile`, so no wildcard
*certificate* is required.

**One-value config:** set `PORTAL_PUBLIC_DOMAIN=portal.ec-workshops.online` in
the portal's env and the seed derives every system's browser-facing `openUrl`
from it — no per-system URLs to maintain. `<SYS>_OPEN_URL` still overrides a
single system if ever needed.

LAN-only (no public DNS): use the `tls internal` variant in `deploy/Caddyfile`
and add the names to office DNS or `hosts` files.

## 3. Environment variables — ONE .env for the whole box

In unified mode, **`Final-system/.env` is the single config file**. The unified
server loads it first (its values are authoritative), then each app's own
`.env` — without overriding — so per-repo files still work for development.

Set in `Final-system/.env`:

| Purpose | Variables |
|---|---|
| Main link + subs | `PORTAL_PUBLIC_DOMAIN=portal.ec-workshops.online` (derives every system's sub-domain address) |
| Portal auth | `PORTAL_AUTH_SECRET`, `SEED_PORTAL_ADMIN_PASSWORD` (first run) |
| System auth | `FUEL_AUTH_SECRET`, `MAINSTORES_AUTH_SECRET` (distinct long random values) |
| Portal ↔ system tokens | `FUEL_PORTAL_TOKEN`, `MAINSTORES_PORTAL_TOKEN`, `WORKSHOP_PORTAL_TOKEN`, `OILBOOK_PORTAL_TOKEN` — in unified mode each system reads the **same** variable the portal uses, so one value per system configures both sides |
| Health polling (unified) | `FUEL_BASE_URL=http://127.0.0.1:4400/__sys/fuel`, `MAINSTORES_BASE_URL=http://127.0.0.1:4400/__sys/mainstores`, `WORKSHOP_BASE_URL=http://127.0.0.1:4400/__sys/workshop`, `OILBOOK_BASE_URL=http://127.0.0.1:4400/__sys/oilbook` (then re-run the portal seed) |
| Cron | `CRON_SECRET` — one value serves both the portal digest and the Fuel cron endpoints in unified mode |
| Optional | `SMTP_*` (alert digest email), `BUSINESS_TZ=Asia/Colombo`, `COOKIE_SECURE=true` |

Database locations are derived automatically (each app's own file, absolute):
override with `PORTAL_DATABASE_URL` / `FUEL_DATABASE_URL` /
`MAINSTORES_DATABASE_URL` / `INVENTORY_DB` only if a DB lives elsewhere.

Generate every secret/token as a distinct random value:

```bash
node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"
```

Production **hard-fails** if an auth secret is unset or left at its dev default.

## 4. Startup order

1. Ensure each database exists (run migrations/seed once — see each repo's README).
2. Build the Next apps + oil-book client (see §1), then start the unified
   process (PM2 brings it up and keeps it alive).
3. Start Caddy last (it just needs port 4400 listening).

The portal tolerates a system failing to boot (its tile shows red, `/alerts`
flags it, everything else keeps serving) — the unified server never lets one
broken app take down the estate.

## 5. Process supervision

Use PM2 so the unified process restarts on crash and on reboot:

```bash
npm i -g pm2
export EC_ROOT=/opt/ec              # folder holding the five checkouts
pm2 start Final-system/deploy/ecosystem.config.js
pm2 save
pm2 startup                         # Linux/macOS: enable boot start
```

On **Windows**, run PM2 itself as a service so it survives reboot — use
[`pm2-installer`](https://github.com/jessety/pm2-installer), or wrap
`pm2 resurrect` in an **NSSM** service. (The systems' existing `.bat`/`.vbs`
scripts also work but do not restart on crash — prefer PM2/NSSM.)

Health checks for a supervisor/uptime probe: `GET /api/health` on every host
(all five systems expose it through the one process) returns 200 when healthy,
503 when that system's DB is unreachable — e.g.
`https://fuel.portal.ec-workshops.online/api/health`.

## 6. Backups

**Local, per system** (consistent snapshots into each repo's `backups/`):

| System | Mechanism |
|---|---|
| Fuel | `scripts/backup.ts` (`backup.cron` setting; nightly) |
| Workshop | automatic half-hourly `db.backup()` |
| Oil Stock Book | daily `VACUUM INTO` |
| **Main Stores** | **`npm run backup`** (added in M6 — schedule it) |
| Portal | `data/portal.db` (copied by the off-machine job) |

**Off-machine** (the critical gap — one disk holds every DB and every local
backup): schedule `deploy/backup-all.ps1` (Windows) or `deploy/backup-all.sh`
(POSIX) to copy a consistent snapshot of all five databases to a network share
or rotated disk. Set `EC_ROOT` and `EC_BACKUP_DEST`; retention defaults to 30
days. **Do a restore drill** — copy a backup back and boot against it — before
trusting it.

## 7. Alerts

The portal's **/alerts** page rolls the health-poll history into a prioritised
feed: a system that fails its latest health check appears as a warning and
escalates to **critical** after ~5 minutes with no successful check. (Backup-
staleness alerts arrive in M7, once each system reports its last backup time.)

## 8. First-run checklist

- [ ] Point DNS: `portal.ec-workshops.online` + `*.portal.ec-workshops.online` at the VPS.
- [ ] In `Final-system/.env`: set `PORTAL_PUBLIC_DOMAIN`, every `*_AUTH_SECRET` /
      `PORTAL_AUTH_SECRET` (long random values), the four `*_PORTAL_TOKEN`, and
      the four `*_BASE_URL` pointing at `http://127.0.0.1:4400/__sys/<key>`.
- [ ] Run migrations + seed for each system and the portal; **rotate all seeded passwords**.
- [ ] Build the three Next apps + the oil-book client (§1).
- [ ] `COOKIE_SECURE=true` once served over HTTPS.
- [ ] Start the unified process under PM2; `pm2 save`; enable boot start / Windows service.
- [ ] Start Caddy; confirm the main link and each sub-domain loads and each system's own login works.
- [ ] Schedule `backup-all.*` off-machine; run a restore drill.
- [ ] Open the portal `/alerts` and confirm all systems are green.
