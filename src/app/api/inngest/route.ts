import { serve } from "inngest/next";
import { inngest } from "@/server/inngest/client";
import { generateAuditLog, recoverFailedPayment } from "@/server/inngest/functions";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [recoverFailedPayment, generateAuditLog],
});
