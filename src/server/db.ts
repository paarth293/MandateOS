import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is missing from environment variables");
}

// We use the neon-http driver which doesn't exhaust connection pools
// on serverless platforms like Vercel.
const sql = neon(process.env.DATABASE_URL);
export const db = drizzle(sql, { schema });
