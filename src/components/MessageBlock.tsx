"use client";

import { useState } from "react";

/** Shows a drafted message with a one-click copy button (for pasting into your
 *  texting tool). Compact by default; this is the "review before you send" view. */
export function MessageBlock({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-2 rounded-lg border border-line bg-canvas/40 p-3">
      <div className="flex items-start justify-between gap-3">
        <p className="whitespace-pre-wrap text-sm text-ink">{text}</p>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            } catch {
              setCopied(false);
            }
          }}
          className="shrink-0 rounded-lg border border-line px-2.5 py-1 text-xs font-medium text-muted hover:bg-card hover:text-ink"
        >
          {copied ? "Copied ✓" : "Copy"}
        </button>
      </div>
    </div>
  );
}
