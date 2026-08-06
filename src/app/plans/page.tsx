import { prisma } from "@/lib/prisma";
import { getCurrentTenantId } from "@/lib/tenant";
import { todayStart, addDays, formatDate, daysUntil } from "@/lib/dates";
import { money, REMINDER_WINDOW_DAYS } from "@/lib/plans";
import { setPlanItemStatus, uploadAuraPlan } from "@/lib/planActions";
import Link from "next/link";

export const dynamic = "force-dynamic";

function Kpi({ label, value, tone = "ink" }: { label: string; value: string; tone?: "ink" | "warning" | "success" }) {
  const color = tone === "warning" ? "text-warning" : tone === "success" ? "text-success" : "text-ink";
  return (
    <div className="card p-5">
      <div className="text-xs font-medium uppercase tracking-wide text-muted">{label}</div>
      <div className={`mt-2 text-2xl font-semibold ${color}`}>{value}</div>
    </div>
  );
}

export default async function PlansPage() {
  const tenantId = await getCurrentTenantId();
  const today = todayStart();
  const horizon = addDays(today, REMINDER_WINDOW_DAYS);

  const [dueItems, allRecommended, patients] = await Promise.all([
    prisma.treatmentPlanItem.findMany({
      where: { tenantId, status: "Recommended", targetDate: { lte: horizon } },
      include: { plan: { include: { patient: true } } },
      orderBy: { targetDate: "asc" },
    }),
    prisma.treatmentPlanItem.findMany({
      where: { tenantId, status: "Recommended" },
      select: { price: true },
    }),
    prisma.patient.findMany({
      where: { tenantId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const unscheduledValue = allRecommended.reduce((s, i) => s + (i.price ?? 0), 0);
  const dueValue = dueItems.reduce((s, i) => s + (i.price ?? 0), 0);
  const overdue = dueItems.filter((i) => i.targetDate && daysUntil(i.targetDate)! < 0).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Aura Plans — To Book</h1>
        <p className="mt-1 text-sm text-muted">
          Recommended treatments coming due that aren&apos;t scheduled yet. Reach
          out, book them, then mark them scheduled to clear them from this list.
        </p>
      </div>

      {/* Upload an Aura scan straight from here — pick the patient, drop the PDF,
          and it auto-builds their plan (then opens their page to review). */}
      <div className="card border-dashed p-4">
        <form action={uploadAuraPlan} className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1">
            <label className="label">Patient</label>
            <select name="patientId" required defaultValue="" className="input py-2 text-sm">
              <option value="" disabled>
                Choose a patient…
              </option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[220px] flex-1">
            <label className="label">Aura scan (PDF)</label>
            <input
              type="file"
              name="file"
              accept="application/pdf,.pdf"
              required
              className="block text-sm"
            />
          </div>
          <button className="btn-accent">Upload &amp; build plan</button>
        </form>
        <p className="mt-2 text-xs text-muted">
          We&apos;ll save the file and auto-build the plan from it — then open the
          patient so you can review. To build one from a patient&apos;s page instead,{" "}
          <Link href="/patients" className="text-accent hover:underline">
            go to Patients →
          </Link>
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Kpi label="Unscheduled Plan Value" value={money(unscheduledValue)} tone="success" />
        <Kpi label="Due to Book (next 3 wks)" value={String(dueItems.length)} tone={dueItems.length ? "warning" : "ink"} />
        <Kpi label="Overdue" value={String(overdue)} tone={overdue ? "warning" : "ink"} />
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-canvas/50 text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-3 font-medium">Target</th>
                <th className="px-4 py-3 font-medium">Patient</th>
                <th className="px-4 py-3 font-medium">Treatment</th>
                <th className="px-4 py-3 font-medium">Price</th>
                <th className="px-4 py-3 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {dueItems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-muted">
                    Nothing to book right now. ✓
                  </td>
                </tr>
              ) : (
                dueItems.map((it) => {
                  const d = daysUntil(it.targetDate);
                  const late = d !== null && d < 0;
                  return (
                    <tr key={it.id} className="border-b border-line/60 hover:bg-canvas/40">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={late ? "font-medium text-danger" : "text-ink"}>
                          {formatDate(it.targetDate)}
                        </span>
                        {late && <span className="ml-1 text-xs text-danger">({Math.abs(d!)}d late)</span>}
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/patients/${it.plan.patientId}`} className="font-medium text-ink hover:underline">
                          {it.plan.patient.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        {it.treatment}
                        {it.category && <span className="ml-1 text-xs text-muted">· {it.category}</span>}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-muted">{money(it.price)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-3">
                          <form action={setPlanItemStatus}>
                            <input type="hidden" name="itemId" value={it.id} />
                            <input type="hidden" name="patientId" value={it.plan.patientId} />
                            <input type="hidden" name="status" value="Scheduled" />
                            <button className="btn-primary py-1 text-xs">Booked ✓</button>
                          </form>
                          <Link href={`/patients/${it.plan.patientId}`} className="text-xs text-accent hover:underline">
                            Open →
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
