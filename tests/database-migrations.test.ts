import test from "node:test";
import assert from "node:assert/strict";
import { migrationIds, validateMigrationIds } from "../scripts/local-d1.mjs";

test("local migration plan is strictly ordered and has no duplicate ids", () => {
  assert.equal(validateMigrationIds(migrationIds), true);
  assert.deepEqual(migrationIds, [...migrationIds].sort());
  assert.equal(new Set(migrationIds).size, migrationIds.length);
});
