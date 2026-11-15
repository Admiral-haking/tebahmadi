import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Deliberately opt-in: production migration must never happen because a deploy
// script happened to run with Cloudflare credentials in its environment.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDir = resolve(root, "drizzle");
const wrangler = resolve(root, "node_modules/wrangler/bin/wrangler.js");
const database = String(process.env.D1_DATABASE_NAME || "").trim();
const confirm = String(process.env.CONFIRM_REMOTE_MIGRATION || "").trim();
const config = String(process.env.WRANGLER_CONFIG || "").trim();

if (confirm !== "YES") throw new Error("Remote migration is disabled. Set CONFIRM_REMOTE_MIGRATION=YES after backup and review.");
if (!database) throw new Error("D1_DATABASE_NAME is required");

const migrationIds = readdirSync(migrationsDir)
  .filter((name) => /^\d{4}_[a-z0-9_]+\.sql$/.test(name))
  .map((name) => name.slice(0, -4))
  .sort();

function args(...values) {
  return [wrangler, "d1", "execute", database, "--remote", "--yes", ...(config ? ["--config", config] : []), ...values];
}

function execute(...values) {
  return execFileSync(process.execPath, args(...values), { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });
}

function query(sql) {
  const parsed = JSON.parse(execute("--command", sql, "--json"));
  return parsed[0]?.results || [];
}

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function apply() {
  execute("--command", "CREATE TABLE IF NOT EXISTS schema_migrations(id TEXT PRIMARY KEY NOT NULL, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)");
  const applied = new Set(query("SELECT id FROM schema_migrations ORDER BY id").map((row) => row.id));
  const baseExists = query("SELECT name FROM sqlite_master WHERE type='table' AND name='products'").length > 0;
  const newlyApplied = [];

  for (const id of migrationIds) {
    if (applied.has(id)) continue;
    // The first migrations are already represented by the original store schema
    // on installations created before the tracked runner was introduced.
    if (baseExists && /^000[0-5]_/.test(id)) {
      execute("--command", `INSERT OR IGNORE INTO schema_migrations(id) VALUES(${sqlString(id)})`);
      newlyApplied.push(id);
      continue;
    }
    execute("--file", resolve(migrationsDir, `${id}.sql`));
    execute("--command", `INSERT OR IGNORE INTO schema_migrations(id) VALUES(${sqlString(id)})`);
    newlyApplied.push(id);
  }

  const finalIds = query("SELECT id FROM schema_migrations ORDER BY id").map((row) => row.id);
  const missing = migrationIds.filter((id) => !finalIds.includes(id));
  if (missing.length) throw new Error(`Remote migration incomplete: ${missing.join(", ")}`);
  return { database, applied: finalIds, newlyApplied };
}

console.log(JSON.stringify(apply(), null, 2));
