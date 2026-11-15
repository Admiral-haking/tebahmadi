import { validateProductionConfig } from "../lib/production-config.ts";
const errors = validateProductionConfig(process.env);
const payment = String(process.env.PAYMENT_PROVIDER || "").toLowerCase();
const shipping = String(process.env.SHIPPING_PROVIDER || "").toLowerCase();

if (errors.length) {
  console.error("Production configuration is not ready:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log(`Production configuration is valid (payment=${payment}, shipping=${shipping}); secrets were not printed.`);
