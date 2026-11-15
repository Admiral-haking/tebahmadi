import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDir = resolve(root, "drizzle");
const config = resolve(root, "dist/server/wrangler.json");
const persistTo = resolve(root, ".wrangler/state");
const wrangler = resolve(root, "node_modules/wrangler/bin/wrangler.js");

export const migrationIds = readdirSync(migrationsDir)
  .filter((name) => /^\d{4}_.+\.sql$/.test(name))
  .map((name) => name.slice(0, -4))
  .sort();

const schemaSource = readFileSync(resolve(root, "db/schema.ts"), "utf8");
export const typedSchemaTables = [...schemaSource.matchAll(/sqliteTable\("([a-z0-9_]+)"/g)].map((match) => match[1]);

export function validateMigrationIds(ids) {
  return ids.every((id, index) => /^\d{4}_[a-z0-9_]+$/.test(id) && (index === 0 || ids[index - 1] < id));
}

function execute(args) {
  return execFileSync(process.execPath, [wrangler, "d1", "execute", "DB", "--local", "--config", config, "--persist-to", persistTo, "--yes", "--json", ...args], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });
}

function query(sql) {
  const raw = execute(["--command", sql]);
  const parsed = JSON.parse(raw);
  return parsed[0]?.results || [];
}

function runFile(file) {
  execute(["--file", file]);
}

function ensureTracking() {
  execute(["--command", "CREATE TABLE IF NOT EXISTS schema_migrations(id TEXT PRIMARY KEY NOT NULL, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"]);
}

export function applyLocalMigrations() {
  if (!validateMigrationIds(migrationIds)) throw new Error("Invalid migration sequence");
  ensureTracking();
  const applied = new Set(query("SELECT id FROM schema_migrations ORDER BY id").map((row) => row.id));
  const hasBase = query("SELECT name FROM sqlite_master WHERE type='table' AND name='products'").length > 0;
  for (const id of migrationIds) {
    if (applied.has(id)) continue;
    const file = resolve(migrationsDir, `${id}.sql`);
    if (hasBase && /^000[0-5]_/.test(id)) {
      execute(["--command", `INSERT OR IGNORE INTO schema_migrations(id) VALUES('${id}')`]);
      continue;
    }
    runFile(file);
    execute(["--command", `INSERT OR IGNORE INTO schema_migrations(id) VALUES('${id}')`]);
  }
  return query("SELECT id FROM schema_migrations ORDER BY id").map((row) => row.id);
}

export function verifyLocalDatabase() {
  const tables = query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE '_cf_%' ORDER BY name").map((row) => row.name);
  const applied = query("SELECT id FROM schema_migrations ORDER BY id").map((row) => row.id);
  const missingMigrations = migrationIds.filter((id) => !applied.includes(id));
  if (missingMigrations.length) throw new Error(`Missing migrations: ${missingMigrations.join(", ")}`);
  const missingTypedTables = typedSchemaTables.filter((table) => !tables.includes(table));
  if (missingTypedTables.length) throw new Error(`Typed schema tables missing from local D1: ${missingTypedTables.join(", ")}`);
  const ordersSql = query("SELECT sql FROM sqlite_master WHERE type='table' AND name='orders'")[0]?.sql || "";
  const statusChecks = ["pending", "paid", "processing", "shipped", "cancelled", "refunded"];
  if (!statusChecks.every((status) => ordersSql.includes(`'${status}'`))) throw new Error("Orders status constraint is incomplete");
  const guards = query("SELECT name FROM sqlite_master WHERE type='trigger' ORDER BY name").map((row) => row.name);
  const indexes = query("SELECT name FROM sqlite_master WHERE type='index' ORDER BY name").map((row) => row.name);
  for (const requiredIndex of ["orders_phone_created_idx", "orders_tracking_idx", "orders_payment_status_idx", "shipments_tracking_idx", "promotion_products_product_idx", "promotion_redemptions_customer_idx", "inventory_movements_reference_idx"]) {
    if (!indexes.includes(requiredIndex)) throw new Error(`Missing operational index: ${requiredIndex}`);
  }
  for (const requiredGuard of [
    "orders_payment_status_insert_guard",
    "orders_payment_status_update_guard",
    "orders_shipping_status_insert_guard",
    "orders_shipping_status_update_guard",
    "return_requests_timeline_after_update",
    "shipments_status_insert_guard",
    "shipments_status_update_guard",
    "orders_fulfillment_requires_payment",
    "orders_fulfillment_payment_update_guard",
  ]) {
    if (!guards.includes(requiredGuard)) throw new Error(`Missing status guard: ${requiredGuard}`);
  }
  for (const required of ["products", "orders", "customers", "blog_posts", "shipping_methods", "shipments"]) if (!tables.includes(required)) throw new Error(`Missing table: ${required}`);
  return { tables, applied, typedSchemaTables, statusGuards: guards, operationalIndexes: indexes };
}

