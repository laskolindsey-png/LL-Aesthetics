"use client";

import { useState } from "react";
import { createToxPatient } from "@/lib/toxActions";

export function NewToxPatientForm() {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-ink">Add Botox Patient</h2>
          <p className="text-xs text-muted">
            Start tracking a patient. You set their color at the results check.
          </p>
        </div>
        <button className="btn-accent" onClick={() => setOpen((o) => !o)}>
          {open ? "Close" : "+ Add Patient"}
        </button>
      </div>

      {open && (
        <form
          action={async (fd) => {
            setPending(true);
            try {
              await createToxPatient(fd);
              setOpen(false);
            } finally {
              setPending(false);
            }
          }}
          className="mt-5 grid gap-4 md:grid-cols-2"
        >
          <div>
            <label className="label">Patient name</label>
            <input name="name" className="input" placeholder="Full name" required />
          </div>
          <div>
            <label className="label">Contact #</label>
            <input name="phone" className="input" placeholder="(optional)" />
          </div>
          <div>
            <label className="label">Initial treatment</label>
            <input
              name="initialTreatment"
              className="input"
              placeholder="e.g. Botox, Club member"
            />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" name="isClubMember" className="h-4 w-4" />
              Club member
            </label>
          </div>
          <div className="md:col-span-2">
            <label className="label">Notes</label>
            <input name="notes" className="input" placeholder="Standing notes about this patient (optional)" />
          </div>
          <div className="md:col-span-2 flex justify-end">
            <button className="btn-primary" disabled={pending}>
              {pending ? "Adding…" : "Add Patient"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
