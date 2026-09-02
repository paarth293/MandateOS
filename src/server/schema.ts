// src/server/schema.ts
import { pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

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
