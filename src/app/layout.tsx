import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MandateOS",
  description: "Policy layer for agent-mediated commerce",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
