# E&C Super Master System

The **Master Portal** for Edward & Christie (Pvt) Ltd — one front door over the company's four operational systems, with **separate logins and separate dashboards** for each:

| Tile | System | Repository |
|---|---|---|
| ⛽ | Fleet Fuel & Billing Portal | `yohan114/Fuel-System-V2` |
| 🏗️ | Main Stores Console | `yohan114/Main-stros-system` |
| 🔧 | Workshop & Stores Unified System | `yohan114/Store-Database` |
| 🛢️ | Oil Stock Book | `yohan114/oil-stock-book` |

The portal links, monitors and aggregates the four systems read-only; it never edits their data and never shares sessions between them. On top of the launcher and executive overview it builds the **master data spine** (one canonical machine & site list) and the **profit engine**: `Profit = income billed (Fuel system invoices) − true cost (fuel + parts + labour + oil + batteries)` per site, per machine, per month.

**Start here → [`SUPER_MASTER_PLAN.md`](./SUPER_MASTER_PLAN.md)** — the full architecture, verified fact sheets for all four systems, the security gate, the port map, and the M0–M7 roadmap.

## The portal app (this repo)

Next.js 16 · React 19 · Prisma 7 + SQLite · Tailwind 4 · JWT (`jose`) cookie auth — the same house stack as the Fuel and Main Stores systems. Serves on **port 4400**.

### Run it

```bash
cp .env.example .env          # set PORTAL_AUTH_SECRET (required in prod) and the *_BASE_URL values
npm install
npx prisma migrate deploy     # or: npx prisma db push   (creates data/portal.db)
npm run seed                  # portal admin + registers the four systems (prints the admin password)
npm run build && npm start    # http://localhost:4400
```

Sign in with the `admin` account the seed prints. Field staff never need a portal account — they use each system's own login.

### What's built (M0–M6, all runtime-verified)

- **Launcher** — a tile per system with a live up/down dot (polled from each system's `/api/health`); "Open system" links out to that system's own login. Portal login uses its own `portal_session` cookie + `PORTAL_AUTH_SECRET`, never shared with a system.
- **Per-system KPIs** — each tile shows headline numbers from that system's token-authed `/api/portal/summary`, with last-known-good on outage.
- **`/overview`** — the company-wide KPI wall with an attention rollup; every figure deep-links into the owning system.
- **`/machines`, `/machines/[code]`, `/sites`, `/admin/mappings`** — the master data spine: the same machine unified across systems by E&C code, with an unmapped queue + mapping workbench.
- **`/profit`** — per-site and per-machine P/L (income billed vs cost by category), with an unattributed bucket and CSV export.
- **`/alerts`** — systems down beyond the threshold, escalating warning → critical.
- **Deployment** — `DEPLOYMENT.md` + `deploy/` (Caddy reverse proxy, PM2 supervision, off-machine backup scripts).

Security-gate, health, KPI, entity and cost endpoints were added to the four system repos (separate draft PRs). The remaining optional depth is **M7** in `SUPER_MASTER_PLAN.md` §7.
