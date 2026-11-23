#!/usr/bin/env bash

set -Eeuo pipefail
umask 077

APP_DIR="${APP_DIR:-/home/ali/tebahmadi}"
BACKUP_ROOT="${BACKUP_ROOT:-/var/backups/tebahmadi}"
MONGO_DB="${MONGO_DB:-tebahmadi}"
RETENTION_HOURS="${RETENTION_HOURS:-48}"

log() {
  printf '[%s] %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$*" >&2
}

die() {
  log "ERROR: $*"
  exit 1
}

[[ -n "${MONGO_URI:-}" ]] || die 'MONGO_URI is not configured'
[[ "$MONGO_DB" =~ ^[A-Za-z0-9_.-]+$ ]] || die 'MONGO_DB contains unsupported characters'
[[ "$RETENTION_HOURS" =~ ^[0-9]+$ ]] || die 'RETENTION_HOURS must be an integer'
(( RETENTION_HOURS > 0 )) || die 'RETENTION_HOURS must be greater than zero'

for command_name in date find flock git gzip mongodump sha256sum; do
  command -v "$command_name" >/dev/null 2>&1 || die "Required command is missing: $command_name"
done

mkdir -p "$BACKUP_ROOT"
chmod 700 "$BACKUP_ROOT"

exec 9>"$BACKUP_ROOT/.backup.lock"
if ! flock -n 9; then
  log 'Another Tab Ahmadi backup is already running; exiting without changes'
  exit 0
fi

timestamp="$(date -u '+%Y%m%dT%H%M%SZ')"
final_dir="$BACKUP_ROOT/$timestamp"
temporary_dir="$BACKUP_ROOT/.tmp-$timestamp-$$"

[[ ! -e "$final_dir" ]] || die "Backup directory already exists: $final_dir"
mkdir -m 700 "$temporary_dir"

cleanup() {
  local exit_code=$?
  if (( exit_code != 0 )) && [[ -d "$temporary_dir" ]]; then
    rm -rf -- "$temporary_dir"
  fi
  exit "$exit_code"
}
trap cleanup EXIT

archive_path="$temporary_dir/mongodb.archive.gz"
log "Starting MongoDB backup for database $MONGO_DB"
mongodump \
  --uri="$MONGO_URI" \
  --db="$MONGO_DB" \
  --archive="$archive_path" \
  --gzip \
  --numParallelCollections=1

[[ -s "$archive_path" ]] || die 'mongodump produced an empty archive'
gzip -t "$archive_path" || die 'mongodump archive failed gzip validation'

{
  printf 'created_at_utc=%s\n' "$timestamp"
  printf 'database=%s\n' "$MONGO_DB"
  printf 'application_commit=%s\n' "$(git -C "$APP_DIR" rev-parse --short HEAD 2>/dev/null || printf 'unknown')"
  printf 'archive=mongodb.archive.gz\n'
} > "$temporary_dir/metadata.txt"
(
  cd "$temporary_dir"
  sha256sum mongodb.archive.gz > SHA256SUMS
)
chmod 600 "$temporary_dir"/*

mv -- "$temporary_dir" "$final_dir"
temporary_dir=''
log "Published backup: $final_dir"

retention_minutes=$((RETENTION_HOURS * 60))
while IFS= read -r -d '' old_backup; do
  backup_name="${old_backup##*/}"
  [[ "$backup_name" =~ ^20[0-9]{6}T[0-9]{6}Z$ ]] || die "Refusing to prune unexpected path: $old_backup"
  log "Pruning backup older than ${RETENTION_HOURS}h: $old_backup"
  rm -rf -- "$old_backup"
done < <(
  find "$BACKUP_ROOT" \
    -mindepth 1 \
    -maxdepth 1 \
    -type d \
    -name '20*T*Z' \
    -mmin "+$retention_minutes" \
    -print0
)

log 'Backup completed successfully'
