"use client";

import { useState } from "react";
import { createEvent } from "@/lib/actions";

type Option = { id: string; value: string };
type PatientOption = { id: string; name: string };

export function NewEventForm({
  patients,
  patientEvents,
  services,
  providers,
  todayInput,
}: {
  patients: PatientOption[];
  patientEvents: Option[];
  services: Option[];
  providers: Option[];
  todayInput: string;
}) {
  const [open, setOpen] = useState(false);
  const [newPatient, setNewPatient] = useState(patients.length === 0);
  const [pending, setPending] = useState(false);

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-ink">New Treatment Entry</h2>
          <p className="text-xs text-muted">
            Record an event — the system schedules every follow-up automatically.
          </p>
        </div>
        <button className="btn-accent" onClick={() => setOpen((o) => !o)}>
          {open ? "Close" : "+ New Entry"}
        </button>
      </div>

      {open && (
        <form
          action={async (fd) => {
            setPending(true);
            try {
              await createEvent(fd);
              setOpen(false);
            } finally {
              setPending(false);
            }
          }}
          className="mt-5 grid gap-4 md:grid-cols-2"
        >
          <div className="md:col-span-2">
            <div className="mb-2 flex items-center gap-4 text-xs">
              <label className="flex items-center gap-1.5 text-muted">
                <input
                  type="radio"
                  name="patientMode"
                  checked={!newPatient}
                  onChange={() => setNewPatient(false)}
                  disabled={patients.length === 0}
                />
                Existing patient
              </label>
              <label className="flex items-center gap-1.5 text-muted">
                <input
                  type="radio"
                  name="patientMode"
                  checked={newPatient}
                  onChange={() => setNewPatient(true)}
                />
                New patient
              </label>
            </div>
            {newPatient ? (
              <>
                <label className="label">New Patient Name</label>
                <input name="patientName" className="input" placeholder="Full name" required />
              </>
            ) : (
              <>
                <label className="label">Patient</label>
                <select name="patientId" className="input" required>
                  <option value="">Select patient…</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </>
            )}
          </div>

          <div>
            <label className="label">Patient Event</label>
            <select name="patientEvent" className="input" required defaultValue="Treatment Completed">
              {patientEvents.map((e) => (
                <option key={e.id} value={e.value}>
                  {e.value}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Service</label>
            <select name="service" className="input" required defaultValue="Botox">
              {services.map((s) => (
                <option key={s.id} value={s.value}>
                  {s.value}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Provider</label>
            <select name="provider" className="input" defaultValue="">
              <option value="">—</option>
              {providers.map((p) => (
                <option key={p.id} value={p.value}>
                  {p.value}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Event Date</label>
            <input type="date" name="eventDate" className="input" defaultValue={todayInput} required />
          </div>

          <div className="md:col-span-2">
            <label className="label">Notes (optional)</label>
            <input name="notes" className="input" placeholder="Anything worth remembering" />
          </div>

          <div className="md:col-span-2 flex justify-end">
            <button className="btn-primary" disabled={pending}>
              {pending ? "Scheduling…" : "Create & Schedule Follow-ups"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
