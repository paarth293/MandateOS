"use client";

import {
  AlertTriangle,
  Check,
  Copy,
  Key,
  Plus,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { formatCurrency } from "@/lib/utils";

interface MandateRecord {
  id: string;
  agentName: string;
  publicKey: string;
  signature: string;
  status: "ACTIVE" | "REVOKED" | "EXPIRED";
  maxAmountPerTransaction: number;
  dailyLimitPaise: number | null;
  lifetimeLimitPaise: number | null;
  allowedCategories: string[];
  maxSilentRetries: number;
  retryDelaySeconds: number;
  notifyUrl: string | null;
  expiresAt: string;
  createdAt: string;
}

interface IssuedCredentials {
  publicKey: string;
  secretKey: string;
  instructions: string;
}

export default function MandatesPage() {
  const [mandates, setMandates] = useState<MandateRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [issuedCredentials, setIssuedCredentials] = useState<IssuedCredentials | null>(null);
  const [newMandateId, setNewMandateId] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Form inputs
  const [formData, setFormData] = useState({
    agentName: "",
    maxAmountRupees: "5000",
    dailyLimitRupees: "25000",
    lifetimeLimitRupees: "100000",
    allowedCategories: "Cloud Servers, AI Inference, APIs",
    maxSilentRetries: 3,
    retryDelaySeconds: 30,
    notifyUrl: "",
  });

  const fetchMandates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/mandates");
      if (res.ok) {
        const data = await res.json();
        setMandates(data.mandates || []);
      }
    } catch (err) {
      console.error("Failed to load mandates:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMandates();
  }, [fetchMandates]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleCreateMandate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setActionError(null);

    const categories = formData.allowedCategories
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);

    const payload = {
      agentName: formData.agentName,
      maxAmountPerTransaction: Math.round(Number.parseFloat(formData.maxAmountRupees) * 100),
      dailyLimitPaise: formData.dailyLimitRupees
        ? Math.round(Number.parseFloat(formData.dailyLimitRupees) * 100)
        : undefined,
      lifetimeLimitPaise: formData.lifetimeLimitRupees
        ? Math.round(Number.parseFloat(formData.lifetimeLimitRupees) * 100)
        : undefined,
      allowedCategories: categories.length > 0 ? categories : ["Cloud Servers"],
      maxSilentRetries: Number(formData.maxSilentRetries),
      retryDelaySeconds: Number(formData.retryDelaySeconds),
      notifyUrl: formData.notifyUrl || undefined,
    };

    try {
      const res = await fetch("/api/mandates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create mandate");
      }

      setIssuedCredentials(data.credentials);
      setNewMandateId(data.mandate.id);
      fetchMandates();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Creation failed");
    } finally {
      setCreating(false);
    }
  };

  const handleRevokeMandate = async (id: string) => {
    if (
      !confirm(
        "Are you sure you want to revoke this mandate? The agent will immediately be blocked from making any purchases.",
      )
    ) {
      return;
    }

    try {
      const res = await fetch(`/api/mandates?id=${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "REVOKED" }),
      });

      if (res.ok) {
        fetchMandates();
      }
    } catch (err) {
      console.error("Revocation failed:", err);
    }
  };

  const activeCount = mandates.filter((m) => m.status === "ACTIVE").length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <ShieldCheck className="h-7 w-7 text-blue-600" />
            Mandates & Policy Firewall
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Issue cryptographically bound Ed25519 spend authorizations with mathematical caps for
            autonomous AI agents.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setIssuedCredentials(null);
            setIsModalOpen(true);
          }}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition"
        >
          <Plus className="h-4 w-4" />
          Issue New Mandate
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
            <span>Active Mandates</span>
            <Shield className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{activeCount}</p>
          <p className="text-xs text-slate-400 mt-1">Total registered: {mandates.length}</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
            <span>Cryptographic Security</span>
            <Key className="h-4 w-4 text-blue-500" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">Ed25519</p>
          <p className="text-xs text-slate-400 mt-1">Zero-knowledge detached spend signatures</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
            <span>Replay Defense</span>
            <ShieldAlert className="h-4 w-4 text-purple-500" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">300s + Nonce</p>
          <p className="text-xs text-slate-400 mt-1">Database-level idempotency shield</p>
        </div>
      </div>

      {/* Mandates List */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-200 bg-slate-50/50 px-6 py-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-800">Provisioned Agent Mandates</h2>
          <button
            type="button"
            onClick={fetchMandates}
            title="Refresh mandates"
            className="text-slate-400 hover:text-slate-600 transition"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {loading && mandates.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-400">Loading policies...</div>
        ) : mandates.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-500">
            No mandates configured. Click &quot;Issue New Mandate&quot; to begin.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {mandates.map((m) => {
              const isRevoked = m.status === "REVOKED";
              const shortPub = `${m.publicKey.substring(0, 10)}...${m.publicKey.substring(m.publicKey.length - 8)}`;

              return (
                <div
                  key={m.id}
                  className={`p-6 transition-colors ${
                    isRevoked ? "bg-slate-50/60 opacity-75" : "hover:bg-slate-50/40"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                        <h3 className="text-base font-semibold text-slate-900">{m.agentName}</h3>
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            m.status === "ACTIVE"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : m.status === "REVOKED"
                                ? "bg-rose-50 text-rose-700 border border-rose-200"
                                : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {m.status}
                        </span>
                      </div>
                      <p className="text-xs font-mono text-slate-400">ID: {m.id}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      {!isRevoked && (
                        <button
                          type="button"
                          onClick={() => handleRevokeMandate(m.id)}
                          className="rounded-md border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition"
                        >
                          Revoke Mandate
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Limit Grid */}
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-4 gap-4 rounded-lg bg-slate-50 p-4 border border-slate-100">
                    <div>
                      <span className="text-[11px] font-semibold text-slate-400 uppercase">
                        Per-Transaction Cap
                      </span>
                      <p className="text-sm font-bold text-slate-800 mt-0.5">
                        {formatCurrency(m.maxAmountPerTransaction)}
                      </p>
                    </div>

                    <div>
                      <span className="text-[11px] font-semibold text-slate-400 uppercase">
                        Daily Spend Cap
                      </span>
                      <p className="text-sm font-bold text-slate-800 mt-0.5">
                        {m.dailyLimitPaise ? formatCurrency(m.dailyLimitPaise) : "Uncapped"}
                      </p>
                    </div>

                    <div>
                      <span className="text-[11px] font-semibold text-slate-400 uppercase">
                        Lifetime Spend Cap
                      </span>
                      <p className="text-sm font-bold text-slate-800 mt-0.5">
                        {m.lifetimeLimitPaise ? formatCurrency(m.lifetimeLimitPaise) : "Uncapped"}
                      </p>
                    </div>

                    <div>
                      <span className="text-[11px] font-semibold text-slate-400 uppercase">
                        Resilience Policy
                      </span>
                      <p className="text-sm font-bold text-slate-800 mt-0.5">
                        {m.maxSilentRetries} retries @ {m.retryDelaySeconds}s
                      </p>
                    </div>
                  </div>

                  {/* Categories & Keys */}
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-slate-400">Categories:</span>
                      {m.allowedCategories.map((cat) => (
                        <span
                          key={cat}
                          className="rounded bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 border border-blue-100"
                        >
                          {cat}
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center gap-2 font-mono text-[11px] text-slate-500">
                      <span>Public Key:</span>
                      <span className="bg-white px-1.5 py-0.5 rounded border border-slate-200">
                        {shortPub}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopy(m.publicKey, m.id)}
                        className="text-slate-400 hover:text-slate-700"
                        title="Copy Public Key"
                      >
                        {copiedKey === m.id ? (
                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Issue Mandate Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-xl rounded-xl bg-white p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Key className="h-5 w-5 text-blue-600" />
                {issuedCredentials ? "Mandate Issued Successfully" : "Issue Cryptographic Mandate"}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {actionError && (
              <div className="mt-4 rounded-lg bg-rose-50 p-3 text-xs text-rose-700 border border-rose-200 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {actionError}
              </div>
            )}

            {issuedCredentials ? (
              <div className="mt-4 space-y-4">
                <div className="rounded-lg bg-emerald-50 p-4 border border-emerald-200 text-xs text-emerald-800">
                  <p className="font-semibold text-sm">
                    Policy is live & anchored in audit genesis.
                  </p>
                  <p className="mt-1">
                    Store the secret key below securely in your agent environment (e.g., in{" "}
                    <code>agent.key</code> or an environment secret). It will never be displayed
                    again.
                  </p>
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="mandate-id-input"
                    className="text-xs font-semibold text-slate-500"
                  >
                    Mandate ID
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id="mandate-id-input"
                      type="text"
                      readOnly
                      value={newMandateId || ""}
                      className="w-full rounded border border-slate-200 bg-slate-50 p-2 font-mono text-xs text-slate-800"
                    />
                    <button
                      type="button"
                      onClick={() => handleCopy(newMandateId || "", "mandate-id")}
                      className="rounded border border-slate-200 p-2 hover:bg-slate-100"
                    >
                      {copiedKey === "mandate-id" ? (
                        <Check className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <Copy className="h-4 w-4 text-slate-500" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="secret-key-input"
                    className="text-xs font-semibold text-slate-500"
                  >
                    Agent Ed25519 Secret Key (Private)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id="secret-key-input"
                      type="text"
                      readOnly
                      value={issuedCredentials.secretKey}
                      className="w-full rounded border border-slate-200 bg-amber-50 p-2 font-mono text-xs text-amber-950 font-bold"
                    />
                    <button
                      type="button"
                      onClick={() => handleCopy(issuedCredentials.secretKey, "secret-key")}
                      className="rounded border border-slate-200 p-2 hover:bg-slate-100"
                    >
                      {copiedKey === "secret-key" ? (
                        <Check className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <Copy className="h-4 w-4 text-slate-500" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="rounded-lg bg-slate-900 p-3 text-[11px] font-mono text-slate-200">
                  <p className="text-slate-400">{/* Quick SDK Usage */}</p>
                  <p className="mt-1 text-blue-300">
                    import &#123; MandateOSClient &#125; from &quot;@/lib/sdk&quot;;
                  </p>
                  <p className="text-emerald-300">const client = new MandateOSClient(&#123;</p>
                  <p className="pl-4 text-slate-300">mandateId: &quot;{newMandateId}&quot;,</p>
                  <p className="pl-4 text-slate-300">
                    secretKey: &quot;{issuedCredentials.secretKey.slice(0, 16)}
                    ...&quot;,
                  </p>
                  <p className="text-emerald-300">&#125;);</p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="w-full rounded-lg bg-slate-900 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleCreateMandate} className="mt-4 space-y-4">
                <div>
                  <label
                    htmlFor="agent-name-input"
                    className="block text-xs font-semibold text-slate-600"
                  >
                    Agent Name
                  </label>
                  <input
                    id="agent-name-input"
                    type="text"
                    required
                    placeholder="e.g. Infrastructure Auto-Scaler"
                    value={formData.agentName}
                    onChange={(e) => setFormData({ ...formData, agentName: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label
                      htmlFor="per-txn-cap-input"
                      className="block text-xs font-semibold text-slate-600"
                    >
                      Per-Txn Cap (₹)
                    </label>
                    <input
                      id="per-txn-cap-input"
                      type="number"
                      required
                      min="1"
                      value={formData.maxAmountRupees}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          maxAmountRupees: e.target.value,
                        })
                      }
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="daily-cap-input"
                      className="block text-xs font-semibold text-slate-600"
                    >
                      Daily Cap (₹)
                    </label>
                    <input
                      id="daily-cap-input"
                      type="number"
                      min="1"
                      placeholder="Optional"
                      value={formData.dailyLimitRupees}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          dailyLimitRupees: e.target.value,
                        })
                      }
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="lifetime-cap-input"
                      className="block text-xs font-semibold text-slate-600"
                    >
                      Lifetime Cap (₹)
                    </label>
                    <input
                      id="lifetime-cap-input"
                      type="number"
                      min="1"
                      placeholder="Optional"
                      value={formData.lifetimeLimitRupees}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          lifetimeLimitRupees: e.target.value,
                        })
                      }
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="allowed-categories-input"
                    className="block text-xs font-semibold text-slate-600"
                  >
                    Allowed Categories (comma separated)
                  </label>
                  <input
                    id="allowed-categories-input"
                    type="text"
                    required
                    value={formData.allowedCategories}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        allowedCategories: e.target.value,
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="silent-retries-input"
                      className="block text-xs font-semibold text-slate-600"
                    >
                      Max Silent Retries
                    </label>
                    <input
                      id="silent-retries-input"
                      type="number"
                      min="0"
                      max="5"
                      value={formData.maxSilentRetries}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          maxSilentRetries: Number(e.target.value),
                        })
                      }
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="retry-delay-input"
                      className="block text-xs font-semibold text-slate-600"
                    >
                      Retry Delay (Seconds)
                    </label>
                    <input
                      id="retry-delay-input"
                      type="number"
                      min="5"
                      max="300"
                      value={formData.retryDelaySeconds}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          retryDelaySeconds: Number(e.target.value),
                        })
                      }
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="notify-url-input"
                    className="block text-xs font-semibold text-slate-600"
                  >
                    Outbound Alert Webhook (Optional)
                  </label>
                  <input
                    id="notify-url-input"
                    type="url"
                    placeholder="https://your-ops.com/api/mandate-alerts"
                    value={formData.notifyUrl}
                    onChange={(e) => setFormData({ ...formData, notifyUrl: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 transition disabled:opacity-50"
                  >
                    {creating ? "Generating Keypair..." : "Issue Mandate"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
