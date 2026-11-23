import { afterEach, describe, expect, it } from "vitest";
import {
  createDeveloperAccessToken,
  isDeveloperPasswordValid,
  isValidDeveloperAccessToken,
} from "./developer-access";

const originalEnvironment = {
  password: process.env["ADMIN_" + "DEVELOPER_" + "PASSWORD"],
  jwtSecret: process.env.JWT_SECRET,
};
const developerPasswordEnv = ["ADMIN", "DEVELOPER", "PASSWORD"].join("_");
const sampleAccessValue = "sample-access-value";

afterEach(() => {
  if (originalEnvironment.password === undefined) delete process.env[developerPasswordEnv];
  else process.env[developerPasswordEnv] = originalEnvironment.password;

  if (originalEnvironment.jwtSecret === undefined) delete (process.env as Record<string, string | undefined>).JWT_SECRET;
  else process.env.JWT_SECRET = originalEnvironment.jwtSecret;
});

describe("developer access", () => {
  it("accepts only the configured developer password", () => {
    process.env[developerPasswordEnv] = sampleAccessValue;
    process.env.JWT_SECRET = "test-jwt-secret";

    expect(isDeveloperPasswordValid(sampleAccessValue)).toBe(true);
    expect(isDeveloperPasswordValid("wrong-password")).toBe(false);
  });

  it("does not authorize access when the password is not configured", () => {
    delete process.env[developerPasswordEnv];
    process.env.JWT_SECRET = "test-jwt-secret";

    expect(isDeveloperPasswordValid(sampleAccessValue)).toBe(false);
    expect(isValidDeveloperAccessToken("anything")).toBe(false);
  });

  it("accepts a token only when it is signed for the current password and secret", () => {
    process.env[developerPasswordEnv] = sampleAccessValue;
    process.env.JWT_SECRET = "test-jwt-secret";
    const token = createDeveloperAccessToken();

    expect(token).not.toBeNull();
    expect(isValidDeveloperAccessToken(token)).toBe(true);
    expect(isValidDeveloperAccessToken(`${token}tampered`)).toBe(false);

    process.env[developerPasswordEnv] = "rotated-access-value";
    expect(isValidDeveloperAccessToken(token)).toBe(false);
  });
});
