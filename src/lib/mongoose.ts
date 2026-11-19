import mongoose from 'mongoose';

/**
 * Returns a singleton Mongoose connection across hot reloads.
 */
export async function connectMongoose(): Promise<typeof mongoose> {
  const globalWithMongoose = globalThis as typeof globalThis & {
    __mongooseConnection?: Promise<typeof mongoose>;
  };

  if (mongoose.connection.readyState === 1 || mongoose.connection.readyState === 2) {
    return mongoose;
  }

  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    throw new Error('MONGO_URI is not configured');
  }

  if (!globalWithMongoose.__mongooseConnection) {
    mongoose.set('strictQuery', true);
    globalWithMongoose.__mongooseConnection = mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 50_000,
      autoIndex: process.env.NODE_ENV !== 'production',
    });
  }

  await globalWithMongoose.__mongooseConnection;
  return mongoose;
}
