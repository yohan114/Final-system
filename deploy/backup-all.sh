#!/usr/bin/env bash
# E&C Super Master System — off-machine backup of every SQLite database (POSIX).
#
# Copies a consistent snapshot of each of the five databases to an off-machine
# destination (mounted share / rotated disk). Schedule via cron, e.g.:
#   0 */6 * * *  /opt/ec/Final-system/deploy/backup-all.sh
#
# Uses `sqlite3 .backup` when available (safe with WAL); else copies the .db
# plus its -wal/-shm sidecars.
set -euo pipefail

EC_ROOT="${EC_ROOT:-/opt/ec}"
DEST="${EC_BACKUP_DEST:-/mnt/backup/ec-backups}"
KEEP_DAYS="${EC_BACKUP_KEEP_DAYS:-30}"
stamp="$(date +%Y-%m-%d_%H%M%S)"

declare -A DBS=(
  [fuel]="$EC_ROOT/Fuel-System-V2/data/app.db"
  [stores]="$EC_ROOT/Main-stros-system/dev.db"
  [workshop]="$EC_ROOT/Store-Database/inventory.db"
  [oil]="$EC_ROOT/oil-stock-book/data/oilbook.db"
  [portal]="$EC_ROOT/Final-system/data/portal.db"
)

for name in "${!DBS[@]}"; do
  src="${DBS[$name]}"
  if [ ! -f "$src" ]; then echo "skip $name — $src not found"; continue; fi
  outdir="$DEST/$name"; mkdir -p "$outdir"
  out="$outdir/${name}_${stamp}.db"
  if command -v sqlite3 >/dev/null 2>&1; then
    sqlite3 "$src" ".backup '$out'"
  else
    cp -f "$src" "$out"
    for ext in -wal -shm; do [ -f "$src$ext" ] && cp -f "$src$ext" "$out$ext" || true; done
  fi
  echo "backed up $name -> $out"
  find "$outdir" -name '*.db' -mtime +"$KEEP_DAYS" -delete
done
