import mongoose from 'mongoose';

const DEFAULT_SERVER_SELECTION_TIMEOUT_MS = 8_000;

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

  const parsedTimeout = Number(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS);
  const serverSelectionTimeoutMS =
    Number.isFinite(parsedTimeout) && parsedTimeout > 0
      ? parsedTimeout
      : DEFAULT_SERVER_SELECTION_TIMEOUT_MS;

  mongoose.set('strictQuery', true);
  globalWithMongoose.__mongooseConnection = mongoose
    .connect(mongoUri, {
      serverSelectionTimeoutMS,
      autoIndex: process.env.NODE_ENV !== 'production',
    })
    .catch((error) => {
      globalWithMongoose.__mongooseConnection = undefined;
      throw error;
    });

  return globalWithMongoose.__mongooseConnection;
}
