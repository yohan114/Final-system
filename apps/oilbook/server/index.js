import express from 'express';
import path from 'node:path';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { db, ROOT, hasData } from './db.js';
import { startBackupScheduler } from './backup.js';
import { authenticate, seedAdmin, sessionUser, createSession } from './auth.js';
import { UPLOADS_DIR } from './uploads.js';
import { currentBalance } from './ledger.js';

import auth from './routes/auth.js';
import users from './routes/users.js';
import products from './routes/products.js';
import transactions from './routes/transactions.js';
import assets from './routes/assets.js';
import projects from './routes/projects.js';
import analytics from './routes/analytics.js';
import aliases from './routes/aliases.js';
import settings from './routes/settings.js';
import batteries from './routes/batteries.js';
import tally from './routes/tally.js';
import requisitions from './routes/requisitions.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

// First-run convenience: seed the database from the bundled Excel files.
if (!hasData()) {
  const src = path.join(ROOT, 'data', 'source');
  if (fs.existsSync(path.join(src, 'stockbook.xlsx'))) {
    console.log('Empty database detected — importing bundled Excel data…');
    try { const { runImport } = await import('../scripts/import.js'); runImport(); }
    catch (e) { console.error('Auto-import failed (run `npm run import` manually):', e.message); }
  } else {
    console.warn('No data found. Add the Excel files to data/source/ and run `npm run import`.');
  }
}

// Ensure there is always at least one (admin) login.
seedAdmin();

// Start daily backup scheduler
startBackupScheduler();

const app = express();
app.use(express.json({ limit: '20mb' })); // room for base64 battery photos

// Battery photos & other uploads — require a valid session. Browsers do not
// send the Authorization header on <img>/<a> requests, so the token is also
// accepted via a `t` query param (the client appends it to photo URLs).
app.use('/uploads', (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : (req.query.t || req.query.token);
  if (!sessionUser(token)) return res.status(401).json({ error: 'Authentication required' });
  next();
}, express.static(UPLOADS_DIR));

app.get('/api/health', (req, res) => res.json({ ok: true, products: db.prepare('SELECT COUNT(*) n FROM products').get().n }));

// Read-only KPI summary for the E&C Master Portal. Token-authed via the
// x-portal-token header and mounted BEFORE the authenticate gate so the portal
// can read it server-to-server without a login. Never mutates.
app.get('/api/portal/summary', (req, res) => {
  const token = req.get('x-portal-token');
  const expected = process.env.OILBOOK_PORTAL_TOKEN || process.env.PORTAL_TOKEN;
  if (!expected || !token || token !== expected) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const products = db.prepare('SELECT id, reorder_level FROM products WHERE active=1').all();
  let belowReorder = 0, outOfStock = 0;
  for (const p of products) {
    const bal = currentBalance(p.id);
    if (bal <= 0) outOfStock++;
    else if (p.reorder_level != null && bal <= p.reorder_level) belowReorder++;
  }
  const issuedThisMonth = db.prepare(
    "SELECT COUNT(*) n FROM transactions WHERE voided=0 AND kind='issue' AND txn_date >= date('now','start of month')"
  ).get().n;
  const pendingReqs = db.prepare("SELECT COUNT(*) n FROM requisitions WHERE status='pending'").get().n;
  // Newest daily VACUUM INTO snapshot in data/backups — the portal flags it when stale.
  let lastBackupAt = null;
  try {
    const backupDir = path.join(ROOT, 'data', 'backups');
    let latest = 0;
    for (const f of fs.readdirSync(backupDir)) {
      if (!f.endsWith('.db')) continue;
      const m = fs.statSync(path.join(backupDir, f)).mtimeMs;
      if (m > latest) latest = m;
    }
    if (latest) lastBackupAt = new Date(latest).toISOString();
  } catch (_) {}
  res.json({
    system: 'oilbook',
    generatedAt: new Date().toISOString(),
    lastBackupAt,
    kpis: [
      { label: 'Issued this month', value: issuedThisMonth, tone: 'neutral', href: '/ledger' },
      { label: 'Below reorder', value: belowReorder, tone: belowReorder > 0 ? 'warn' : 'good', href: '/' },
      { label: 'Out of stock', value: outOfStock, tone: outOfStock > 0 ? 'bad' : 'good', href: '/' },
      { label: 'Pending requisitions', value: pendingReqs, tone: pendingReqs > 0 ? 'warn' : 'good', href: '/requisitions' },
    ],
  });
});

// Read-only entity list for the Master Portal's master-data spine (M4):
// fleet_assets (keyed by E&C code) and projects. Token-authed; mounted before
// the authenticate gate. Never mutates.
app.get('/api/portal/entities', (req, res) => {
  const token = req.get('x-portal-token');
  const expected = process.env.OILBOOK_PORTAL_TOKEN || process.env.PORTAL_TOKEN;
  if (!expected || !token || token !== expected) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const assets = db.prepare(
    'SELECT id, ec_code, registration, brand, type, status FROM fleet_assets ORDER BY ec_code'
  ).all();
  const projects = db.prepare('SELECT id, name FROM projects ORDER BY name').all();
  res.json({
    system: 'oilbook',
    generatedAt: new Date().toISOString(),
    machines: assets.map((a) => ({
      localId: String(a.id),
      code: a.ec_code || '',
      label: [a.brand, a.type].filter(Boolean).join(' ') || a.registration || a.ec_code || String(a.id),
      registration: a.registration || undefined,
      status: a.status || undefined,
    })),
    sites: projects.map((p) => ({ localId: String(p.id), name: p.name })),
  });
});

