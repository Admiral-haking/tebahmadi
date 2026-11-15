import test from "node:test";
import assert from "node:assert/strict";
import { safeJsonArrayString, safeJsonObjectString } from "../lib/safe-json";

test("safeJsonArrayString normalizes malformed order items without throwing", () => {
  assert.equal(safeJsonArrayString("not-json"), "[]");
  assert.equal(safeJsonArrayString('{"name":"wrong-shape"}'), "[]");
  assert.deepEqual(JSON.parse(safeJsonArrayString('[{"id":"p-1"}]')), [{ id: "p-1" }]);
});

test("safeJsonObjectString normalizes malformed content drafts", () => {
  assert.equal(safeJsonObjectString("not-json"), "{}");
  assert.equal(safeJsonObjectString("[]"), "{}");
  assert.deepEqual(JSON.parse(safeJsonObjectString('{"name":"draft"}')), { name: "draft" });
});
