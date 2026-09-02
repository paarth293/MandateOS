// src/server/schema.ts
import { integer, jsonb, pgEnum, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

// --- USERS (Consumers or AI Agent Owners) ---
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),

  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// --- MERCHANTS (The entities receiving payments) ---
export const merchants = pgTable("merchants", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  businessCategory: varchar("business_category", { length: 100 }).notNull(),

  // The merchant's receiving payment identifier (e.g., TechSupply@razorpay)
  upiId: varchar("upi_id", { length: 255 }).notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const mandateStatusEnum = pgEnum("mandate_status", ["ACTIVE", "REVOKED", "EXPIRED"]);

// --- MANDATES (The Policy & Trust Layer) ---
export const mandates = pgTable("mandates", {
  id: uuid("id").defaultRandom().primaryKey(),

  // Foreign Key linking back to the human who created it (e.g., Priya)
  userId: uuid("user_id")
    .references(() => users.id)
    .notNull(),

  // The AI Agent this mandate applies to (e.g., 'Google-AP2')
  agentName: varchar("agent_name", { length: 255 }).notNull(),

  // --- TRUST LAYER ---
  // Storing the Ed25519 public key and signature so anyone can verify it
  publicKey: varchar("public_key", { length: 255 }).notNull(),
  signature: varchar("signature", { length: 255 }).notNull(),

  status: mandateStatusEnum("status").default("ACTIVE").notNull(),

  // --- POLICY ENGINE RULES ---
  // Stored in strictly integers (paise/cents) to prevent floating-point math errors
  maxAmountPerTransaction: integer("max_amount_per_transaction").notNull(),

  // JSONB allows us to store an array of strings in Postgres efficiently
  allowedCategories: jsonb("allowed_categories").$type<string[]>().notNull(),

  // Crucial for the Chaos Console demo!
  maxSilentRetries: integer("max_silent_retries").default(0).notNull(),

  // Timestamps
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// --- ENUMS ---
// We track 4 states: PENDING, SUCCESS, FAILED, and the magical "RECOVERED"
// RECOVERED means it failed originally, but our Agent Policy Engine saved it!
export const transactionStatusEnum = pgEnum("transaction_status", [
  "PENDING",
  "SUCCESS",
  "FAILED",
  "RECOVERED",
]);

// --- TRANSACTIONS (The Event Stream) ---
export const transactions = pgTable("transactions", {
  id: uuid("id").defaultRandom().primaryKey(),

  // Link to the policy and the seller
  mandateId: uuid("mandate_id")
    .references(() => mandates.id)
    .notNull(),
  merchantId: uuid("merchant_id")
    .references(() => merchants.id)
    .notNull(),

  amount: integer("amount").notNull(), // Remember: Stored in Paise!

  status: transactionStatusEnum("status").default("PENDING").notNull(),

  // --- CHAOS CONSOLE FIELDS ---
  // If the transaction fails, we store the exact reason here (e.g., "BANK_TIMEOUT")
  failureReason: varchar("failure_reason", { length: 255 }),

  // We compare this against the mandate's maxSilentRetries
  retryCount: integer("retry_count").default(0).notNull(),

  // The external ID from Razorpay (mocked or real)
  razorpayOrderId: varchar("razorpay_order_id", { length: 255 }),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// --- AUDIT LOGS (The Cryptographic Trust Trail) ---
export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),

  // What is this log about?
  mandateId: uuid("mandate_id")
    .references(() => mandates.id)
    .notNull(),

  // Nullable, because some logs (like "Mandate Created") happen before any transaction exists
  transactionId: uuid("transaction_id").references(() => transactions.id),

  // e.g., 'PAYMENT_FAILED', 'RECOVERY_INITIATED', 'LLM_ANALYSIS_COMPLETE'
  action: varchar("action", { length: 255 }).notNull(),

  // This will store the Gemini LLM's plain English explanation!
  details: jsonb("details").notNull(),

  // --- THE HASH CHAIN (Magic happens here) ---
  // SHA-256 hashes are always exactly 64 characters long
  previousHash: varchar("previous_hash", { length: 64 }).notNull(),
  currentHash: varchar("current_hash", { length: 64 }).notNull(),

  // Audit logs are strictly append-only/immutable, so there is no updatedAt
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
