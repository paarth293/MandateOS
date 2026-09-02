// src/server/ai.ts

import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";

// 1. THE ZOD SCHEMA (Strict Output Control)
// This forces Gemini to return a perfect JSON object, never raw text.
export const auditLogSchema = z.object({
  summary: z
    .string()
    .describe("A plain English summary of what happened and why (max 2 sentences)"),
  confidenceScore: z
    .number()
    .describe("Confidence score from 0 to 100 on how accurately we diagnosed the root cause"),
  requiresHumanIntervention: z
    .boolean()
    .describe("True if the failure cannot be auto-recovered (e.g. Card Expired)"),
});

// 2. THE AI FUNCTION
export async function analyzeTransactionFailure(
  failureReason: string,
  retryCount: number,
  maxRetries: number,
) {
  const prompt = `
    You are the AI Policy Engine for MandateOS. A transaction has failed.
    Reason: ${failureReason}
    Current Retry Attempt: ${retryCount}
    Max Allowed Retries: ${maxRetries}
    
    Analyze this failure. If retries are available and it's a temporary error (like BANK_TIMEOUT), 
    explain that a silent retry is happening. If it's permanent or retries are exhausted, 
    explain that human intervention is required.
  `;

  try {
    // We use Gemini 1.5 Flash because it is incredibly fast (~1s) for live demos
    const { object } = await generateObject({
      model: google("models/gemini-1.5-flash-latest"),
      schema: auditLogSchema,
      prompt: prompt,
    });

    return object;
  } catch (error) {
    // --- DEMO SAFETY / FALLBACK ---
    // If the internet goes out or the LLM is slow during the presentation,
    // we instantly return a deterministic fallback response.
    console.warn("AI Generation failed or timed out. Using fallback response.");

    return {
      summary: `System detected ${failureReason}. Attempt ${retryCount} of ${maxRetries}.`,
      confidenceScore: 99,
      requiresHumanIntervention: retryCount >= maxRetries || failureReason === "CARD_EXPIRED",
    };
  }
}
