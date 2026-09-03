import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers"; // <-- Import the new provider

// Use a clean, modern font
const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "MandateOS | AI Agent Policy Engine",
  description: "Cryptographically secure policy engine for AI agent commerce.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-slate-50 text-slate-900`}>
        {/* Wrap the entire app in our React Query Provider for live data fetching */}
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
