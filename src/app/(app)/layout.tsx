// src/app/(app)/layout.tsx
// Ops console shell: frozen Sidebar (left) + Header (top), with only the main
// content column scrolling. Every page inside this route group is
// authenticated console UI, and the auth boundary lives HERE (not in each
// page): unauthenticated visitors are redirected to /login before the shell
// ever renders.
import { redirect } from "next/navigation";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import { getSessionUser } from "@/server/auth";

export const dynamic = "force-dynamic";

export default async function AppShellLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* 1. The Sidebar is locked to the left side */}
      <Sidebar />

      {/* 2. The main content area takes up the rest of the screen (flex-1) */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* 3. The Header is locked to the top of this content area */}
        <Header />

        {/* 4. Only this section scrolls, leaving the Header and Sidebar frozen */}
        <main className="flex-1 overflow-y-auto p-8">{children}</main>
      </div>
    </div>
  );
}
