// src/app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "MandateOS | AI Agent Policy Engine",
  description: "Cryptographically secure policy engine for AI agent commerce.",
};

/**
 * Root layout: document shell + React Query provider only. Route groups decide
 * their own chrome — (app) wraps pages in the ops Sidebar/Header shell, while
 * (auth) pages like /login render standalone without any console chrome.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-slate-50 text-slate-900`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
