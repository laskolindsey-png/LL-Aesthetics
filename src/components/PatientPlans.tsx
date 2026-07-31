import { Badge } from "@/components/Badge";
import { formatDate, toDateInput, todayStart } from "@/lib/dates";
import { money, planItemStatusTone, isDueToBook } from "@/lib/plans";
import { createPlan, addPlanItem, setPlanItemStatus, deletePlanItem, deletePlan, uploadAuraPlan, deletePlanDocument } from "@/lib/planActions";

const STATUSES = ["Recommended", "Scheduled", "Completed", "Declined"] as const;

type Item = {
  id: string;
  category: string | null;
  treatment: string;
  targetDate: Date | null;
  price: number | null;
  status: string;
};
type Plan = {
  id: string;
  label: string;
  source: string | null;
  planDate: Date | null;
  notes: string | null;
  status: string;
  items: Item[];
};

type Doc = {
  id: string;
  fileName: string;
  sizeBytes: number;
  source: string | null;
  createdAt: Date;
};

export function PatientPlans({
  plans,
  patientId,
  services,
  documents = [],
}: {
  plans: Plan[];
  patientId: string;
  services: string[];
  documents?: Doc[];
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink">Aura Plans</h2>
      </div>

      {/* Upload an Aura scan → auto-builds the plan + saves the file */}
      <div className="card border-dashed p-4">
        <form action={uploadAuraPlan} className="flex flex-wrap items-center gap-3">
          <input type="hidden" name="patientId" value={patientId} />
          <div className="flex-1 min-w-[220px]">
            <label className="label">Upload Aura scan (PDF)</label>
            <input type="file" name="file" accept="application/pdf,.pdf" className="block text-sm" required />
            <p className="mt-1 text-xs text-muted">
              We&apos;ll save the file here and auto-build the plan from it — you just review.
            </p>
          </div>
          <button className="btn-accent">Upload &amp; build plan</button>
        </form>

        {documents.length > 0 && (
          <div className="mt-4 space-y-1.5 border-t border-line pt-3">
            <div className="text-xs font-medium uppercase tracking-wide text-muted">Saved scans</div>
            {documents.map((d) => (
              <div key={d.id} className="flex items-center justify-between gap-3 text-sm">
                <a
                  href={`/api/plan-document/${d.id}`}
                  className="text-accent hover:underline"
                >
                  ⬇ {d.fileName}
                </a>
                <div className="flex items-center gap-3 text-xs text-muted">
                  <span>{formatDate(d.createdAt)} · {(d.sizeBytes / 1024 / 1024).toFixed(1)} MB</span>
                  <form action={deletePlanDocument}>
                    <input type="hidden" name="docId" value={d.id} />
                    <input type="hidden" name="patientId" value={patientId} />
                    <button className="text-danger hover:underline">Remove</button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {plans.map((plan) => {
        const total = plan.items.reduce((s, i) => s + (i.price ?? 0), 0);
        const unscheduledValue = plan.items
          .filter((i) => i.status === "Recommended")
          .reduce((s, i) => s + (i.price ?? 0), 0);
        return (
          <div key={plan.id} className="card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-canvas/50 px-4 py-3">
              <div>
                <div className="font-semibold text-ink">{plan.label}</div>
                <div className="text-xs text-muted">
                  {plan.source}
                  {plan.planDate && ` · ${formatDate(plan.planDate)}`} · Plan value {money(total)}
                  {unscheduledValue > 0 && ` · ${money(unscheduledValue)} not yet booked`}
                </div>
              </div>
              <form action={deletePlan}>
                <input type="hidden" name="planId" value={plan.id} />
                <input type="hidden" name="patientId" value={patientId} />
                <button className="text-xs text-danger hover:underline">Delete plan</button>
              </form>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-muted">
                    <th className="px-4 py-2 font-medium">Treatment</th>
                    <th className="px-4 py-2 font-medium">Target</th>
                    <th className="px-4 py-2 font-medium">Price</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                    <th className="px-4 py-2 font-medium">Set</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.items.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-4 text-center text-muted">
                        No treatments on this plan yet — add them below.
                      </td>
                    </tr>
                  ) : (
                    plan.items.map((it) => {
                      const due = isDueToBook(it);
                      return (
                        <tr key={it.id} className="border-t border-line/60">
                          <td className="px-4 py-2">
                            <span className="text-ink">{it.treatment}</span>
                            {it.category && <span className="ml-1 text-xs text-muted">· {it.category}</span>}
                            {due && (
                              <span className="ml-2 rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-medium text-[#9a6f28]">
                                book now
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2 whitespace-nowrap text-muted">{formatDate(it.targetDate)}</td>
                          <td className="px-4 py-2 whitespace-nowrap text-muted">{money(it.price)}</td>
                          <td className="px-4 py-2">
                            <Badge tone={planItemStatusTone(it.status)}>{it.status}</Badge>
                          </td>
                          <td className="px-4 py-2">
                            <div className="flex flex-wrap items-center gap-1">
                              {STATUSES.map((s) => (
                                <form key={s} action={setPlanItemStatus}>
                                  <input type="hidden" name="itemId" value={it.id} />
                                  <input type="hidden" name="patientId" value={patientId} />
                                  <input type="hidden" name="status" value={s} />
                                  <button
                                    className={`rounded border px-1.5 py-0.5 text-[11px] ${
                                      it.status === s
                                        ? "border-ink bg-ink text-white"
                                        : "border-line text-muted hover:bg-canvas hover:text-ink"
                                    }`}
                                  >
                                    {s === "Recommended" ? "Rec" : s === "Scheduled" ? "Sched" : s === "Completed" ? "Done" : "Declined"}
                                  </button>
                                </form>
                              ))}
                              <form action={deletePlanItem}>
                                <input type="hidden" name="itemId" value={it.id} />
                                <input type="hidden" name="patientId" value={patientId} />
                                <button className="ml-1 text-[11px] text-danger hover:underline">✕</button>
                              </form>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Add item */}
            <form action={addPlanItem} className="grid gap-2 border-t border-line bg-canvas/30 p-3 md:grid-cols-5">
              <input type="hidden" name="planId" value={plan.id} />
              <input type="hidden" name="patientId" value={patientId} />
              <input name="treatment" className="input py-1.5 text-sm md:col-span-2" list="plan-services" placeholder="Treatment" required />
              <datalist id="plan-services">
                {services.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
              <input type="date" name="targetDate" className="input py-1.5 text-sm" defaultValue={toDateInput(todayStart())} />
              <input name="price" type="number" step="0.01" className="input py-1.5 text-sm" placeholder="Price" />
              <button className="btn-primary py-1.5 text-xs">+ Add Treatment</button>
            </form>
          </div>
        );
      })}

      {/* Add a new plan */}
      <details className="card p-4">
        <summary className="cursor-pointer text-sm font-medium text-ink">+ Add an Aura Plan</summary>
        <form action={createPlan} className="mt-4 grid gap-3 md:grid-cols-2">
          <input type="hidden" name="patientId" value={patientId} />
          <div>
            <label className="label">Plan name</label>
            <input name="label" className="input" defaultValue="Aura Plan" />
          </div>
          <div>
            <label className="label">Source</label>
            <input name="source" className="input" defaultValue="Aura Scan" />
          </div>
          <div>
            <label className="label">Plan date</label>
            <input type="date" name="planDate" className="input" defaultValue={toDateInput(todayStart())} />
          </div>
          <div>
            <label className="label">Notes</label>
            <input name="notes" className="input" placeholder="(optional)" />
          </div>
          <div className="md:col-span-2 flex justify-end">
            <button className="btn-primary">Create Aura Plan</button>
          </div>
        </form>
      </details>
    </section>
  );
}
