import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { NextRequest, NextResponse } from "next/server";

export const DEVELOPER_ACCESS_COOKIE_NAME = "tebahmadi_developer_access";
export const DEVELOPER_ACCESS_COOKIE_MAX_AGE = 8 * 60 * 60;

const TOKEN_VERSION = "v1";

function configuredPassword(): string | null {
  const password = process.env.ADMIN_DEVELOPER_PASSWORD;
  return password && password.length > 0 ? password : null;
}

function signingSecret(): string | null {
  const secret = process.env.JWT_SECRET;
  return secret && secret.length > 0 ? secret : null;
}

function digest(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

function valuesMatch(left: string, right: string): boolean {
  const leftDigest = digest(left);
  const rightDigest = digest(right);
  return timingSafeEqual(leftDigest, rightDigest);
}

export function isDeveloperPasswordValid(password: string): boolean {
  const configured = configuredPassword();
  if (!configured || typeof password !== "string" || password.length > 128) {
    return false;
  }

  return valuesMatch(password, configured);
}

export function createDeveloperAccessToken(): string | null {
  const password = configuredPassword();
  const secret = signingSecret();
  if (!password || !secret) {
    return null;
  }

  return createHmac("sha256", secret)
    .update(`${TOKEN_VERSION}:developer-access:${password}`, "utf8")
    .digest("base64url");
}

export function isValidDeveloperAccessToken(token: string | null | undefined): boolean {
  const expected = createDeveloperAccessToken();
  if (!expected || !token || token.length > 256) {
    return false;
  }

  return valuesMatch(token, expected);
}

export function hasDeveloperAccess(request: Pick<NextRequest, "cookies">): boolean {
  return isValidDeveloperAccessToken(request.cookies.get(DEVELOPER_ACCESS_COOKIE_NAME)?.value);
}

export async function hasDeveloperAccessFromCookies(): Promise<boolean> {
  const cookieStore = await cookies();
  return isValidDeveloperAccessToken(cookieStore.get(DEVELOPER_ACCESS_COOKIE_NAME)?.value);
}

export function setDeveloperAccessCookie(response: NextResponse): void {
  const token = createDeveloperAccessToken();
  if (!token) {
    throw new Error("Developer access is not configured");
  }

  response.cookies.set({
    name: DEVELOPER_ACCESS_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DEVELOPER_ACCESS_COOKIE_MAX_AGE,
  });
}

export function clearDeveloperAccessCookie(response: NextResponse): void {
  response.cookies.set({
    name: DEVELOPER_ACCESS_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}
