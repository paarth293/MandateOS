// src/components/Header.tsx
import { Bell, Search } from "lucide-react";

export default function Header() {
  return (
    <header className="flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white px-6">
      {/* Search Bar Area */}
      <div className="flex items-center text-slate-500">
        <Search className="mr-2 h-5 w-5" />
        <input
          type="text"
          placeholder="Search mandates..."
          className="bg-transparent text-sm focus:outline-none w-64"
        />
      </div>

      {/* User Profile Area */}
      <div className="flex items-center space-x-4">
        <button type="button" className="text-slate-500 hover:text-slate-700 transition-colors">
          <Bell className="h-5 w-5" />
        </button>
        <div className="flex items-center space-x-2 border-l border-slate-200 pl-4">
          <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm">
            P
          </div>
          <span className="text-sm font-medium text-slate-700">Priya (Agent)</span>
        </div>
      </div>
    </header>
  );
}
