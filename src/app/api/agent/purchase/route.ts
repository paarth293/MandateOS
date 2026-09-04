import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { MandateOSPaymentGateway } from "@/lib/razorpay";
import { db } from "@/server/db";
import { evaluateMandatePolicy } from "@/server/policy";
import { mandates, transactions } from "@/server/schema";

export async function POST(req: Request) {
  try {
    const { mandateId, amountPaise, category } = await req.json();

    const mandate = await db.query.mandates.findFirst({
      where: eq(mandates.id, mandateId),
    });

    if (!mandate) {
      return NextResponse.json({ error: "Invalid or Revoked Mandate ID" }, { status: 401 });
    }

    const policyCheck = evaluateMandatePolicy(amountPaise, category, mandate, 0);

    if (!policyCheck.allowed) {
      return NextResponse.json(
        {
          error: "Policy Violation Blocked by MandateOS",
          reason: policyCheck.reason,
        },
        { status: 403 },
      );
    }

    const merchant = await db.query.merchants.findFirst();
    if (!merchant) throw new Error("No merchants configured");

    const order = await MandateOSPaymentGateway.createOrder(amountPaise, mandate.id);

    const txId = randomUUID();
    await db.insert(transactions).values({
      id: txId,
      mandateId: mandate.id,
      merchantId: merchant.id,
      amount: amountPaise,
      status: "PENDING",
      razorpayOrderId: order.id,
    });

    return NextResponse.json({
      success: true,
      transactionId: txId,
      razorpayOrderId: order.id,
      message: "Purchase mathematically authorized by MandateOS.",
    });
  } catch (error) {
    console.error("Agent Purchase Error:", error);
    return NextResponse.json({ error: "Internal Gateway Error" }, { status: 500 });
  }
}
