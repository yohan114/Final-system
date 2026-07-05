# E&C Super Master System

The **Master Portal** for Edward & Christie (Pvt) Ltd — one front door over the company's four operational systems, with **separate logins and separate dashboards** for each:

| Tile | System | Repository |
|---|---|---|
| ⛽ | Fleet Fuel & Billing Portal | `yohan114/Fuel-System-V2` |
| 🏗️ | Main Stores Console | `yohan114/Main-stros-system` |
| 🔧 | Workshop & Stores Unified System | `yohan114/Store-Database` |
| 🛢️ | Oil Stock Book | `yohan114/oil-stock-book` |

The portal links, monitors and aggregates the four systems read-only; it never edits their data and never shares sessions between them. On top of the launcher and executive overview it builds the **master data spine** (one canonical machine & site list) and the **profit engine**: `Profit = income billed (Fuel system invoices) − true cost (fuel + parts + labour + oil + batteries)` per site, per machine, per month.

**Start here → [`SUPER_MASTER_PLAN.md`](./SUPER_MASTER_PLAN.md)** — the full architecture, verified fact sheets for all four systems, the security gate, the port map, and the M0–M6 roadmap.
