import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

test("runtime migration registry includes every official migration after the base schema", () => {
  const root = resolve(import.meta.dirname, "..");
  const official = readdirSync(resolve(root, "drizzle"))
    .filter((name) => /^\d{4}_.+\.sql$/.test(name))
    .map((name) => name.slice(0, -4))
    .filter((id) => id >= "0006_store_growth")
    .sort();
  const runtime = [...readFileSync(resolve(root, "app/api/admin/setup-schema.ts"), "utf8").matchAll(/"(\d{4}_[a-z0-9_]+)":\s*\[/g)]
    .map((match) => match[1])
    .sort();
  assert.deepEqual(runtime, official);
});
