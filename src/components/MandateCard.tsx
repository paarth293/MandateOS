// src/components/MandateCard.tsx
import { CreditCard, RefreshCw, Shield } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

// 1. THE PROPS DEFINITION
// We strictly tell TypeScript exactly what data this card requires to function.
interface MandateCardProps {
  mandate: {
    id: string;
    agentName: string;
    maxAmountPerTransaction: number;
    maxSilentRetries: number;
    allowedCategories: string[];
    status: string;
  };
}

// 2. THE COMPONENT
export default function MandateCard({ mandate }: MandateCardProps) {
  // Format the amount. Our database stores money in Paise (e.g., 500000).
  // We divide by 100 to get Rupees, and use JavaScript's built-in formatter
  // to add commas and the ₹ symbol automatically.
  const formattedAmount = formatCurrency(mandate.maxAmountPerTransaction);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:shadow-md">
      {/* Header section with Icon, Name, ID, and Status Badge */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div className="flex items-center space-x-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">{mandate.agentName} Policy</h3>
            {/* We show the first 12 characters of the ID so it looks like a real crypto/bank reference */}
            <p className="text-xs text-slate-500 font-mono">{mandate.id.substring(0, 12)}...</p>
          </div>
        </div>
        <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
          {mandate.status}
        </span>
      </div>

      {/* Grid section for the critical limits */}
      <div className="mt-4 grid grid-cols-2 gap-4">
        <div>
          <p className="flex items-center text-xs text-slate-500 mb-1">
            <CreditCard className="mr-1 h-3 w-3" /> Max Transaction
          </p>
          <p className="text-lg font-bold text-slate-900">{formattedAmount}</p>
        </div>
        <div>
          <p className="flex items-center text-xs text-slate-500 mb-1">
            <RefreshCw className="mr-1 h-3 w-3" /> Silent Retries
          </p>
          <p className="text-lg font-bold text-slate-900">{mandate.maxSilentRetries}</p>
        </div>
      </div>

      {/* Footer section showing the array of allowed categories */}
      <div className="mt-4 pt-4 border-t border-slate-100">
        <p className="text-xs text-slate-500 mb-2">Allowed Categories</p>
        <div className="flex flex-wrap gap-2">
          {/* We use .map() to automatically generate a badge for every category in the array */}
          {mandate.allowedCategories.map((category) => (
            <span
              key={category}
              className="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600"
            >
              {category}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
