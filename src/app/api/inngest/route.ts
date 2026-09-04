import { serve } from "inngest/next";
import { inngest } from "@/server/inngest/client";
import {
  generateAuditLog,
  publishAuditAnchor,
  reconcileStaleOrders,
  recoverFailedPayment,
} from "@/server/inngest/functions";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [recoverFailedPayment, generateAuditLog, reconcileStaleOrders, publishAuditAnchor],
});
