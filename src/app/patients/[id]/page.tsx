import { prisma } from "@/lib/prisma";
import { getCurrentTenantId } from "@/lib/tenant";
import { formatDate, daysUntil } from "@/lib/dates";
import { Badge, priorityTone, statusTone } from "@/components/Badge";
import { completeTask } from "@/lib/actions";
import { PatientPlans } from "@/components/PatientPlans";
import { notFound } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function PatientDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tenantId = await getCurrentTenantId();

  const [patient, actionResults, serviceSettings] = await Promise.all([
    prisma.patient.findFirst({
      where: { id, tenantId },
      include: {
        records: {
          include: { tasks: { orderBy: [{ stepNumber: "asc" }] } },
          orderBy: { eventDate: "desc" },
        },
        plans: {
          include: { items: { orderBy: [{ targetDate: "asc" }, { sortOrder: "asc" }] } },
          orderBy: { createdAt: "desc" },
        },
      },
    }),
    prisma.setting.findMany({
      where: { tenantId, type: "ActionResult", active: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.setting.findMany({
      where: { tenantId, type: "Service", active: true },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  if (!patient) notFound();
  const services = serviceSettings.map((s) => s.value);

  const allTasks = patient.records.flatMap((r) => r.tasks);
  const openCount = allTasks.filter((t) => t.status !== "Completed").length;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/patients" className="text-xs text-muted hover:text-ink">
          ← All patients
        </Link>
        <h1 className="mt-1 text-2xl font-semibold text-ink">{patient.name}</h1>
        <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted">
          <span>Lifetime treatments: {patient.records.length}</span>
          <span>Open follow-ups: {openCount}</span>
          {patient.phone && <span>{patient.phone}</span>}
          {patient.email && <span>{patient.email}</span>}
        </div>
      </div>

      <PatientPlans plans={patient.plans} patientId={patient.id} services={services} />

      <h2 className="pt-2 text-sm font-semibold text-ink">Treatment History</h2>
      {patient.records.length === 0 ? (
        <div className="card p-10 text-center text-sm text-muted">
          No treatments recorded yet.
        </div>
      ) : (
        <div className="space-y-5">
          {patient.records.map((r) => (
            <section key={r.id} className="card p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold text-ink">{r.service}</h2>
                    <Badge tone={statusTone(r.status)}>{r.status}</Badge>
                  </div>
                  <div className="mt-1 text-xs text-muted">
                    {r.patientEvent} · {formatDate(r.eventDate)}
                    {r.provider && <span> · {r.provider}</span>}
                  </div>
                </div>
                <span className="font-mono text-xs text-muted">{r.code}</span>
              </div>

              {r.notes && (
                <p className="mt-3 rounded-lg bg-canvas px-3 py-2 text-sm text-ink">
                  {r.notes}
                </p>
              )}

              <div className="mt-4 space-y-2">
                {r.tasks.map((t) => {
                  const d = daysUntil(t.dueDate);
                  const done = t.status === "Completed";
                  return (
                    <div
                      key={t.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line/70 px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                            done ? "bg-success text-white" : "border border-line text-muted"
                          }`}
                        >
                          {done ? "✓" : t.stepNumber}
                        </span>
                        <span className={done ? "text-muted line-through" : "text-ink"}>
                          {t.workflowStep}
                        </span>
                        <Badge tone={priorityTone(t.priority)}>{t.priority}</Badge>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-muted">
                        {done ? (
                          <span>
                            {t.actionResult ? `${t.actionResult} · ` : ""}
                            {formatDate(t.completedDate)}
                          </span>
                        ) : (
                          <>
                            <span className={d !== null && d < 0 ? "text-danger" : ""}>
                              Due {formatDate(t.dueDate)}
                            </span>
                            <form action={completeTask} className="flex items-center gap-1.5">
                              <input type="hidden" name="taskId" value={t.id} />
                              <select
                                name="actionResult"
                                className="input w-auto py-1 text-xs"
                                defaultValue=""
                              >
                                <option value="">Result…</option>
                                {actionResults.map((a) => (
                                  <option key={a.id} value={a.value}>
                                    {a.value}
                                  </option>
                                ))}
                              </select>
                              <button className="btn-primary py-1 text-xs">Done</button>
                            </form>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
