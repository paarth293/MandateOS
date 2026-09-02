import { Inngest } from "inngest";

//give the unique id for proper mapping if we have multiple things running on the server
export const inngest = new Inngest({
  id: "mandate-os",
});
