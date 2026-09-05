// src/server/schema.ts
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

// --- USER ROLES ---
export const userRoleEnum = pgEnum("user_role", ["OWNER", "ADMIN", "VIEWER"]);

// --- USERS (Consumers or AI Agent Owners) ---
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }),
  role: userRoleEnum("role").default("OWNER").notNull(),

  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// --- SESSIONS (Authentication) ---
export const sessions = pgTable("sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id)
    .notNull(),
  tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
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
  dailyLimitPaise: integer("daily_limit_paise"),
  lifetimeLimitPaise: integer("lifetime_limit_paise"),

  // JSONB allows us to store an array of strings in Postgres efficiently
  allowedCategories: jsonb("allowed_categories").$type<string[]>().notNull(),

  // Resiliency configurations
  maxSilentRetries: integer("max_silent_retries").default(0).notNull(),
  retryDelaySeconds: integer("retry_delay_seconds").default(30).notNull(),

  // Webhook alerts
  notifyUrl: varchar("notify_url", { length: 255 }),

  // Timestamps
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// --- ENUMS ---
export const transactionStatusEnum = pgEnum("transaction_status", [
  "PENDING",
  "ORDER_CREATED",
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

  // The merchant category this transaction was authorized under at purchase time.
  // Denormalized so the silent-retry recovery path can re-evaluate policy with
  // the REAL category instead of a hardcoded value. Nullable for legacy rows;
  // the recovery path falls back to the merchant's business category.
  merchantCategory: varchar("merchant_category", { length: 100 }),

  amount: integer("amount").notNull(), // Stored in Paise

  status: transactionStatusEnum("status").default("PENDING").notNull(),

  // --- CHAOS CONSOLE FIELDS ---
  failureReason: varchar("failure_reason", { length: 255 }),

  // We compare this against the mandate's maxSilentRetries
  retryCount: integer("retry_count").default(0).notNull(),

  // The external ID from Razorpay (mocked or real)
  razorpayOrderId: varchar("razorpay_order_id", { length: 255 }),

  // Defines deterministic outcome of next retry in mock mode
  nextRetryOutcome: varchar("next_retry_outcome", { length: 20 }).default("SUCCESS").notNull(),

  // Review queue fields
  reviewedAt: timestamp("reviewed_at"),
  reviewedBy: uuid("reviewed_by").references(() => users.id),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// --- PURCHASE ATTEMPTS (Replay Protection, Rate Limiting & Auditing) ---
// Every signed purchase request inserts a row here. The unique nonce provides
// the replay shield; counting recent rows per mandate provides the sliding-window
// rate limiter; outcome records the firewall verdict for telemetry. Rows are
// pruned hourly by the Inngest `prune-stale-data` function.
export const purchaseAttempts = pgTable(
  "purchase_attempts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    mandateId: uuid("mandate_id")
      .references(() => mandates.id)
      .notNull(),
    merchantCategory: varchar("merchant_category", { length: 100 }),
    amountPaise: integer("amount_paise").notNull(),
    nonce: varchar("nonce", { length: 128 }).notNull().unique(),
    outcome: varchar("outcome", { length: 20 }).notNull(), // PENDING, ALLOWED, BLOCKED, RATE_LIMITED
    reason: varchar("reason", { length: 500 }),
    transactionId: uuid("transaction_id").references(() => transactions.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("purchase_attempts_mandate_created_idx").on(table.mandateId, table.createdAt)],
);

// --- AUTH ATTEMPTS (Login Brute-Force Shield) ---
// Records every login attempt per email+IP so the login route can reject
// sustained brute-force runs. Rows are pruned daily by `prune-stale-data`.
export const authAttempts = pgTable(
  "auth_attempts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: varchar("email", { length: 255 }).notNull(),
    ip: varchar("ip", { length: 64 }).notNull(),
    success: boolean("success").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("auth_attempts_email_created_idx").on(table.email, table.createdAt)],
);

// --- AUDIT LOGS (The Cryptographic Trust Trail) ---
// The UNIQUE (mandate_id, previous_hash) index makes hash-chain forks
// IMPOSSIBLE at the database level: two blocks claiming the same predecessor
// can never coexist, so concurrent audit writers (Inngest workers, revocation
// actions) cannot race each other into a broken chain. Writers catch the
// 23505 conflict and re-append against the fresh head (see src/server/audit.ts).
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    mandateId: uuid("mandate_id")
      .references(() => mandates.id)
      .notNull(),

    transactionId: uuid("transaction_id").references(() => transactions.id),

    action: varchar("action", { length: 255 }).notNull(),

    // Gemini plain English explanation
    details: jsonb("details").notNull(),

    // --- THE HASH CHAIN ---
    previousHash: varchar("previous_hash", { length: 64 }).notNull(),
    currentHash: varchar("current_hash", { length: 64 }).notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("audit_logs_mandate_previous_hash_key").on(table.mandateId, table.previousHash),
    index("audit_logs_mandate_created_idx").on(table.mandateId, table.createdAt),
  ],
);

// --- ANCHORS (External Verifiable Checkpoints) ---
export const anchors = pgTable("anchors", {
  id: uuid("id").defaultRandom().primaryKey(),
  mandateId: uuid("mandate_id")
    .references(() => mandates.id)
    .notNull(),
  anchorHash: varchar("anchor_hash", { length: 64 }).notNull(),
  previousAnchorHash: varchar("previous_anchor_hash", { length: 64 }).notNull(),
  lastBlockHash: varchar("last_block_hash", { length: 64 }).notNull(),
  blockCount: integer("block_count").notNull(),
  anchoredAt: timestamp("anchored_at").defaultNow().notNull(),
});
