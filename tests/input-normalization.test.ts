import test from "node:test";
import assert from "node:assert/strict";
import { isValidPhone, normalizeDigits, normalizeOtp, normalizePhone, normalizePostalCode } from "../lib/input-normalization";

test("normalizes Persian and Arabic digits consistently", () => {
  assert.equal(normalizeDigits("۰۹۱۲۳۴۵۶۷۸۹"), "09123456789");
  assert.equal(normalizeDigits("٠٩١٢٣٤٥٦٧٨٩"), "09123456789");
});

test("normalizes Iranian phone formats to the canonical 09 form", () => {
  assert.equal(normalizePhone("+98 912 345 6789"), "09123456789");
  assert.equal(normalizePhone("00989123456789"), "09123456789");
  assert.equal(normalizePhone("۹۱۲۳۴۵۶۷۸۹"), "09123456789");
  assert.equal(isValidPhone("+98 912 345 6789"), true);
  assert.equal(isValidPhone("02112345678"), false);
});

test("normalizes OTP and postal code input", () => {
  assert.equal(normalizeOtp("۱۲۳۴-۵"), "1234");
  assert.equal(normalizePostalCode("۱۲۳۴۵ ۶۷۸۹۰"), "1234567890");
});
