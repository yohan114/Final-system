import { Router } from 'express';
import { db } from '../db.js';
import { h, httpError, normalize } from '../util.js';
import { requireRole } from '../auth.js';
import { saveDataUrl, deleteUpload } from '../uploads.js';

const router = Router();

const logEvent = db.prepare(`
  INSERT INTO battery_events (battery_id, action, serial_no, serial_no_norm, vehicle_no, from_vehicle_no, reason, photo_path, user_id)
  VALUES (@battery_id, @action, @serial_no, @serial_no_norm, @vehicle_no, @from_vehicle_no, @reason, @photo_path, @user_id)`);

// Warranty status window: flag a battery "expiring" within this many days of
// its warranty end, "expired" once past it.
const WARRANTY_ALERT_DAYS = 60;

// Derive warranty end + status from install date and warranty length. Returns
// status 'unknown' when the lifecycle data isn't recorded.
function warrantyStatus(installed_date, warranty_months) {
  const months = Number(warranty_months);
  if (!installed_date || !months) return { warranty_end: null, warranty_status: 'unknown', warranty_days_left: null };
  const end = new Date(`${installed_date}T00:00:00Z`);
  if (isNaN(end.getTime())) return { warranty_end: null, warranty_status: 'unknown', warranty_days_left: null };
  end.setUTCMonth(end.getUTCMonth() + months);
  const daysLeft = Math.round((end.getTime() - Date.now()) / 86400000);
  let status = 'ok';
  if (daysLeft < 0) status = 'expired';
  else if (daysLeft <= WARRANTY_ALERT_DAYS) status = 'expiring';
  return { warranty_end: end.toISOString().slice(0, 10), warranty_status: status, warranty_days_left: daysLeft };
}

const withWarranty = (row) => ({ ...row, ...warrantyStatus(row.installed_date, row.warranty_months) });

// ── Active register ───────────────────────────────────────────────────────────
router.get('/', h((req, res) => {
  const { search } = req.query;
  const where = [], args = {};
  if (search) {
    where.push('(b.vehicle_no LIKE @s OR b.serial_no LIKE @s OR b.note LIKE @s)');
    args.s = `%${search}%`;
  }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const rows = db.prepare(`
    SELECT b.*, u.full_name AS created_by_name
    FROM batteries b LEFT JOIN users u ON u.id = b.created_by
    ${w} ORDER BY b.created_at DESC`).all(args);
  res.json(rows.map(withWarranty));
}));

// ── Warranty alerts: batteries expired or expiring soon, worst first ──────────
router.get('/alerts', h((req, res) => {
  const rows = db.prepare(`
    SELECT b.*, u.full_name AS created_by_name
    FROM batteries b LEFT JOIN users u ON u.id = b.created_by`).all();
  const flagged = rows
    .map(withWarranty)
    .filter((b) => b.warranty_status === 'expired' || b.warranty_status === 'expiring')
    .sort((a, b) => (a.warranty_days_left ?? 0) - (b.warranty_days_left ?? 0));
  res.json({
    expired: flagged.filter((b) => b.warranty_status === 'expired').length,
    expiring: flagged.filter((b) => b.warranty_status === 'expiring').length,
    batteries: flagged,
  });
}));

// ── Full audit history (active + decommissioned) ──────────────────────────────
router.get('/history', h((req, res) => {
  const { search } = req.query;
  const where = [], args = {};
  if (search) {
    where.push('(e.vehicle_no LIKE @s OR e.from_vehicle_no LIKE @s OR e.serial_no LIKE @s OR e.reason LIKE @s)');
    args.s = `%${search}%`;
  }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const rows = db.prepare(`
    SELECT e.*, u.full_name AS user_name
    FROM battery_events e LEFT JOIN users u ON u.id = e.user_id
    ${w} ORDER BY e.created_at DESC, e.id DESC`).all(args);
  res.json(rows);
}));

// ── Add — admin, store keeper AND project manager ─────────────────────────────
router.post('/', requireRole('admin', 'storekeeper', 'manager'), h((req, res) => {
  const vehicle_no = String(req.body.vehicle_no || '').trim();
  const serial_no = String(req.body.serial_no || '').trim();
  if (!vehicle_no) httpError(400, 'Vehicle number is required');
  if (!serial_no) httpError(400, 'Battery serial number is required');
  if (!req.body.photo) httpError(400, 'A photo is required');

  const vnorm = normalize(vehicle_no);
  const snorm = normalize(serial_no);
  if (db.prepare('SELECT 1 FROM batteries WHERE vehicle_no_norm=?').get(vnorm)) {
    httpError(409, `Vehicle ${vehicle_no} already has a battery recorded`);
  }
  if (db.prepare('SELECT 1 FROM batteries WHERE serial_no_norm=?').get(snorm)) {
    httpError(409, `Battery serial ${serial_no} is already recorded`);
  }

  const installed_date = String(req.body.installed_date || '').trim() || new Date().toISOString().slice(0, 10);
  const warranty_months = req.body.warranty_months != null && req.body.warranty_months !== '' ? Number(req.body.warranty_months) : null;
  const unit_cost = req.body.unit_cost != null && req.body.unit_cost !== '' ? Number(req.body.unit_cost) : null;

  const photo_path = saveDataUrl(req.body.photo, 'batteries');
  try {
    const tx = db.transaction(() => {
      const info = db.prepare(`
        INSERT INTO batteries (vehicle_no, vehicle_no_norm, serial_no, serial_no_norm, note, photo_path, created_by, installed_date, warranty_months, unit_cost)
        VALUES (?,?,?,?,?,?,?,?,?,?)`).run(vehicle_no, vnorm, serial_no, snorm, req.body.note || null, photo_path, req.user.id, installed_date, warranty_months, unit_cost);
      logEvent.run({
        battery_id: info.lastInsertRowid, action: 'add', serial_no, serial_no_norm: snorm,
        vehicle_no, from_vehicle_no: null, reason: req.body.note || null, photo_path, user_id: req.user.id,
      });
      return info.lastInsertRowid;
    });
    const id = tx();
    res.status(201).json(withWarranty(db.prepare('SELECT * FROM batteries WHERE id=?').get(id)));
  } catch (e) {
    deleteUpload(photo_path);
    throw e;
  }
}));

