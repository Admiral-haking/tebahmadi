import assert from "node:assert/strict";
import test from "node:test";
import { originAllowed } from "../lib/origin-validation";

test("accepts the configured public HTTPS origin behind an HTTP reverse proxy", () => {
  assert.equal(originAllowed("https://tebahmadi.ir", "http://127.0.0.1:3210/api/orders", "https://tebahmadi.ir"), true);
});

test("accepts direct same-origin requests and rejects unrelated origins", () => {
  assert.equal(originAllowed("http://127.0.0.1:5173", "http://127.0.0.1:5173/api/orders"), true);
  assert.equal(originAllowed("https://attacker.example", "http://127.0.0.1:3210/api/orders", "https://tebahmadi.ir"), false);
  assert.equal(originAllowed(null, "https://tebahmadi.ir/api/orders", "https://tebahmadi.ir"), false);
});
