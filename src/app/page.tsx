import { prisma } from "@/lib/prisma";
import { getCurrentTenantId } from "@/lib/tenant";
import { todayStart, addDays, daysUntil, formatDate } from "@/lib/dates";
import { Badge, priorityTone, statusTone } from "@/components/Badge";
import { money, REMINDER_WINDOW_DAYS } from "@/lib/plans";
import Link from "next/link";

export const dynamic = "force-dynamic";

function Kpi({
  label,
  value,
  tone = "ink",
}: {
  label: string;
  value: number | string;
  tone?: "ink" | "warning" | "danger" | "success";
}) {
  const color =
    tone === "warning"
      ? "text-warning"
      : tone === "danger"
        ? "text-danger"
        : tone === "success"
          ? "text-success"
          : "text-ink";
  return (
    <div className="card p-5">
      <div className="text-xs font-medium uppercase tracking-wide text-muted">
        {label}
      </div>
      <div className={`mt-2 text-3xl font-semibold ${color}`}>{value}</div>
    </div>
  );
}

export default async function Dashboard() {
  const tenantId = await getCurrentTenantId();
  const today = todayStart();
  const tomorrow = addDays(today, 1);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const [openTasks, dueToday, overdue, completedThisMonth, activeWorkflows] =
    await Promise.all([
      prisma.task.findMany({
        where: { tenantId, status: { notIn: ["Completed", "Cancelled"] } },
        include: { record: { include: { patient: true } }, lead: true, peptideOrder: true },
        orderBy: [{ dueDate: "asc" }],
      }),
      prisma.task.count({
        where: { tenantId, status: { notIn: ["Completed", "Cancelled"] }, dueDate: { gte: today, lt: tomorrow } },
      }),
      prisma.task.count({
        where: { tenantId, status: { notIn: ["Completed", "Cancelled"] }, dueDate: { lt: today } },
      }),
      prisma.task.count({
        where: { tenantId, status: "Completed", completedDate: { gte: monthStart } },
      }),
      prisma.workflowRecord.count({ where: { tenantId, status: "In Progress" } }),
    ]);

  // Treatment-plan revenue: recommended (unbooked) items, and those due to book soon.
  const recommendedItems = await prisma.treatmentPlanItem.findMany({
    where: { tenantId, status: "Recommended" },
    select: { price: true, targetDate: true },
  });
  const unscheduledPlanValue = recommendedItems.reduce((s, i) => s + (i.price ?? 0), 0);
  const planItemsToBook = recommendedItems.filter(
    (i) => i.targetDate && i.targetDate <= addDays(today, REMINDER_WINDOW_DAYS)
  ).length;

  // Workload by service (from open tasks). Lead follow-ups group under "Leads".
  const byService = new Map<string, number>();
  for (const t of openTasks) {
    const s = t.record ? t.record.service : t.peptideOrder ? "Peptides" : "Leads";
    byService.set(s, (byService.get(s) ?? 0) + 1);
  }
  const workload = [...byService.entries()].sort((a, b) => b[1] - a[1]);

  const needsAttention = openTasks
    .filter((t) => t.dueDate && daysUntil(t.dueDate)! <= 0)
    .slice(0, 12);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Owner Dashboard</h1>
        <p className="mt-1 text-sm text-muted">
          Follow-up completion, workload, and patient retention at a glance.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Kpi label="Active Workflows" value={activeWorkflows} />
        <Kpi label="Due Today" value={dueToday} tone={dueToday > 0 ? "warning" : "ink"} />
        <Kpi label="Overdue" value={overdue} tone={overdue > 0 ? "danger" : "success"} />
        <Kpi label="Completed This Month" value={completedThisMonth} tone="success" />
      </div>

      {(unscheduledPlanValue > 0 || planItemsToBook > 0) && (
        <Link
          href="/plans"
          className="card block p-5 transition-colors hover:border-accent"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-muted">
                Treatment Plan Revenue
              </div>
              <div className="mt-1 text-2xl font-semibold text-success">
                {money(unscheduledPlanValue)}{" "}
                <span className="text-sm font-normal text-muted">
                  in recommended treatments not yet booked
                </span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-semibold text-warning">{planItemsToBook}</div>
              <div className="text-xs text-muted">due to book now →</div>
            </div>
          </div>
        </Link>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card p-5 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink">Patients Needing Attention</h2>
            <Link href="/tasks" className="text-xs text-muted hover:text-ink">
              View all tasks →
            </Link>
          </div>
          {needsAttention.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">
              Nothing overdue or due today. You&apos;re all caught up. ✓
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                    <th className="py-2 pr-3 font-medium">Due</th>
                    <th className="py-2 pr-3 font-medium">Patient</th>
                    <th className="py-2 pr-3 font-medium">Service</th>
                    <th className="py-2 pr-3 font-medium">Next Step</th>
                    <th className="py-2 pr-3 font-medium">Priority</th>
                  </tr>
                </thead>
                <tbody>
                  {needsAttention.map((t) => {
                    const d = daysUntil(t.dueDate);
                    return (
                      <tr key={t.id} className="border-b border-line/60">
                        <td className="py-2 pr-3 whitespace-nowrap">
                          <span className={d! < 0 ? "text-danger font-medium" : "text-ink"}>
                            {formatDate(t.dueDate)}
                          </span>
                          {d! < 0 && (
                            <span className="ml-1 text-xs text-danger">
                              ({Math.abs(d!)}d late)
                            </span>
                          )}
                        </td>
                        <td className="py-2 pr-3">
                          {t.record ? t.record.patient.name : t.lead?.name ?? t.peptideOrder?.patientName ?? "—"}
                        </td>
                        <td className="py-2 pr-3 text-muted">
                          {t.record ? t.record.service : t.lead ? "Lead" : t.peptideOrder ? "Peptide" : "—"}
                        </td>
                        <td className="py-2 pr-3">{t.workflowStep}</td>
                        <td className="py-2 pr-3">
                          <Badge tone={priorityTone(t.priority)}>{t.priority}</Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card p-5">
          <h2 className="mb-3 text-sm font-semibold text-ink">Active Workload by Service</h2>
          {workload.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">No open follow-ups.</p>
          ) : (
            <ul className="space-y-2">
              {workload.map(([service, count]) => (
                <li key={service} className="flex items-center justify-between text-sm">
                  <span className="text-ink">{service}</span>
                  <Badge tone="neutral">{count}</Badge>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
