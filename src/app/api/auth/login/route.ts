import { and, eq, gte, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { createSession, verifyPassword } from "@/server/auth";
import { db } from "@/server/db";
import { authAttempts, users } from "@/server/schema";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password } = body;

    if (!email || !password || typeof email !== "string" || typeof password !== "string") {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();
    // Best-effort client IP (behind proxies, set x-forwarded-for). Falls back
    // to "unknown" in local dev where the header is absent.
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

    // Brute-force shield: reject before verifying when this email+IP has failed
    // too often within the lockout window. Recorded attempts are pruned daily
    // by the Inngest `prune-stale-data` function.
    const lockoutWindowStart = new Date(Date.now() - LOCKOUT_WINDOW_MS);
    const [failedCountResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(authAttempts)
      .where(
        and(
          eq(authAttempts.email, normalizedEmail),
          eq(authAttempts.ip, ip),
          eq(authAttempts.success, false),
          gte(authAttempts.createdAt, lockoutWindowStart),
        ),
      );

    if (Number(failedCountResult?.count ?? 0) >= MAX_FAILED_ATTEMPTS) {
      return NextResponse.json(
        { error: "Too many failed login attempts. Please try again later." },
        { status: 429 },
      );
    }

    const user = await db.query.users.findFirst({
      where: eq(users.email, normalizedEmail),
    });

    const isValid = user?.passwordHash ? verifyPassword(password, user.passwordHash) : false;

    if (!user?.passwordHash || !isValid) {
      await db.insert(authAttempts).values({ email: normalizedEmail, ip, success: false });
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    // Record success (audit + keeps the per-IP failure window honest).
    await db.insert(authAttempts).values({ email: normalizedEmail, ip, success: true });
    await createSession(user.id);

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Login route error:", error);
    return NextResponse.json({ error: "Authentication failed" }, { status: 500 });
  }
}
