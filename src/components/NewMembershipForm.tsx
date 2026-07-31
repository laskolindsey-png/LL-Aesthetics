"use client";

import { useState } from "react";
import { createMembership } from "@/lib/membershipActions";

export function NewMembershipForm({ todayInput }: { todayInput: string }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-ink">Add Member</h2>
          <p className="text-xs text-muted">Enroll a patient in a membership or club.</p>
        </div>
        <button className="btn-accent" onClick={() => setOpen((o) => !o)}>
          {open ? "Close" : "+ Add Member"}
        </button>
      </div>

      {open && (
        <form
          action={async (fd) => {
            setPending(true);
            try {
              await createMembership(fd);
              setOpen(false);
            } finally {
              setPending(false);
            }
          }}
          className="mt-5 grid gap-4 md:grid-cols-2"
        >
          <div>
            <label className="label">Member name</label>
            <input name="memberName" className="input" placeholder="Full name" required />
          </div>
          <div>
            <label className="label">Phone</label>
            <input name="phone" className="input" placeholder="(optional)" />
          </div>
          <div>
            <label className="label">Membership / tier</label>
            <input name="tier" className="input" placeholder="e.g. Membership, VIP" defaultValue="Membership" />
          </div>
          <div>
            <label className="label">Monthly amount ($)</label>
            <input name="monthlyAmount" type="number" step="0.01" className="input" placeholder="e.g. 99" />
          </div>
          <div>
            <label className="label">Start date</label>
            <input name="startDate" type="date" className="input" defaultValue={todayInput} />
          </div>
          <div>
            <label className="label">Next renewal</label>
            <input name="renewalDate" type="date" className="input" />
          </div>
          <div className="md:col-span-2">
            <label className="label">Notes</label>
            <input name="notes" className="input" placeholder="(optional)" />
          </div>
          <div className="md:col-span-2 flex justify-end">
            <button className="btn-primary" disabled={pending}>
              {pending ? "Adding…" : "Add Member"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
