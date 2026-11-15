import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  // Local D1 uses one SQLite-backed file; parallel workers contend on writes
  // and turn otherwise healthy API/browser checks into lock-related timeouts.
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? "line" : "list",
  webServer: {
    command: "APP_ENV=local PAYMENT_PROVIDER=mock SHIPPING_PROVIDER=mock SMS_PROVIDER=mock ADMIN_SESSION_SECRET=local-admin-secret OTP_PEPPER=local-otp-pepper pnpm db:seed:local && APP_ENV=local PAYMENT_PROVIDER=mock SHIPPING_PROVIDER=mock SMS_PROVIDER=mock ADMIN_SESSION_SECRET=local-admin-secret OTP_PEPPER=local-otp-pepper pnpm dev",
    url: "http://127.0.0.1:5173/api/health",
    reuseExistingServer: true,
    timeout: 120_000,
  },
  use: {
    baseURL: process.env.TAB_AHMADI_BASE_URL || "http://127.0.0.1:5173",
    ...(existsSync(process.env.PLAYWRIGHT_EXECUTABLE_PATH || "/usr/bin/google-chrome-stable")
      ? { launchOptions: { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || "/usr/bin/google-chrome-stable" } }
      : {}),
    trace: "retain-on-failure",
    ...devices["Desktop Chrome"],
  },
});
