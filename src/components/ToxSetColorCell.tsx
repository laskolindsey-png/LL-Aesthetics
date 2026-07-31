"use client";

import { useState } from "react";
import { setToxStatus } from "@/lib/toxActions";
import { TOX_CHECK_STATUSES, TOX_HINT } from "@/lib/toxStatus";

// Short, color-tinted labels for the compact tracker. Keeps the words (no bare
// dots) but small enough that the whole cell stays on one line.
const SHORT: Record<string, string> = {
  happy: "Happy",
  watch: "Tough",
  not_happy: "Not Happy",
};

// Idle tint (subtle color) vs. selected (solid) per status.
const TINT: Record<string, { idle: string; on: string }> = {
  happy: {
    idle: "border-success/40 text-success hover:bg-success/10",
    on: "border-success bg-success text-white",
  },
  watch: {
    idle: "border-warning/50 text-warning hover:bg-warning/10",
    on: "border-warning bg-warning text-white",
  },
  not_happy: {
    idle: "border-danger/40 text-danger hover:bg-danger/10",
    on: "border-danger bg-danger text-white",
  },
};

// Compact "set color" cell for the Tox Tracker table. The color buttons sit on
// a single line; the note field stays hidden behind a "＋ note" toggle so rows
// stay one line tall and more patients fit per screen.
export function ToxSetColorCell({
  id,
  status,
}: {
  id: string;
  status: string;
}) {
  const [showNote, setShowNote] = useState(false);
  return (
    <form action={setToxStatus} className="flex items-center gap-1">
      <input type="hidden" name="id" value={id} />
      {TOX_CHECK_STATUSES.map((s) => {
        const on = status === s;
        return (
          <button
            key={s}
            name="status"
            value={s}
            title={TOX_HINT[s]}
            className={`rounded border px-1.5 py-0.5 text-[11px] font-medium leading-none ${
              on ? TINT[s].on : TINT[s].idle
            }`}
          >
            {SHORT[s]}
          </button>
        );
      })}
      <button
        type="button"
        onClick={() => setShowNote((v) => !v)}
        title="Add a note with this check"
        className={`rounded border px-1.5 py-0.5 text-[11px] leading-none ${
          showNote
            ? "border-accent bg-accent/10 text-ink"
            : "border-line text-muted hover:bg-canvas hover:text-ink"
        }`}
      >
        ＋ note
      </button>
      {showNote && (
        <input
          name="note"
          autoFocus
          placeholder="note…"
          className="input w-32 py-0.5 text-[11px]"
        />
      )}
    </form>
  );
}
