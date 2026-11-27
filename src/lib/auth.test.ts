import jwt from "jsonwebtoken";
import { afterEach, describe, expect, it } from "vitest";

import { signJwt } from "./auth";

const originalSecret = process.env.JWT_SECRET;
const originalTtl = process.env.JWT_TTL_SECONDS;

afterEach(() => {
  if (originalSecret === undefined) Reflect.deleteProperty(process.env, 'JWT_SECRET');
  else process.env.JWT_SECRET = originalSecret;

  if (originalTtl === undefined) Reflect.deleteProperty(process.env, 'JWT_TTL_SECONDS');
  else process.env.JWT_TTL_SECONDS = originalTtl;
});

describe("auth session lifetime", () => {
  it("uses a 30-day default JWT lifetime", () => {
    process.env.JWT_SECRET = "test-jwt-secret";
    Reflect.deleteProperty(process.env, 'JWT_TTL_SECONDS');

    const token = signJwt({ sub: "user-id", phone: "+989120000000", roles: ["customer"] });
    const payload = jwt.decode(token) as jwt.JwtPayload;

    expect(payload.exp).toBeDefined();
    expect(payload.iat).toBeDefined();
    expect((payload.exp ?? 0) - (payload.iat ?? 0)).toBe(30 * 24 * 60 * 60);
  });

  it("keeps the configured JWT lifetime as an override", () => {
    process.env.JWT_SECRET = "test-jwt-secret";
    process.env.JWT_TTL_SECONDS = "7200";

    const token = signJwt({ sub: "user-id", phone: "+989120000000", roles: ["customer"] });
    const payload = jwt.decode(token) as jwt.JwtPayload;

    expect((payload.exp ?? 0) - (payload.iat ?? 0)).toBe(7200);
  });
});
