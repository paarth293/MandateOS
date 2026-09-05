import { Inngest } from "inngest";

// Initialize the Inngest client.
// In local dev, point at the Inngest Dev Server (http://localhost:8288) so
// inngest.send() doesn't try to reach cloud.inngest.com and fail with 401.
const isDev = process.env.NODE_ENV !== "production";

export const inngest = new Inngest({
  id: "mandate-os",
  ...(isDev && { baseUrl: "http://localhost:8288" }),
});
