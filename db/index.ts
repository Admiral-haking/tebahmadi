import { env } from "@/lib/runtime";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export function getDb() {
  if (!env.DB) {
    throw new Error(
      "Local SQLite database binding `DB` is unavailable. Start the application through the Node runtime or run the local database bootstrap first."
    );
  }

  return drizzle(env.DB as never, { schema });
}
