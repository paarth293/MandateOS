"use client";

import { AlertOctagon, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useState } from "react";
import { publishAnchorsNow, revokeAllMandates } from "./actions";

interface DangerZoneProps {
  canManage: boolean;
}

type Feedback = { kind: "ok" | "err"; text: string } | null;

export default function DangerZone({ canManage }: DangerZoneProps) {
  const [busy, setBusy] = useState<"revoke" | "anchor" | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const runAction = async (
    kind: "revoke" | "anchor",
    confirmText: string,
    action: () => Promise<{ ok: boolean; message: string }>,
  ) => {
    if (!window.confirm(confirmText)) return;
    setBusy(kind);
    setFeedback(null);
    try {
      const result = await action();
      setFeedback({ kind: result.ok ? "ok" : "err", text: result.message });
    } catch (err) {
      setFeedback({
        kind: "err",
        text: err instanceof Error ? err.message : "Action failed. Check your permissions.",
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="rounded-xl border border-rose-200 bg-white shadow-sm overflow-hidden">
      <div className="border-b border-rose-200 bg-rose-50/50 px-6 py-4">
        <h2 className="text-base font-semibold text-rose-800 flex items-center gap-2">
          <AlertOctagon className="h-5 w-5 text-rose-600" />
          Danger Zone
        </h2>
      </div>

      <div className="p-6 space-y-4">
        {feedback && (
          <div
            className={`flex items-start gap-2 rounded-lg border p-3 text-xs ${
              feedback.kind === "ok"
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-rose-50 border-rose-200 text-rose-700"
            }`}
          >
            {feedback.kind === "ok" ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
            ) : (
              <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
            )}
            <span>{feedback.text}</span>
          </div>
        )}

        <div>
          <h3 className="text-sm font-medium text-slate-900">Revoke All Mandates</h3>
          <p className="text-xs text-slate-500 mt-1 mb-3">
            Immediately revokes every active agent policy on your account. Each revocation is sealed
            into the audit hash chain.
          </p>
          <button
            type="button"
            onClick={() =>
              runAction(
                "revoke",
                "Revoke ALL active mandates for your account? Agents will be hard-blocked from any further purchases.",
                revokeAllMandates,
              )
            }
            disabled={!canManage || busy !== null}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy === "revoke" ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Revoking...
              </>
            ) : (
              "Revoke All Mandates"
            )}
          </button>
          {!canManage && (
            <p className="text-[11px] text-slate-400 mt-1.5">
              Viewers cannot perform destructive actions.
            </p>
          )}
        </div>

        <div className="pt-4 border-t border-slate-100">
          <h3 className="text-sm font-medium text-slate-900">Force Audit Anchor</h3>
          <p className="text-xs text-slate-500 mt-1 mb-3">
            Manually publish a cryptographic anchor for every mandate whose audit chain has
            advanced.
          </p>
          <button
            type="button"
            onClick={() =>
              runAction(
                "anchor",
                "Publish state anchors for all of your mandates now?",
                publishAnchorsNow,
              )
            }
            disabled={!canManage || busy !== null}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy === "anchor" ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Anchoring...
              </>
            ) : (
              "Publish Anchor Now"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
