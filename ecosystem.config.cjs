module.exports = {
  apps: [{
    name: "tebahmadi",
    cwd: "/home/ali/tebahmadi",
    script: "pnpm",
    args: "exec vinext start --port 3210",
    interpreter: "none",
    env: {
      // Keep local defaults for an interactive `pm2 start`, but let the
      // deployment shell provide server-only values from .env.server.
      APP_ENV: process.env.APP_ENV || "local",
      APP_RUNTIME: process.env.APP_RUNTIME || "node",
      PAYMENT_PROVIDER: process.env.PAYMENT_PROVIDER || "mock",
      SHIPPING_PROVIDER: process.env.SHIPPING_PROVIDER || "mock",
      SMS_PROVIDER: process.env.SMS_PROVIDER || "mock"
    },
    autorestart: true,
    max_restarts: 10,
    time: true
  }]
};
