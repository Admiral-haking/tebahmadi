import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = resolve(root, ".local");
const databasePath = resolve(dataDir, "store.sqlite");
mkdirSync(dataDir, { recursive: true });

const sqlite = new DatabaseSync(databasePath);
sqlite.exec("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;");

function bootstrap() {
  sqlite.exec("CREATE TABLE IF NOT EXISTS schema_migrations(id TEXT PRIMARY KEY NOT NULL, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)");
  const applied = new Set((sqlite.prepare("SELECT id FROM schema_migrations").all() as Array<{ id: string }>).map((row) => row.id));
  const migrationsDir = resolve(root, "drizzle");
  for (const name of readdirSync(migrationsDir).filter((item) => /^\d{4}_.+\.sql$/.test(item)).sort()) {
    const id = name.slice(0, -4);
    if (applied.has(id)) continue;
    sqlite.exec(readFileSync(resolve(migrationsDir, name), "utf8"));
    sqlite.prepare("INSERT INTO schema_migrations(id) VALUES(?)").run(id);
  }
}
bootstrap();

class LocalStatement {
  constructor(private readonly sql: string, private readonly values: unknown[] = []) {}
  bind(...values: unknown[]) { return new LocalStatement(this.sql, values); }
  async first<T = any>(column?: string): Promise<T | null> {
    const row = this.sqliteStatement().get(...(this.values as any[])) as Record<string, unknown> | undefined;
    if (!row) return null;
    return (column ? row[column] : row) as T;
  }
  async all<T = any>(): Promise<{ results: T[] }> {
    return { results: this.sqliteStatement().all(...(this.values as any[])) as T[] };
  }
  async run(): Promise<{ meta: { changes: number; last_row_id?: number } }> {
    const result = this.sqliteStatement().run(...(this.values as any[]));
    return { meta: { changes: Number(result.changes), last_row_id: Number(result.lastInsertRowid) } };
  }
  sqliteStatement() { return sqlite.prepare(this.sql); }
}

const DB = {
  prepare(sql: string) { return new LocalStatement(sql); },
  async batch(statements: LocalStatement[]) {
    sqlite.exec("BEGIN");
    try { const results = []; for (const statement of statements) results.push(await statement.run()); sqlite.exec("COMMIT"); return results; }
    catch (error) { sqlite.exec("ROLLBACK"); throw error; }
  },
};

export const env = {
  DB,
  APP_ENV: process.env.APP_ENV || "local",
  PAYMENT_PROVIDER: process.env.PAYMENT_PROVIDER || "mock",
  SHIPPING_PROVIDER: process.env.SHIPPING_PROVIDER || "mock",
  SMS_PROVIDER: process.env.SMS_PROVIDER || "mock",
  ADMIN_SESSION_SECRET: process.env.ADMIN_SESSION_SECRET || "local-admin-secret",
  OTP_PEPPER: process.env.OTP_PEPPER || "local-otp-pepper",
  SMS_IR_API_KEY: process.env.SMS_IR_API_KEY,
  SMS_IR_TEMPLATE_ID: process.env.SMS_IR_TEMPLATE_ID,
  PAYMENT_API_URL: process.env.PAYMENT_API_URL,
  PAYMENT_API_TOKEN: process.env.PAYMENT_API_TOKEN,
  SHIPPING_API_URL: process.env.SHIPPING_API_URL,
  SHIPPING_API_TOKEN: process.env.SHIPPING_API_TOKEN,
  ZARINPAL_MERCHANT_ID: process.env.ZARINPAL_MERCHANT_ID,
  TAPIN_TOKEN: process.env.TAPIN_TOKEN,
  TAPIN_SHOP_ID: process.env.TAPIN_SHOP_ID,
  TAPIN_BASE_URL: process.env.TAPIN_BASE_URL,
};
