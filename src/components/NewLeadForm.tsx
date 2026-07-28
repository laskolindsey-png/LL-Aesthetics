"use client";

import { useState } from "react";
import { createLead } from "@/lib/leadActions";

type Option = { id: string; value: string };

export function NewLeadForm({
  sources,
  assignees,
}: {
  sources: Option[];
  assignees: Option[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-ink">New Lead</h2>
          <p className="text-xs text-muted">
            Add a prospective patient — the system starts their greeting sequence.
          </p>
        </div>
        <button className="btn-accent" onClick={() => setOpen((o) => !o)}>
          {open ? "Close" : "+ New Lead"}
        </button>
      </div>

      {open && (
        <form
          action={async (fd) => {
            setPending(true);
            try {
              await createLead(fd);
              setOpen(false);
            } finally {
              setPending(false);
            }
          }}
          className="mt-5 grid gap-4 md:grid-cols-2"
        >
          <div>
            <label className="label">Name</label>
            <input name="name" className="input" placeholder="Full name" required />
          </div>
          <div>
            <label className="label">How they found us</label>
            <select name="source" className="input" defaultValue="">
              <option value="">Select source…</option>
              {sources.map((s) => (
                <option key={s.id} value={s.value}>
                  {s.value}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Phone</label>
            <input name="phone" className="input" placeholder="(optional)" />
          </div>
          <div>
            <label className="label">Email</label>
            <input name="email" type="email" className="input" placeholder="(optional)" />
          </div>
          <div>
            <label className="label">Assigned to</label>
            <select name="assignedTo" className="input" defaultValue="Front Desk">
              <option value="">—</option>
              {assignees.map((a) => (
                <option key={a.id} value={a.value}>
                  {a.value}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Notes</label>
            <input name="notes" className="input" placeholder="What are they interested in?" />
          </div>
          <div className="md:col-span-2 flex justify-end">
            <button className="btn-primary" disabled={pending}>
              {pending ? "Adding…" : "Add Lead & Start Follow-ups"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