// Read-only month-scoped cost feed for the Master Portal's profit engine:
// oil issues (qty × unit price) and battery replacements (unit cost, in the
// month installed). Batteries attribute to a machine by matching the recorded
// vehicle registration to a fleet asset's E&C code. Money in LKR cents.
app.get('/api/portal/costs', (req, res) => {
  const token = req.get('x-portal-token');
  const expected = process.env.OILBOOK_PORTAL_TOKEN || process.env.PORTAL_TOKEN;
  if (!expected || !token || token !== expected) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const month = String(req.query.month || '');
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return res.status(400).json({ error: 'month=YYYY-MM required' });
  }
  const start = `${month}-01`;
  const [y, mo] = month.split('-').map(Number);
  const end = mo === 12 ? `${y + 1}-01-01` : `${y}-${String(mo + 1).padStart(2, '0')}-01`;

  const rows = db.prepare(
    `SELECT t.id, t.qty_issued, t.txn_date, p.unit_price, fa.ec_code, pr.name AS site_name
     FROM transactions t
     JOIN products p ON p.id = t.product_id
     LEFT JOIN fleet_assets fa ON fa.id = t.asset_id
     LEFT JOIN projects pr ON pr.id = t.project_id
     WHERE t.voided = 0 AND t.kind = 'issue' AND t.txn_date >= ? AND t.txn_date < ?`
  ).all(start, end);

  const oilCosts = rows.map((r) => ({
    sourceRef: `oil:${r.id}`,
    machineCode: r.ec_code || null,
    siteRef: r.site_name || null,
    category: 'oil',
    qty: r.qty_issued,
    amountCents: Math.round((Number(r.qty_issued) || 0) * (Number(r.unit_price) || 0) * 100),
    occurredAt: r.txn_date,
  }));

  // Battery replacements — the unit cost, in the month installed, attributed to
  // the machine whose registration matches the battery's vehicle number.
  const batteryRows = db.prepare(
    `SELECT b.id, b.unit_cost, b.installed_date, fa.ec_code
     FROM batteries b
     LEFT JOIN fleet_assets fa ON fa.registration_norm = b.vehicle_no_norm
     WHERE b.unit_cost IS NOT NULL AND b.unit_cost > 0
       AND b.installed_date IS NOT NULL AND b.installed_date >= ? AND b.installed_date < ?`
  ).all(start, end);
  const batteryCosts = batteryRows.map((r) => ({
    sourceRef: `battery:${r.id}`,
    machineCode: r.ec_code || null,
    siteRef: null,
    category: 'battery',
    amountCents: Math.round((Number(r.unit_cost) || 0) * 100),
    occurredAt: r.installed_date,
  }));

  res.json({ system: 'oilbook', month, costs: [...oilCosts, ...batteryCosts], income: [] });
});

// --- Single sign-on from the E&C Master Portal ------------------------------
// The portal signs a short-lived one-time token (base64url(payload).hmac,
// shared secret OILBOOK_SSO_SECRET); we verify it, mint a bearer session for
// the matching local user, and hand it to the SPA via the URL hash (#sso=),
// which the client adopts into localStorage and strips. Failure lands on the
// normal login screen.
const seenSsoJti = new Map(); // jti -> expiry (ms); in-memory single-use guard
function verifySsoToken(token) {
  const secret = process.env.OILBOOK_SSO_SECRET;
  if (!secret || !token) return null;
  const dot = token.indexOf('.');
  if (dot <= 0) return null;
  const payloadB64 = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url');
  const a = Buffer.from(sig), b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let payload;
  try { payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString()); } catch { return null; }
  if (payload.sys !== 'oilbook') return null;
  if (typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) return null;
  if (typeof payload.jti !== 'string' || !payload.jti || seenSsoJti.has(payload.jti)) return null;
  if (typeof payload.u !== 'string' || !payload.u) return null;
  seenSsoJti.set(payload.jti, payload.exp * 1000);
  for (const [jti, expiry] of seenSsoJti) if (expiry < Date.now()) seenSsoJti.delete(jti);
  return { username: payload.u };
}

app.get('/sso', (req, res) => {
  const verified = verifySsoToken(String(req.query.token || ''));
  if (!verified) return res.redirect('/');
  const user = db.prepare('SELECT * FROM users WHERE LOWER(username)=? AND active=1').get(verified.username.toLowerCase());
  if (!user) return res.redirect('/');
  const token = createSession(user.id);
  res.redirect('/#sso=' + encodeURIComponent(token));
});

// Public auth endpoints (login). /me, /logout, /password authenticate per-route.
app.use('/api/auth', auth);

// Everything below requires a valid session.
app.use('/api', authenticate);
app.use('/api/users', users);
app.use('/api/products', products);
app.use('/api/transactions', transactions);
app.use('/api/assets', assets);
app.use('/api/projects', projects);
app.use('/api/aliases', aliases);
app.use('/api/settings', settings);
app.use('/api/batteries', batteries);
app.use('/api/tally', tally);
app.use('/api/requisitions', requisitions);
app.use('/api', analytics); // /api/dashboard/*, /api/trends/*, /api/forecast, /api/consumption/*

// Serve the built client (production) with SPA fallback.
const dist = path.join(ROOT, 'client', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(dist, 'index.html'));
  });
} else {
  console.warn('⚠  Client build not found. Run `npm run build` to serve the web UI (API is still available at /api).');
}

// Standalone: `node server/index.js` listens on its own port. Embedded (the
// unified E&C server imports this module): no listen — the host server mounts
// `app` and owns the socket. Seeding/backup schedulers above run in both modes.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  app.listen(PORT, () => console.log(`\n🛢  Oil Stock Book running at http://localhost:${PORT}\n`));
}

export default app;