function seedLocal() {
  applyLocalMigrations();
  execute(["--command", "INSERT INTO products(id,name,slug,category,price_toman,description,stock,active,sku) VALUES('local-demo-product','نمونه محصول طب احمدی','local-demo-product','نمونه',100000,'محصول نمونه برای توسعه local',10,1,'LOCAL-DEMO-001') ON CONFLICT(id) DO UPDATE SET stock=10,active=1; INSERT OR IGNORE INTO shipping_methods(id,code,title,provider,price_toman,eta_days,active) VALUES('local-post-pishtaz','post_pishtaz','پست پیشتاز','manual',0,3,1); UPDATE shipping_methods SET active=1 WHERE code='post_pishtaz'; INSERT OR IGNORE INTO promotions(id,code,title,kind,value,min_subtotal_toman,max_discount_toman,usage_limit,active) VALUES('local-promotion-10','LOCAL10','تخفیف تست محلی','percent',10,0,NULL,NULL,1); UPDATE promotions SET active=1,usage_count=0 WHERE id='local-promotion-10'; INSERT OR IGNORE INTO admin_users(id,email,phone,name,password_hash,role,active) VALUES('local-owner','owner@local.test','09120000000','مالک local','otp','owner',1); DELETE FROM login_otps WHERE phone='staff:09120000000'; DELETE FROM admin_sessions WHERE admin_user_id='local-owner';"]);
}

function resetLocal() {
  const backup = hasLocalDatabase() ? backupLocal() : null;
  const tables = query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE '_cf_%'").map((row) => row.name);
  if (tables.length) {
    const drops = [...tables].reverse().map((name) => `DROP TABLE IF EXISTS \"${String(name).replaceAll('"', '""')}\"`).join(";");
    execute(["--command", drops]);
  }
  applyLocalMigrations();
  return backup;
}

function backupLocal() {
  mkdirSync(resolve(root, ".wrangler/backups"), { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const output = resolve(root, ".wrangler/backups", `d1-local-${stamp}.sql`);
  const databaseRoot = resolve(root, ".wrangler/state/v3/d1/miniflare-D1DatabaseObject");
  const database = readdirSync(databaseRoot).find((name) => name.endsWith(".sqlite"));
  if (!database) throw new Error("Local D1 database file not found; run db:migrate:local first");
  const dump = execFileSync("sqlite3", [resolve(databaseRoot, database), ".dump"], { cwd: root, encoding: "utf8" });
  writeFileSync(output, dump, "utf8");
  return output;
}

function verifyBackup(file) {
  const path = resolve(root, file);
  execFileSync("sqlite3", [":memory:", `.read '${path.replaceAll("'", "''")}'`, "PRAGMA integrity_check;"], { cwd: root, stdio: "inherit" });
  return path;
}

function hasLocalDatabase() {
  const databaseRoot = resolve(root, ".wrangler/state/v3/d1/miniflare-D1DatabaseObject");
  return existsSync(databaseRoot) && readdirSync(databaseRoot, { withFileTypes: true }).some((entry) => entry.isFile() && entry.name.endsWith(".sqlite"));
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const command = process.argv[2] || "migrate";
  if (command === "migrate") { const backup = hasLocalDatabase() ? backupLocal() : null; console.log(JSON.stringify({ backup, applied: applyLocalMigrations() }, null, 2)); }
  else if (command === "verify") console.log(JSON.stringify(verifyLocalDatabase(), null, 2));
  else if (command === "seed") { seedLocal(); console.log("Local seed applied"); }
  else if (command === "reset") { console.log(JSON.stringify({ backup: resetLocal(), message: "Local database reset and migrated" }, null, 2)); }
  else if (command === "backup") console.log(backupLocal());
  else if (command === "verify-backup") {
    const backupArgument = process.argv[3] === "--" ? process.argv[4] : process.argv[3];
    if (!backupArgument) throw new Error("Usage: db:verify:backup <backup.sql>");
    console.log(verifyBackup(backupArgument));
  }
  else throw new Error(`Unknown command: ${command}`);
}
