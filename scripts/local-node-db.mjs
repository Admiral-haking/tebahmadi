import { DatabaseSync } from "node:sqlite";
import { copyFileSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
mkdirSync(resolve(root, ".local"), { recursive: true });
const databasePath = resolve(root, ".local/store.sqlite");
const db = new DatabaseSync(databasePath);
db.exec("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;");

function migrate() {
  db.exec("CREATE TABLE IF NOT EXISTS schema_migrations(id TEXT PRIMARY KEY NOT NULL, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)");
  const applied = new Set(db.prepare("SELECT id FROM schema_migrations").all().map((row) => row.id));
  const files = readdirSync(resolve(root, "drizzle")).filter((name) => /^\d{4}_.+\.sql$/.test(name)).sort();
  for (const name of files) {
    const id = name.slice(0, -4);
    if (applied.has(id)) continue;
    db.exec("BEGIN");
    try {
      db.exec(readFileSync(resolve(root, "drizzle", name), "utf8"));
      db.prepare("INSERT INTO schema_migrations(id) VALUES(?)").run(id);
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw new Error(`Migration ${id} failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

if (process.argv[2] === "migrate" || process.argv[2] === "verify" || process.argv[2] === "seed" || process.argv[2] === "reset") migrate();

if (process.argv[2] === "backup") {
  const backupPath = resolve(root, process.argv[3] || `.local/backups/store-${new Date().toISOString().replaceAll(/[:.]/g, "-")}.sqlite`);
  mkdirSync(resolve(backupPath, ".."), { recursive: true });
  db.exec("PRAGMA wal_checkpoint(TRUNCATE);");
  copyFileSync(databasePath, backupPath);
  console.log(JSON.stringify({ ok: true, action: "backup", database: ".local/store.sqlite", backup: backupPath.replace(`${root}/`, "") }));
  process.exit(0);
}

if (process.argv[2] === "verify-backup") {
  const backupPath = process.argv[3] && resolve(root, process.argv[3]);
  if (!backupPath) throw new Error("Usage: db:verify:backup <path>");
  const backup = new DatabaseSync(backupPath, { readOnly: true });
  const integrity = backup.prepare("PRAGMA integrity_check").get().integrity_check;
  const tables = backup.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").get().count;
  backup.close();
  console.log(JSON.stringify({ ok: integrity === "ok", backup: process.argv[3], integrity, tables }));
  process.exit(integrity === "ok" ? 0 : 1);
}

if (process.argv[2] === "reset") {
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().map((row) => row.name).filter((name) => name !== "schema_migrations");
  db.exec(tables.reverse().map((name) => `DROP TABLE IF EXISTS "${String(name).replaceAll('"', '""')}"`).join(";"));
  db.exec("DROP TABLE IF EXISTS schema_migrations");
  migrate();
}

if (process.argv[2] === "seed") {
  db.exec("INSERT INTO products(id,name,slug,category,price_toman,description,stock,active,sku) VALUES('local-demo-product','نمونه محصول طب احمدی','local-demo-product','نمونه',100000,'محصول نمونه برای توسعه local',10,1,'LOCAL-DEMO-001') ON CONFLICT(id) DO UPDATE SET stock=10,active=1;");
  db.exec("UPDATE product_variants SET stock_quantity=10,reserved_quantity=0,active=1 WHERE product_id='local-demo-product'");
  db.exec("INSERT OR IGNORE INTO shipping_methods(id,code,title,provider,price_toman,eta_days,active) VALUES('local-post-pishtaz','post_pishtaz','پست پیشتاز','manual',0,3,1);");
  db.exec("UPDATE shipping_methods SET active=1 WHERE code='post_pishtaz';");
  db.exec("INSERT OR IGNORE INTO promotions(id,code,title,kind,value,min_subtotal_toman,usage_limit,active) VALUES('local-promotion-10','LOCAL10','تخفیف تست محلی','percent',10,0,NULL,1);");
  db.exec("UPDATE promotions SET active=1,usage_count=0 WHERE id='local-promotion-10';");
  db.exec("INSERT OR IGNORE INTO admin_users(id,email,phone,name,password_hash,role,active) VALUES('local-owner','owner@local.test','09120000000','مالک local','otp-only','owner',1);");
  db.exec("DELETE FROM login_otps WHERE phone='staff:09120000000'; DELETE FROM admin_sessions WHERE admin_user_id='local-owner';");
}

if (process.argv[2] === "verify" || !process.argv[2] || process.argv[2] === "migrate") {
  const migrations = db.prepare("SELECT id FROM schema_migrations ORDER BY id").all().map((row) => row.id);
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map((row) => row.name);
  console.log(JSON.stringify({ ok: true, database: ".local/store.sqlite", migrations: migrations.length, tables: tables.length }));
  process.exit(0);
}

console.log(JSON.stringify({ ok: true, database: ".local/store.sqlite", action: process.argv[2] || "verify" }));
