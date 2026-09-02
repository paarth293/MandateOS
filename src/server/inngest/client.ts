import { Inngest } from "inngest";

// Initialize the Inngest client.
// (We removed the EventSchemas import because you are on a version of Inngest
// that handles event typing differently. We will strictly type the event payload
// directly inside the function instead!)
export const inngest = new Inngest({ id: "mandate-os" });
