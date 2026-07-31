"use client";

import { useState } from "react";
import { generateChloeDraft } from "@/lib/chloeActions";

/** "Draft with Chloe ✨" — asks Chloe's brain to write this follow-up in her
 *  voice, then shows it for review (with a Copy button). */
export function ChloeDraftButton({ taskId }: { taskId: string }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [escalate, setEscalate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const res = await generateChloeDraft(taskId);
      if (res.ok) {
        setMessage(res.message ?? "");
        setEscalate(!!res.escalate);
      } else {
        setError(res.error ?? "Something went wrong.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={run}
        disabled={loading}
        className="inline-flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent/10 px-2.5 py-1 text-xs font-medium text-ink hover:bg-accent/20 disabled:opacity-60"
      >
        {loading ? "Chloe is writing…" : message ? "↻ Redraft with Chloe" : "✨ Draft with Chloe"}
      </button>

      {error && (
        <div className="mt-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-ink">
          {error}
        </div>
      )}

      {message && (
        <div className="mt-2 rounded-lg border border-accent/30 bg-blush/15 p-3">
          {escalate && (
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-danger">
              ⚠ Chloe flagged this to escalate — a team member should reply personally
            </div>
          )}
          <div className="flex items-start justify-between gap-3">
            <p className="whitespace-pre-wrap text-sm text-ink">
              <span className="mr-1">💬</span>
              {message}
            </p>
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(message);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                } catch {
                  setCopied(false);
                }
              }}
              className="shrink-0 rounded-lg border border-line bg-card px-2.5 py-1 text-xs font-medium text-muted hover:text-ink"
            >
              {copied ? "Copied ✓" : "Copy"}
            </button>
          </div>
          <div className="mt-1.5 text-[10px] uppercase tracking-wide text-muted">Drafted by Chloe · review before sending</div>
        </div>
      )}
    </div>
  );
}
