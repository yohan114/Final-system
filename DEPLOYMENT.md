# E&C Super Master System — Deployment & Operations (M6)

The single source of truth for standing up and running the five processes on one
machine: the four systems + the Master Portal, behind one reverse proxy, kept
alive by a supervisor, and backed up off-machine.

Config artifacts referenced here live in [`deploy/`](./deploy):
`Caddyfile` (reverse proxy), `ecosystem.config.js` (PM2 supervision),
`backup-all.ps1` / `backup-all.sh` (off-machine backups).

---

## 1. Port map (single source of truth)

| Process | Port | Repo | Start command |
|---|---|---|---|
| Oil Stock Book | **3000** | `oil-stock-book` | `node server/index.js` (`PORT=3000`) |
| Main Stores Console | **1111** | `Main-stros-system` | `next start -p 1111` |
| Fleet Fuel & Billing | **3300** | `Fuel-System-V2` | `next start -p 3300` |
| Workshop & Stores | **5000** | `Store-Database` | `node server.js` (`PORT=5000`) |
| **Master Portal** | **4400** | `Final-system` | `next start -p 4400` |
| Reverse proxy (Caddy) | **80 / 443** | — | `caddy run --config deploy/Caddyfile` |

> Never start a Next app without an explicit `-p` — the Oil Stock Book owns
> Next's default port 3000.

## 2. Subdomain map

Caddy terminates TLS and reverse-proxies each host to its local port:

| Host | → | Process |
|---|---|---|
| `portal.ec-workshops.online` | :4400 | Master Portal |
| `fuel-portal.ec-workshops.online` | :3300 | Fuel & Billing |
| `stores.ec-workshops.online` | :1111 | Main Stores |
| `workshop.ec-workshops.online` | :5000 | Workshop & Stores |
| `oil.ec-workshops.online` | :3000 | Oil Stock Book |

LAN-only (no public DNS): use the `tls internal` variant in `deploy/Caddyfile`
and add the names to office DNS or `hosts` files.

## 3. Environment variables

Each app loads its own environment (the Next apps read `.env` automatically; the
Express apps read process env / their start scripts). **Never share a secret
across systems.** Set at least:

| System | Required | Notes |
|---|---|---|
| Fuel | `FUEL_AUTH_SECRET`, `CRON_SECRET`, `PORTAL_TOKEN` | `DATABASE_URL`, `SMTP_*` optional; `SEED_ADMIN_PASSWORD` on first install |
| Main Stores | `MAINSTORES_AUTH_SECRET`, `PORTAL_TOKEN` | `SEED_ADMIN_PASSWORD` / `SEED_HO_PASSWORD` / `SEED_SK_PASSWORD` on first install |
| Workshop | `PORTAL_TOKEN`, `COOKIE_SECURE=true`, `BUSINESS_TZ=Asia/Colombo` | `SMTP_*` optional; `SEED_ADMIN_PASSWORD` / `SEED_APPROVER_PASSWORD` |
| Oil Stock Book | `PORTAL_TOKEN` | `SEED_ADMIN_PASSWORD` on first install |
| Portal | `PORTAL_AUTH_SECRET`, `SEED_PORTAL_ADMIN_PASSWORD`, and per-system `FUEL_PORTAL_TOKEN` / `MAINSTORES_PORTAL_TOKEN` / `WORKSHOP_PORTAL_TOKEN` / `OILBOOK_PORTAL_TOKEN` | plus `*_BASE_URL` / `*_OPEN_URL` — see `.env.example` |

**Portal tokens must match:** each system's `PORTAL_TOKEN` equals the value the
portal holds for it (`<SYSTEM>_PORTAL_TOKEN`). Generate a distinct random token
per system:

```bash
node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"
```

Generate every `*_AUTH_SECRET` the same way. Production **hard-fails** if an auth
secret is unset or left at its dev default.

## 4. Startup order

1. Ensure each database exists (run migrations/seed once — see each repo's README).
2. Start the five app processes (PM2 brings them up together).
3. Start Caddy last (it just needs the ports listening).

The portal tolerates systems being down (tiles show red, `/alerts` flags them),
so strict ordering isn't required — but bringing apps up before the proxy avoids
transient 502s.

## 5. Process supervision

Use PM2 so every process restarts on crash and on reboot:

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

Health checks for a supervisor/uptime probe: `GET /api/health` on every process
(all five expose it) returns 200 when healthy, 503 when the DB is unreachable.

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

- [ ] Set every `*_AUTH_SECRET` / `PORTAL_AUTH_SECRET` to a long random value.
- [ ] Set each system's `PORTAL_TOKEN` and the portal's matching `*_PORTAL_TOKEN`.
- [ ] Run migrations + seed for each system; **rotate all seeded passwords**.
- [ ] `COOKIE_SECURE=true` once served over HTTPS.
- [ ] Start apps under PM2; `pm2 save`; enable boot start / Windows service.
- [ ] Start Caddy; confirm each subdomain loads and each system's own login works.
- [ ] Schedule `backup-all.*` off-machine; run a restore drill.
- [ ] Open the portal `/alerts` and confirm all systems are green.
