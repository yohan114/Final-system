# E&C Super Master System — off-machine backup of every SQLite database.
#
# All five databases live on one machine; this copies a *consistent snapshot*
# of each to an off-machine destination (network share, mapped drive, or a
# rotated USB disk) so a single disk failure or ransomware event is survivable.
#
# Schedule it (Windows Task Scheduler) to run a few times a day:
#   powershell -ExecutionPolicy Bypass -File backup-all.ps1
#
# Consistent snapshots: uses `sqlite3 .backup` when the sqlite3 CLI is on PATH
# (safe even with WAL); otherwise copies the .db plus its -wal/-shm sidecars.

param(
  [string]$EcRoot = $(if ($env:EC_ROOT) { $env:EC_ROOT } else { "C:\ec" }),
  [string]$Dest = $(if ($env:EC_BACKUP_DEST) { $env:EC_BACKUP_DEST } else { "\\backup-server\ec-backups" }),
  [int]$KeepDays = 30
)

$stamp = Get-Date -Format "yyyy-MM-dd_HHmmss"
$dbs = [ordered]@{
  "fuel"     = Join-Path $EcRoot "Fuel-System-V2\data\app.db"
  "stores"   = Join-Path $EcRoot "Main-stros-system\dev.db"
  "workshop" = Join-Path $EcRoot "Store-Database\inventory.db"
  "oil"      = Join-Path $EcRoot "oil-stock-book\data\oilbook.db"
  "portal"   = Join-Path $EcRoot "Final-system\data\portal.db"
}

$haveSqlite = [bool](Get-Command sqlite3 -ErrorAction SilentlyContinue)

foreach ($name in $dbs.Keys) {
  $src = $dbs[$name]
  if (-not (Test-Path $src)) { Write-Warning "skip $name — $src not found"; continue }
  $outDir = Join-Path $Dest $name
  New-Item -ItemType Directory -Force -Path $outDir | Out-Null
  $out = Join-Path $outDir "${name}_${stamp}.db"

  if ($haveSqlite) {
    & sqlite3 $src ".backup '$out'"
  } else {
    Copy-Item $src $out -Force
    foreach ($ext in @("-wal", "-shm")) {
      if (Test-Path "$src$ext") { Copy-Item "$src$ext" "$out$ext" -Force }
    }
  }
  Write-Host "backed up $name -> $out"

  # Retention
  Get-ChildItem $outDir -Filter "*.db" |
    Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$KeepDays) } |
    Remove-Item -Force
}