// ── Transfer to another vehicle — admin & store keeper ────────────────────────
router.post('/:id/transfer', requireRole('admin', 'storekeeper'), h((req, res) => {
  const b = db.prepare('SELECT * FROM batteries WHERE id=?').get(req.params.id);
  if (!b) httpError(404, 'Battery record not found');
  const to = String(req.body.vehicle_no || '').trim();
  if (!to) httpError(400, 'New vehicle number is required');
  const tonorm = normalize(to);
  if (tonorm === b.vehicle_no_norm) httpError(400, 'That is already this battery\'s vehicle');
  if (db.prepare('SELECT 1 FROM batteries WHERE vehicle_no_norm=? AND id<>?').get(tonorm, b.id)) {
    httpError(409, `Vehicle ${to} already has a battery — decommission it first`);
  }
  const tx = db.transaction(() => {
    db.prepare(`UPDATE batteries SET vehicle_no=?, vehicle_no_norm=? WHERE id=?`).run(to, tonorm, b.id);
    logEvent.run({
      battery_id: b.id, action: 'transfer', serial_no: b.serial_no, serial_no_norm: b.serial_no_norm,
      vehicle_no: to, from_vehicle_no: b.vehicle_no, reason: req.body.reason || null, photo_path: b.photo_path, user_id: req.user.id,
    });
  });
  tx();
  res.json(withWarranty(db.prepare('SELECT * FROM batteries WHERE id=?').get(b.id)));
}));

// ── Decommission (dead/destroyed, vehicle removed — log kept) — admin & store ─
router.post('/:id/decommission', requireRole('admin', 'storekeeper'), h((req, res) => {
  const b = db.prepare('SELECT * FROM batteries WHERE id=?').get(req.params.id);
  if (!b) httpError(404, 'Battery record not found');
  const reason = String(req.body.reason || '').trim() || 'Decommissioned';
  const tx = db.transaction(() => {
    // Snapshot into the audit log, then remove from the active register so the
    // vehicle & serial are freed while the history is preserved forever.
    logEvent.run({
      battery_id: b.id, action: 'decommission', serial_no: b.serial_no, serial_no_norm: b.serial_no_norm,
      vehicle_no: b.vehicle_no, from_vehicle_no: null, reason, photo_path: b.photo_path, user_id: req.user.id,
    });
    db.prepare('DELETE FROM batteries WHERE id=?').run(b.id);
  });
  tx();
  res.json({ ok: true });
}));

// ── Edit any field — admin only (others must request) ─────────────────────────
router.patch('/:id', requireRole('admin'), h((req, res) => {
  const b = db.prepare('SELECT * FROM batteries WHERE id=?').get(req.params.id);
  if (!b) httpError(404, 'Battery record not found');
  const vehicle_no = 'vehicle_no' in req.body ? String(req.body.vehicle_no || '').trim() : b.vehicle_no;
  const serial_no = 'serial_no' in req.body ? String(req.body.serial_no || '').trim() : b.serial_no;
  const note = 'note' in req.body ? (req.body.note || null) : b.note;
  const installed_date = 'installed_date' in req.body ? (String(req.body.installed_date || '').trim() || null) : b.installed_date;
  const warranty_months = 'warranty_months' in req.body ? (req.body.warranty_months !== '' && req.body.warranty_months != null ? Number(req.body.warranty_months) : null) : b.warranty_months;
  const unit_cost = 'unit_cost' in req.body ? (req.body.unit_cost !== '' && req.body.unit_cost != null ? Number(req.body.unit_cost) : null) : b.unit_cost;
  if (!vehicle_no || !serial_no) httpError(400, 'Vehicle and serial number cannot be empty');
  const vnorm = normalize(vehicle_no), snorm = normalize(serial_no);
  if (db.prepare('SELECT 1 FROM batteries WHERE vehicle_no_norm=? AND id<>?').get(vnorm, b.id)) httpError(409, 'Another battery already uses that vehicle number');
  if (db.prepare('SELECT 1 FROM batteries WHERE serial_no_norm=? AND id<>?').get(snorm, b.id)) httpError(409, 'Another battery already uses that serial number');

  const tx = db.transaction(() => {
    db.prepare('UPDATE batteries SET vehicle_no=?, vehicle_no_norm=?, serial_no=?, serial_no_norm=?, note=?, installed_date=?, warranty_months=?, unit_cost=? WHERE id=?')
      .run(vehicle_no, vnorm, serial_no, snorm, note, installed_date, warranty_months, unit_cost, b.id);
    logEvent.run({
      battery_id: b.id, action: 'edit', serial_no, serial_no_norm: snorm, vehicle_no,
      from_vehicle_no: b.vehicle_no !== vehicle_no ? b.vehicle_no : null,
      reason: req.body.reason || 'Edited', photo_path: b.photo_path, user_id: req.user.id,
    });
  });
  tx();
  res.json(withWarranty(db.prepare('SELECT * FROM batteries WHERE id=?').get(b.id)));
}));

export default router;
