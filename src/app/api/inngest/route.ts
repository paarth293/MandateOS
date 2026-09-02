import { serve } from "inngest/next";
import { inngest } from "@/server/inngest/client";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    // We will inject our "Retry Payment" and "Write Audit Log" jobs here in the next step!
  ],
});
