import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/server/auth";
import { db } from "@/server/db";
import { evaluateMandatePolicy } from "@/server/policy";
import { mandates } from "@/server/schema";
import { getCommittedSpendTotals } from "@/server/spend";

const simulatePolicySchema = z.object({
  mandateId: z.string().uuid("Invalid Mandate UUID format"),
  amountPaise: z.number().int().positive("Amount must be a positive integer in paise"),
  category: z.string().min(1, "Merchant category is required"),
  retryCount: z.number().int().min(0).default(0),
});

export async function POST(req: Request) {
  try {
    // 0. Ownership check: only the mandate's owner may simulate against it.
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const parsed = simulatePolicySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid simulation payload",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const { mandateId, amountPaise, category, retryCount } = parsed.data;

    // 1. Fetch Mandate
    const mandate = await db.query.mandates.findFirst({
      where: eq(mandates.id, mandateId),
    });

    if (!mandate) {
      return NextResponse.json(
        {
          error: "MANDATE_NOT_FOUND",
          message: `No mandate found with ID: ${mandateId}`,
        },
        { status: 404 },
      );
    }

    // Ownership check: simulate only against the user's own mandate.
    if (mandate.userId !== user.id) {
      return NextResponse.json(
        {
          error: "MANDATE_NOT_FOUND",
          message: `No mandate found with ID: ${mandateId}`,
        },
        { status: 404 },
      );
    }

    // 2. Compute current cumulative committed spends (read-only)
    const { spentTodayPaise, spentLifetimePaise } = await getCommittedSpendTotals(mandate.id);

    // 3. Evaluate policy
    const policyResult = evaluateMandatePolicy(amountPaise, category, mandate, retryCount, {
      spentTodayPaise,
      spentLifetimePaise,
    });

    // 4. Identify specific rule tripped (if any)
    let ruleTripped: string | null = null;
    if (!policyResult.allowed) {
      if (policyResult.reason.includes("MANDATE_EXPIRED")) ruleTripped = "EXPIRY_DATE";
      else if (policyResult.reason.includes("MANDATE_STATUS")) ruleTripped = "MANDATE_STATUS";
      else if (policyResult.reason.includes("LIMIT_EXCEEDED")) ruleTripped = "MAX_PER_TRANSACTION";
      else if (policyResult.reason.includes("DAILY_LIMIT_EXCEEDED")) ruleTripped = "DAILY_CAP";
      else if (policyResult.reason.includes("LIFETIME_LIMIT_EXCEEDED"))
        ruleTripped = "LIFETIME_CAP";
      else if (policyResult.reason.includes("CATEGORY_BLOCKED"))
        ruleTripped = "CATEGORY_RESTRICTION";
      else if (policyResult.reason.includes("MAX_RETRIES_EXCEEDED")) ruleTripped = "MAX_RETRIES";
      else ruleTripped = "UNKNOWN_POLICY_VIOLATION";
    }

    // 5. Structure full simulation report
    return NextResponse.json({
      verdict: policyResult.allowed ? "PASS" : "BLOCK",
      allowed: policyResult.allowed,
      reason: policyResult.reason,
      ruleTripped,
      mandate: {
        id: mandate.id,
        agentName: mandate.agentName,
        status: mandate.status,
        expiresAt: mandate.expiresAt.toISOString(),
      },
      evaluation: {
        requested: {
          amountPaise,
          category,
          retryCount,
        },
        breakdown: {
          singleTransaction: {
            amountPaise,
            capPaise: mandate.maxAmountPerTransaction,
            allowed: amountPaise <= mandate.maxAmountPerTransaction,
          },
          dailySpend: {
            spentTodayPaise,
            dailyCapPaise: mandate.dailyLimitPaise,
            projectedTodayPaise: spentTodayPaise + amountPaise,
            remainingDailyPaise: mandate.dailyLimitPaise
              ? Math.max(0, mandate.dailyLimitPaise - spentTodayPaise)
              : null,
            allowed:
              !mandate.dailyLimitPaise || spentTodayPaise + amountPaise <= mandate.dailyLimitPaise,
          },
          lifetimeSpend: {
            spentLifetimePaise,
            lifetimeCapPaise: mandate.lifetimeLimitPaise,
            projectedLifetimePaise: spentLifetimePaise + amountPaise,
            remainingLifetimePaise: mandate.lifetimeLimitPaise
              ? Math.max(0, mandate.lifetimeLimitPaise - spentLifetimePaise)
              : null,
            allowed:
              !mandate.lifetimeLimitPaise ||
              spentLifetimePaise + amountPaise <= mandate.lifetimeLimitPaise,
          },
          category: {
            requestedCategory: category,
            allowedCategories: mandate.allowedCategories,
            allowed: mandate.allowedCategories.includes(category),
          },
          retryStatus: {
            currentRetryCount: retryCount,
            maxAllowedRetries: mandate.maxSilentRetries,
            allowed: retryCount < mandate.maxSilentRetries,
          },
          lifecycle: {
            expiresAt: mandate.expiresAt.toISOString(),
            isExpired: new Date() > mandate.expiresAt,
            status: mandate.status,
            isActive: mandate.status === "ACTIVE",
          },
        },
      },
      simulatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Policy simulation error:", error);
    return NextResponse.json(
      {
        error: "INTERNAL_ERROR",
        message: "Failed to simulate mandate spend policy",
      },
      { status: 500 },
    );
  }
}
