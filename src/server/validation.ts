// src/server/validation.ts
import { z } from "zod";

// --- AUTHENTICATION ---
export const loginSchema = z.object({
  email: z.string().email("Invalid email format").max(255),
  password: z.string().min(6, "Password must be at least 6 characters").max(100),
});

// --- AGENT COMMERCE ---
export const purchaseRequestSchema = z.object({
  mandateId: z.string().uuid("Invalid mandate UUID"),
  amountPaise: z
    .number()
    .int("Amount must be an integer (in paise)")
    .positive("Amount must be greater than zero"),
  category: z.string().min(1, "Category is required").max(100, "Category exceeds max length"),
  idempotencyKey: z.string().max(128).optional(),
});

export const purchaseHeadersSchema = z.object({
  "x-mandate-signature": z.string().min(64, "Invalid signature length").max(256),
  "x-timestamp": z.string().regex(/^\d+$/, "Timestamp must be numeric epoch string"),
  "x-nonce": z.string().min(16, "Nonce too short").max(128, "Nonce exceeds max length"),
});

// --- CHAOS CONSOLE ---
export const chaosTriggerSchema = z.object({
  transactionId: z.string().uuid("Invalid transaction UUID"),
  mandateId: z.string().uuid("Invalid mandate UUID"),
  failureReason: z.enum(["BANK_TIMEOUT", "INSUFFICIENT_FUNDS", "CARD_EXPIRED"]),
});

// --- MANDATE LIFECYCLE ---
export const createMandateSchema = z.object({
  agentName: z.string().min(2, "Agent name too short").max(100, "Agent name too long"),
  maxAmountPerTransaction: z.number().int().positive(),
  dailyLimitPaise: z.number().int().positive().optional(),
  lifetimeLimitPaise: z.number().int().positive().optional(),
  allowedCategories: z.array(z.string().min(1).max(100)).min(1, "At least one category required"),
  maxSilentRetries: z.number().int().min(0).max(5).default(3),
  retryDelaySeconds: z.number().int().min(5).max(300).default(30),
  notifyUrl: z.string().url("Invalid alert webhook URL").max(255).optional(),
});

export const updateMandateSchema = z.object({
  maxAmountPerTransaction: z.number().int().positive().optional(),
  dailyLimitPaise: z.number().int().positive().optional(),
  lifetimeLimitPaise: z.number().int().positive().optional(),
  allowedCategories: z.array(z.string().min(1).max(100)).optional(),
  maxSilentRetries: z.number().int().min(0).max(5).optional(),
  retryDelaySeconds: z.number().int().min(5).max(300).optional(),
  notifyUrl: z.string().url().max(255).nullable().optional(),
});

// --- MERCHANTS ---
export const merchantSchema = z.object({
  name: z.string().min(2).max(255),
  businessCategory: z.string().min(2).max(100),
  upiId: z.string().min(3).max(255),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type PurchaseRequestInput = z.infer<typeof purchaseRequestSchema>;
export type PurchaseHeadersInput = z.infer<typeof purchaseHeadersSchema>;
export type ChaosTriggerInput = z.infer<typeof chaosTriggerSchema>;
export type CreateMandateInput = z.infer<typeof createMandateSchema>;
export type UpdateMandateInput = z.infer<typeof updateMandateSchema>;
export type MerchantInput = z.infer<typeof merchantSchema>;
