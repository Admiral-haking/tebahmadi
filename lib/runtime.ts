/**
 * Application runtime boundary.
 *
 * Routes depend on this module rather than a platform-specific runtime. Local
 * development uses Node + SQLite; optional deployment adapters can provide the
 * same env contract without changing route code.
 */
export { env } from "./local-node-runtime";
