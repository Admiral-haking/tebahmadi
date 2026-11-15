module.exports = {
  apps: [{
    name: "tebahmadi",
    cwd: "/home/ali/tebahmadi",
    script: "pnpm",
    args: "exec vinext start --port 3210",
    interpreter: "none",
    env: {
      APP_ENV: "local",
      APP_RUNTIME: "node",
      PAYMENT_PROVIDER: "mock",
      SHIPPING_PROVIDER: "mock",
      SMS_PROVIDER: "mock"
    },
    autorestart: true,
    max_restarts: 10,
    time: true
  }]
};
