// src/components/Providers.tsx
"use client"; // This tells Next.js this component runs in the browser, not the server

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export default function Providers({ children }: { children: React.ReactNode }) {
  // We place the QueryClient inside a useState hook.
  // This ensures that the cache isn't accidentally shared across different users
  // if you were to deploy this on a high-traffic production server.
  const [queryClient] = useState(() => new QueryClient());

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
