import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import mongoose from 'mongoose';
import { connectMongoose, isMongoConfigured } from './mongoose';

describe('connectMongoose and isMongoConfigured', () => {
  const originalMongoUri = process.env.MONGO_URI;
  const globalWithMongoose = globalThis as typeof globalThis & {
    __mongooseConnection?: Promise<typeof mongoose>;
  };

  beforeEach(() => {
    delete (process.env as Record<string, string | undefined>).MONGO_URI;
    globalWithMongoose.__mongooseConnection = undefined;
    Object.defineProperty(mongoose.connection, 'readyState', {
      value: 0,
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    globalWithMongoose.__mongooseConnection = undefined;
    if (originalMongoUri === undefined) {
      delete (process.env as Record<string, string | undefined>).MONGO_URI;
    } else {
      process.env.MONGO_URI = originalMongoUri;
    }
  });

  it('reports whether MONGO_URI is configured', () => {
    expect(isMongoConfigured()).toBe(false);
    process.env.MONGO_URI = '   ';
    expect(isMongoConfigured()).toBe(false);
    process.env.MONGO_URI = 'mongodb://127.0.0.1:27017/test';
    expect(isMongoConfigured()).toBe(true);
  });

  it('throws when MONGO_URI is missing', async () => {
    await expect(connectMongoose()).rejects.toThrow('MONGO_URI is not configured');
  });

  it('shares and awaits an in-flight connection when readyState is connecting (2)', async () => {
    process.env.MONGO_URI = 'mongodb://127.0.0.1:27017/test';

    let resolveConnect!: (value: typeof mongoose) => void;
    const connectSpy = vi.spyOn(mongoose, 'connect').mockImplementation(() => {
      Object.defineProperty(mongoose.connection, 'readyState', {
        value: 2,
        configurable: true,
        writable: true,
      });
      return new Promise<typeof mongoose>((resolve) => {
        resolveConnect = resolve;
      });
    });

    const firstCall = connectMongoose();
    const secondCall = connectMongoose();

    let secondResolved = false;
    void secondCall.then(() => {
      secondResolved = true;
    });

    await Promise.resolve();
    expect(connectSpy).toHaveBeenCalledTimes(1);
    expect(secondResolved).toBe(false);

    Object.defineProperty(mongoose.connection, 'readyState', {
      value: 1,
      configurable: true,
      writable: true,
    });
    resolveConnect(mongoose);

    const [r1, r2] = await Promise.all([firstCall, secondCall]);
    expect(r1).toBe(mongoose);
    expect(r2).toBe(mongoose);
    expect(secondResolved).toBe(true);
  });

  it('clears the cached promise after a failed connection so retries can succeed', async () => {
    process.env.MONGO_URI = 'mongodb://127.0.0.1:27017/test';

    const connectSpy = vi
      .spyOn(mongoose, 'connect')
      .mockRejectedValueOnce(new Error('connection refused'))
      .mockResolvedValueOnce(mongoose);

    await expect(connectMongoose()).rejects.toThrow('connection refused');
    expect(globalWithMongoose.__mongooseConnection).toBeUndefined();

    const result = await connectMongoose();
    expect(result).toBe(mongoose);
    expect(connectSpy).toHaveBeenCalledTimes(2);
  });
});
