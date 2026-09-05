// src/app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "MandateOS — Cryptographic Firewall for Agent Commerce",
  description:
    "The deterministic security, governance, and autonomous recovery control plane for AI agent payments. Ed25519-signed, hash-chain audited, mathematically unbypassable.",
};

/**
 * Root layout: document shell + React Query provider only. Route groups decide
 * their own chrome — (app) wraps pages in the ops Sidebar/Header shell, while
 * (auth) pages like /login render standalone without any console chrome.
 *
 * MandateOS ships a single "dark ops" theme (see globals.css) rather than a
 * light/dark toggle — a security firewall console should always look like
 * one, on every screen, every time.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} text-slate-100`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
