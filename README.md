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

Sign in with the `admin` account the seed prints. The launcher shows a tile per system with a live up/down dot (polled from each system's `/api/health`); "Open system" links out to that system's own login. `/overview` is the executive-overview stub that fills in at M2–M5.

### What's built (M1)

- Portal login (`portal_session` cookie, its own `PORTAL_AUTH_SECRET`) — separate from every system's login.
- `System` registry seeded with the four systems, health polling with a 4 s timeout, `StatusSample` history.
- Launcher with live tiles (server-rendered first paint + 30 s client re-poll via `GET /api/systems/health`).
- Portal's own `GET /api/health`.

Later phases (`/api/portal/summary` reads, master-data spine, profit engine) are specified in `SUPER_MASTER_PLAN.md` §7.
