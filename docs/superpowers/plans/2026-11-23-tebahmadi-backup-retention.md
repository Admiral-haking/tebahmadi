# Tab Ahmadi Backup Retention Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a production-safe daily MongoDB/GridFS backup service for Tab Ahmadi with a 48-hour retention window and a reversible deployment path.

**Architecture:** A small POSIX shell runner will create an atomic, compressed `mongodump` archive for only the `tebahmadi` database, write a checksum and metadata, then prune only timestamped backup directories older than 48 hours. A system-level systemd oneshot service runs as the unprivileged `ali` user, while a timer schedules it daily and keeps the service manually runnable for verification.

**Tech Stack:** Bash, `mongodump`, `sha256sum`, `flock`, systemd service/timer, MongoDB GridFS.

**Spec:** `docs/superpowers/specs/2026-11-23-tebahmadi-backup-retention.md`

## Global Constraints

- Backup scope is only MongoDB database `tebahmadi`.
- Retention is exactly 48 hours by default.
- Secrets and URI values must never be printed.
- Deletion is restricted to timestamped directories under `/var/backups/tebahmadi`.
- The service runs as user `ali` with a private backup directory.

## Review Focus

- Missing or malformed `MONGO_URI`: fail before creating a partial backup.
- Concurrent invocations: the second run exits without touching the active backup.
- Failed `mongodump`: temporary data is removed and no incomplete timestamped backup is published.
- Retention path safety: only matching timestamp directories under the configured root are deleted.
- Checksum or archive corruption: verification must fail visibly before deployment is considered complete.

### Task 1: Backup runner

**Files:**
- Create: `scripts/backup-tebahmadi.sh`

**Interfaces:**
- Consumes: `MONGO_URI`, `MONGO_DB`, `BACKUP_ROOT`, `RETENTION_HOURS`.
- Produces: `<timestamp>/mongodb.archive.gz`, `<timestamp>/SHA256SUMS`, `<timestamp>/metadata.txt`.

- [ ] Implement strict mode, umask, command checks, lock acquisition, atomic temporary directory, scoped `mongodump`, checksum/metadata, and 48-hour pruning.
- [ ] Validate shell syntax and run a controlled live backup on the server.

### Task 2: systemd scheduling

**Files:**
- Create: `deploy/systemd/tebahmadi-backup.service`
- Create: `deploy/systemd/tebahmadi-backup.timer`

**Interfaces:**
- Consumes: the runner from Task 1 and `/home/ali/tebahmadi/.env.local`.
- Produces: a daily systemd timer with `Persistent=true`.

- [ ] Define a least-privilege oneshot service with `/var/backups/tebahmadi` as the only write path.
- [ ] Define a daily UTC timer with a bounded randomized delay.

### Task 3: Operational verification and handoff

**Files:**
- Modify: `README.md` with installation, manual run, verification, restore, and retention notes.

- [ ] Run `bash -n`, install the units, enable the timer, and run the service once manually.
- [ ] Verify checksum, backup contents, timer status, PM2 health, and public health endpoint.
- [ ] Preserve the server backup branch and record the exact rollback/restore commands.
