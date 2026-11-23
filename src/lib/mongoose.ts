import mongoose from 'mongoose';

const DEFAULT_SERVER_SELECTION_TIMEOUT_MS = 3_000;
const DEFAULT_FAILURE_COOLDOWN_MS = 5_000;

export function isMongoConfigured(): boolean {
  return Boolean(process.env.MONGO_URI?.trim());
}

/**
 * Returns a singleton Mongoose connection across hot reloads.
 * Concurrent callers share and await the in-flight connection promise
 * instead of returning early while `readyState === 2` (connecting),
 * which otherwise triggers Mongoose operation buffering timeouts.
 */
export async function connectMongoose(): Promise<typeof mongoose> {
  const globalWithMongoose = globalThis as typeof globalThis & {
    __mongooseConnection?: Promise<typeof mongoose>;
    __mongooseConnectionFailure?: { error: unknown; until: number; uri: string };
  };

  if (mongoose.connection.readyState === 1) {
    return mongoose;
  }

  if (globalWithMongoose.__mongooseConnection) {
    return globalWithMongoose.__mongooseConnection;
  }

  const mongoUri = process.env.MONGO_URI?.trim();
  if (!mongoUri) {
    throw new Error('MONGO_URI is not configured');
  }

  const recentFailure = globalWithMongoose.__mongooseConnectionFailure;
  if (recentFailure && recentFailure.uri === mongoUri && recentFailure.until > Date.now()) {
    throw recentFailure.error;
  }
  if (recentFailure) {
    globalWithMongoose.__mongooseConnectionFailure = undefined;
  }

  const parsedTimeout = Number(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS);
  const serverSelectionTimeoutMS =
    Number.isFinite(parsedTimeout) && parsedTimeout > 0
      ? parsedTimeout
      : DEFAULT_SERVER_SELECTION_TIMEOUT_MS;
  const parsedFailureCooldown = Number(process.env.MONGO_FAILURE_COOLDOWN_MS);
  const failureCooldownMs =
    Number.isFinite(parsedFailureCooldown) && parsedFailureCooldown >= 0
      ? parsedFailureCooldown
      : DEFAULT_FAILURE_COOLDOWN_MS;

  mongoose.set('strictQuery', true);
  globalWithMongoose.__mongooseConnection = mongoose
    .connect(mongoUri, {
      serverSelectionTimeoutMS,
      connectTimeoutMS: serverSelectionTimeoutMS,
      autoIndex: process.env.NODE_ENV !== 'production',
    })
    .then((connection) => {
      globalWithMongoose.__mongooseConnectionFailure = undefined;
      return connection;
    })
    .catch((error) => {
      globalWithMongoose.__mongooseConnection = undefined;
      if (failureCooldownMs > 0) {
        globalWithMongoose.__mongooseConnectionFailure = {
          error,
          until: Date.now() + failureCooldownMs,
          uri: mongoUri,
        };
      }
      throw error;
    });

  return globalWithMongoose.__mongooseConnection;
}
