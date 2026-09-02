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
