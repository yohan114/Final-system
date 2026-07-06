# E&C Super Master System — Deployment & Operations

The single source of truth for standing up and running the whole estate on one
machine — as **ONE Node process** (the unified server hosts the portal and all
four systems on one port), behind one reverse proxy, kept alive by a
supervisor, and backed up off-machine.

Config artifacts referenced here live in [`deploy/`](./deploy):
`Caddyfile` (reverse proxy), `ecosystem.config.js` (PM2 supervision),
`setup-vps.sh` (one-command setup), `backup-all.ps1` / `backup-all.sh`
(off-machine backups).

> **Fast path:** on a fresh VPS with git + Node 20+, run
> `bash deploy/setup-vps.sh` — it clones this one repo, installs, generates
> all secrets into `.env`, prepares the databases, builds, and starts the
> unified server under PM2. Only DNS, Caddy, and copying your real data (§6)
> remain manual. §§1–5 below describe what it automates.

---

## 1. One process, one port (single source of truth)

**ONE repository, one process.** This repo holds the whole estate — the Master
Portal at the root and the four systems in `apps/`:

```
Final-system/              ← the ONE repo you clone
├─ src/ …                  Master Portal (Next.js)
├─ server/unified.mjs      the single process serving everything
├─ apps/
│  ├─ fuel/                Fleet Fuel & Billing   (Next.js)
│  ├─ stores/              Main Stores Console    (Next.js)
│  ├─ workshop/            Workshop & Stores      (Express)
│  └─ oilbook/             Oil Stock Book         (Express + React)
└─ deploy/                 Caddyfile · PM2 · setup-vps.sh · backups
```

The unified server boots the portal plus all four apps inside a single Node
process on port **4400** and routes each request by hostname. A small VPS runs
exactly two things: this process and Caddy.

| Process | Port | Start command |
|---|---|---|
| **E&C unified server** (portal + all 4 systems) | **4400** | `npm run start:unified` in `Final-system` |
| Reverse proxy (Caddy) | **80 / 443** | `caddy run --config deploy/Caddyfile` |

App locations resolve automatically to `apps/*`; an explicit `FUEL_APP_DIR` /
`MAINSTORES_APP_DIR` / `WORKSHOP_APP_DIR` / `OILBOOK_APP_DIR` overrides one,
and the pre-monorepo layout (sibling checkouts under `EC_ROOT`) still works as
a fallback for older installs.

**Before first start (and after every update):** build once — `next build` at
the repo root, in `apps/fuel` and `apps/stores`, and `npm run build` in
`apps/oilbook/client`. The unified server serves the production builds.
(`deploy/setup-vps.sh` does all of this.)

Each system keeps its **own login, own dashboard, and own database** — the
unified server only owns the socket. Every app still runs standalone for
development (`npm run dev` / `node server.js` inside its folder); the old
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
| Single sign-on | `FUEL_SSO_SECRET`, `MAINSTORES_SSO_SECRET`, `WORKSHOP_SSO_SECRET`, `OILBOOK_SSO_SECRET` — sign in once at the portal and "Open system" arrives already signed in (matched by username). Same one-variable-per-pair pattern; unset = that system's tile links plainly and its own login is used |
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

## 6. Moving your real data onto the VPS

Each system's data is a single SQLite file (plus, for two systems, an uploads
folder). Copy them from wherever the systems run today into the monorepo
checkout on the VPS — `setup-vps.sh` never overwrites an existing database, so
you can copy before or after running it.

**Step 1 — stop the old system first.** SQLite keeps recent writes in `-wal`
side files; copying while the app runs can lose or corrupt data. Stop the app
(or at least close every open page), then copy the `.db` file **together with
its `.db-wal` and `.db-shm` files if they exist**.

**Step 2 — copy these files** (source path is inside each old system's folder;
target is inside `/opt/ec/Final-system` on the VPS):

| System | Copy from (old machine) | Copy to (VPS) |
|---|---|---|
| Fuel | `data/app.db` (+ `-wal`/`-shm`) | `apps/fuel/data/` |
| Main Stores | `dev.db` (+ sidecars) **and** `public/uploads/` if present | `apps/stores/` and `apps/stores/public/uploads/` |
| Workshop | `inventory.db` (+ sidecars) | `apps/workshop/` |
| Oil Book | `data/oilbook.db` (+ sidecars) **and** `data/uploads/` (battery photos) | `apps/oilbook/data/` and `apps/oilbook/data/uploads/` |

**How to copy — from a Windows office PC:** install
[WinSCP](https://winscp.net) (free), connect to the VPS IP with your SSH
login, and drag the files into the target folders. Or from PowerShell:

```powershell
scp C:\path\to\Fuel-System-V2\data\app.db* root@YOUR-VPS-IP:/opt/ec/Final-system/apps/fuel/data/
scp C:\path\to\Main-stros-system\dev.db* root@YOUR-VPS-IP:/opt/ec/Final-system/apps/stores/
scp -r C:\path\to\Main-stros-system\public\uploads root@YOUR-VPS-IP:/opt/ec/Final-system/apps/stores/public/
scp C:\path\to\Store-Database\inventory.db* root@YOUR-VPS-IP:/opt/ec/Final-system/apps/workshop/
scp C:\path\to\oil-stock-book\data\oilbook.db* root@YOUR-VPS-IP:/opt/ec/Final-system/apps/oilbook/data/
scp -r C:\path\to\oil-stock-book\data\uploads root@YOUR-VPS-IP:/opt/ec/Final-system/apps/oilbook/data/
```

**From another Linux server:** same paths with `scp`/`rsync` from that machine.

**Step 3 — apply migrations and restart:**

```bash
cd /opt/ec/Final-system/apps/fuel && npx prisma migrate deploy   # fuel schema up to date
cd /opt/ec/Final-system/apps/stores && npx prisma db push        # stores schema up to date
pm2 restart ec-unified
```

(Workshop and Oil Book migrate their own schema automatically on start.)
Then merge the real history into the master database and restart:

```bash
cd /opt/ec/Final-system && npm run import:history
```

The import is idempotent — re-run it any time (or schedule it hourly via cron)
to keep the master database current until the operational modules move in.
Then open the portal — the tiles and dashboards show your real numbers.

## 7. Backups

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

## 8. Alerts

The portal's **/alerts** page rolls the health-poll history into a prioritised
feed: a system that fails its latest health check appears as a warning and
escalates to **critical** after ~5 minutes with no successful check. Each
system also reports its newest on-disk backup with its KPI summary; a system
with **no backup** or a backup older than **48 hours** raises a warning, and
older than **7 days** goes critical — so a silently broken backup job can't
hide. The alert email digest carries these too.

## 9. First-run checklist

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
