// src/server/auth.ts
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "./db";
import { sessions, users } from "./schema";

export const SESSION_COOKIE_NAME = "mandateos_session";
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Hashes a plaintext password using scrypt with a random salt.
 * Returns in the format: salt:hash
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(password, salt, 64);
  return `${salt}:${derivedKey.toString("hex")}`;
}

/**
 * Constant-time verification of password against stored salt:hash.
 */
export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [salt, key] = stored.split(":");
    if (!salt || !key) return false;

    const keyBuffer = Buffer.from(key, "hex");
    const derivedKey = scryptSync(password, salt, 64);
    return timingSafeEqual(keyBuffer, derivedKey);
  } catch {
    return false;
  }
}

/**
 * Creates a new authenticated session for a user and sets the httpOnly cookie.
 */
export async function createSession(userId: string): Promise<string> {
  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  await db.insert(sessions).values({
    userId,
    tokenHash,
    expiresAt,
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, rawToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  });

  return rawToken;
}

/**
 * Destroys the current user session from database and clears the cookie.
 */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (token) {
    const tokenHash = createHash("sha256").update(token).digest("hex");
    await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
  }

  cookieStore.delete(SESSION_COOKIE_NAME);
}

/**
 * Retrieves the currently authenticated user based on the session cookie.
 */
export async function getSessionUser() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (!token) return null;

    const tokenHash = createHash("sha256").update(token).digest("hex");

    const sessionRow = await db.query.sessions.findFirst({
      where: and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, new Date())),
    });

    if (!sessionRow) return null;

    const user = await db.query.users.findFirst({
      where: eq(users.id, sessionRow.userId),
    });

    return user ?? null;
  } catch (error) {
    console.error("Failed to retrieve session user:", error);
    return null;
  }
}

/**
 * Guard that enforces an active session exists; throws an Error if unauthenticated.
 */
export async function requireUser() {
  const user = await getSessionUser();
  if (!user) {
    throw new Error("UNAUTHORIZED: Active session required");
  }
  return user;
}

/**
 * Guard that enforces user possesses one of the authorized roles.
 */
export async function requireRole(allowedRoles: ("OWNER" | "ADMIN" | "VIEWER")[]) {
  const user = await requireUser();
  if (!allowedRoles.includes(user.role)) {
    throw new Error(
      `FORBIDDEN: Insufficient role permissions. Requires: ${allowedRoles.join(", ")}`,
    );
  }
  return user;
}
