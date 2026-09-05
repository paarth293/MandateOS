// src/app/(auth)/layout.tsx
// Standalone layout for auth surfaces (login). No Sidebar/Header chrome —
// public visitors should only ever see the brand + auth card.
export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 px-4 py-10">
      {children}
    </div>
  );
}
