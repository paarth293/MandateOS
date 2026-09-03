// src/app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header"; // <-- Import the Header
import Providers from "@/components/Providers";
import Sidebar from "@/components/Sidebar"; // <-- Import the Sidebar

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
        <Providers>
          {/* This is the master wrapper. It locks the height to the screen (h-screen) */}
          <div className="flex h-screen overflow-hidden">
            {/* 1. The Sidebar is locked to the left side */}
            <Sidebar />

            {/* 2. The main content area takes up the rest of the screen (flex-1) */}
            <div className="flex flex-1 flex-col overflow-hidden">
              {/* 3. The Header is locked to the top of this content area */}
              <Header />

              {/* 4. THE MAGIC: This is where page.tsx is injected! 
                  The overflow-y-auto allows ONLY this section to scroll, 
                  leaving the Header and Sidebar perfectly frozen in place. */}
              <main className="flex-1 overflow-y-auto p-8">{children}</main>
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
