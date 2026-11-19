/**
 * Central Jalali (Shamsi) date helpers. Storage stays Gregorian/ISO everywhere;
 * these are only for displaying to and reading input from the user.
 *
 * Display digits are Persian. The conversion math is the well-known integer
 * algorithm (same one the tracking filter already used) — no external library.
 */

const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

/** Persian/Arabic digits → ASCII. */
export function toEnglishDigits(input: string): string {
  return String(input ?? "")
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
}

/** ASCII digits → Persian (for display). */
export function toPersianDigits(input: string | number): string {
  return String(input).replace(/[0-9]/g, (d) => FA_DIGITS[Number(d)]);
}

function div(a: number, b: number) {
  return ~~(a / b);
}

export function jalaliToGregorian(jy: number, jm: number, jd: number): [number, number, number] {
  jy += 1595;
  let days = -355668 + 365 * jy + div(jy, 33) * 8 + div((jy % 33) + 3, 4) + jd;
  days += jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186;
  let gy = 400 * div(days, 146097);
  days %= 146097;
  if (days > 36524) {
    gy += 100 * div(--days, 36524);
    days %= 36524;
    if (days >= 365) days += 1;
  }
  gy += 4 * div(days, 1461);
  days %= 1461;
  if (days > 365) {
    gy += div(days - 1, 365);
    days = (days - 1) % 365;
  }
  const gd = days + 1;
  const salA = [0, 31, (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let gm = 0;
  while (gm < 13 && gd > salA[gm]) gm += 1;
  let day = gd;
  for (let i = 1; i < gm; i += 1) day -= salA[i];
  return [gy, gm, day];
}

export function gregorianToJalali(gy: number, gm: number, gd: number): [number, number, number] {
  const gDM = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const gy2 = gm > 2 ? gy + 1 : gy;
  let days = 355666 + 365 * gy + div(gy2 + 3, 4) - div(gy2 + 99, 100) + div(gy2 + 399, 400) + gd;
  for (let i = 0; i < gm; ++i) days += gDM[i];
  let jy = -1595 + 33 * div(days, 12053);
  days %= 12053;
  jy += 4 * div(days, 1461);
  days %= 1461;
  if (days > 365) {
    jy += div(days - 1, 365);
    days = (days - 1) % 365;
  }
  const jm = days < 186 ? 1 + div(days, 31) : 7 + div(days - 186, 30);
  const jd = 1 + (days < 186 ? days % 31 : (days - 186) % 30);
  return [jy, jm, jd];
}

/** Format any date/ISO as a Jalali display string with Persian digits. */
export function formatJalali(value?: string | number | Date | null, opts?: { time?: boolean }): string {
  if (value === undefined || value === null || value === "") return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    ...(opts?.time ? { hour: "2-digit", minute: "2-digit" } : {}),
  })
    .format(date)
    .replace(/‎/g, "");
}

/**
 * Parse a user-typed Jalali date(+time) string into a value usable by the form.
 * Accepts "۱۴۰۳/۰۵/۲۱" or "1403/5/21 14:30" (Persian or Latin digits, - . / seps).
 * Returns a datetime-local-style string "YYYY-MM-DDTHH:mm" or "" / null on error.
 */
export function parseJalaliInput(value: string, withTime = false): string | null {
  const raw = toEnglishDigits(String(value ?? "").trim()).replace(/[-.]/g, "/");
  if (!raw) return "";
  const m = raw.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})(?:[ T](\d{1,2}):(\d{1,2}))?$/);
  if (!m) return null;
  const jy = +m[1], jm = +m[2], jd = +m[3];
  if (jm < 1 || jm > 12 || jd < 1 || jd > 31) return null;
  const [gy, gm, gd] = jalaliToGregorian(jy, jm, jd);
  const datePart = `${gy}-${String(gm).padStart(2, "0")}-${String(gd).padStart(2, "0")}`;
  if (!withTime) return datePart;
  const hh = String(Math.min(23, +(m[4] ?? 0))).padStart(2, "0");
  const mm = String(Math.min(59, +(m[5] ?? 0))).padStart(2, "0");
  return `${datePart}T${hh}:${mm}`;
}

/** Turn a stored ISO/datetime value into the Jalali text shown in the input. */
export function isoToJalaliInput(value?: string | null, withTime = false): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const [jy, jm, jd] = gregorianToJalali(date.getFullYear(), date.getMonth() + 1, date.getDate());
  let out = `${jy}/${String(jm).padStart(2, "0")}/${String(jd).padStart(2, "0")}`;
  if (withTime) out += ` ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  return toPersianDigits(out);
}
