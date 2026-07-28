"use client";

import { useState } from "react";
import { createPeptideOrder } from "@/lib/peptideActions";

type Option = { id: string; value: string };

export function NewPeptideOrderForm({
  products,
  todayInput,
}: {
  products: Option[];
  todayInput: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-ink">New Peptide Order</h2>
          <p className="text-xs text-muted">Enter it here — it flows to your director to fill.</p>
        </div>
        <button className="btn-accent" onClick={() => setOpen((o) => !o)}>
          {open ? "Close" : "+ New Order"}
        </button>
      </div>

      {open && (
        <form
          action={async (fd) => {
            setPending(true);
            try {
              await createPeptideOrder(fd);
              setOpen(false);
            } finally {
              setPending(false);
            }
          }}
          className="mt-5 grid gap-4 md:grid-cols-4"
        >
          <div className="md:col-span-2">
            <label className="label">Patient name</label>
            <input name="patientName" className="input" required />
          </div>
          <div>
            <label className="label">Date of birth</label>
            <input name="dob" className="input" placeholder="mm/dd/yyyy" />
          </div>
          <div>
            <label className="label">Phone</label>
            <input name="phone" className="input" />
          </div>

          <div className="md:col-span-2">
            <label className="label">Peptide / product</label>
            <input name="product" className="input" list="peptide-products" placeholder="e.g. Tirzepatide 15mg (1ml)" required />
            <datalist id="peptide-products">
              {products.map((p) => (
                <option key={p.id} value={p.value} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="label">Order amount</label>
            <input name="amount" type="number" step="0.01" className="input" placeholder="$" />
          </div>
          <div>
            <label className="label">Order type</label>
            <select name="orderType" className="input" defaultValue="New">
              <option>New</option>
              <option>Reorder</option>
              <option>Replacement</option>
            </select>
          </div>

          <div className="md:col-span-4">
            <label className="label">Script &amp; dosing</label>
            <input name="dosing" className="input" placeholder="e.g. 2.5mg per SQ weekly" />
          </div>

          <div>
            <label className="label">Ship to</label>
            <select name="shipTo" className="input" defaultValue="Patient">
              <option>Patient</option>
              <option>LL Aesthetics</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="label">Address</label>
            <input name="address" className="input" placeholder="Street" />
          </div>
          <div>
            <label className="label">Order date</label>
            <input type="date" name="orderDate" className="input" defaultValue={todayInput} />
          </div>
          <div>
            <label className="label">City</label>
            <input name="city" className="input" />
          </div>
          <div>
            <label className="label">State</label>
            <input name="state" className="input" />
          </div>
          <div>
            <label className="label">Zip</label>
            <input name="zip" className="input" />
          </div>
          <div>
            <label className="label">Invoice #</label>
            <input name="invoice" className="input" placeholder="(optional)" />
          </div>
          <div className="md:col-span-3">
            <label className="label">Notes</label>
            <input name="notes" className="input" />
          </div>

          <div className="md:col-span-4 flex justify-end">
            <button className="btn-primary" disabled={pending}>
              {pending ? "Adding…" : "Add Order"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
