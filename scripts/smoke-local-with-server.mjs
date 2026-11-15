import { spawn } from "node:child_process";

const baseUrl = (process.env.TAB_AHMADI_BASE_URL || "http://127.0.0.1:5173").replace(/\/$/, "");
const env = {
  ...process.env,
  APP_ENV: "local",
  PAYMENT_PROVIDER: "mock",
  SHIPPING_PROVIDER: "mock",
  SMS_PROVIDER: "mock",
  ADMIN_SESSION_SECRET: process.env.ADMIN_SESSION_SECRET || "local-admin-secret",
  OTP_PEPPER: process.env.OTP_PEPPER || "local-otp-pepper",
};

const server = spawn(process.execPath, ["scripts/run-framework.mjs", "dev", "--host", "127.0.0.1"], {
  cwd: process.cwd(),
  env,
  stdio: "inherit",
  detached: true,
});

let stopped = false;
const stop = (signal = "SIGTERM") => {
  if (stopped) return;
  stopped = true;
  if (server.killed || !server.pid) return;
  try {
    process.kill(-server.pid, signal);
  } catch {
    server.kill(signal);
  }
};

process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());

try {
  const deadline = Date.now() + 30_000;
  let ready = false;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) {
        ready = true;
        break;
      }
    } catch {
      // The server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (!ready) throw new Error(`Local dev server did not become ready at ${baseUrl}`);

  const smoke = spawn("node", ["scripts/smoke-local.mjs"], {
    cwd: process.cwd(),
    env: { ...env, TAB_AHMADI_BASE_URL: baseUrl },
    stdio: "inherit",
  });
  const result = await new Promise((resolve) => smoke.once("exit", (code, signal) => resolve({ code, signal })));
  if (result.signal) throw new Error(`Smoke process stopped by ${result.signal}`);
  if (result.code !== 0) process.exitCode = result.code ?? 1;
} finally {
  stop("SIGTERM");
  await new Promise((resolve) => {
    if (server.exitCode !== null || server.signalCode) return resolve();
    server.once("exit", resolve);
    setTimeout(() => {
      if (server.exitCode === null && !server.signalCode) stop("SIGKILL");
      resolve();
    }, 2_000).unref();
  });
}
