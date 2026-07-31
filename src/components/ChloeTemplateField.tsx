"use client";

import { useState } from "react";
import { generateChloeTemplate } from "@/lib/chloeActions";

/** The message-library textarea, plus a "write this in Chloe's voice" button.
 *  Chloe fills the box (keeping the merge tags); the front desk reviews and Saves. */
export function ChloeTemplateField({
  templateId,
  name,
  defaultValue,
  placeholder,
}: {
  templateId: string;
  name: string;
  defaultValue: string;
  placeholder?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const res = await generateChloeTemplate(templateId);
      if (res.ok) setValue(res.message ?? "");
      else setError(res.error ?? "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-3">
      <textarea
        name={name}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={4}
        className="input text-sm"
        placeholder={placeholder}
      />
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={run}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent/10 px-2.5 py-1 text-xs font-medium text-ink hover:bg-accent/20 disabled:opacity-60"
        >
          {loading ? "Chloe is writing…" : "✨ Write in Chloe's voice"}
        </button>
        <span className="text-[10px] text-muted">then review &amp; Save</span>
      </div>
      {error && (
        <div className="mt-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-ink">
          {error}
        </div>
      )}
    </div>
  );
}
