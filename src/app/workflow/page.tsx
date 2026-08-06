import { prisma } from "@/lib/prisma";
import { getCurrentTenantId } from "@/lib/tenant";
import { toDateInput, todayStart, formatDate } from "@/lib/dates";
import { Badge, statusTone } from "@/components/Badge";
import { NewEventForm } from "@/components/NewEventForm";
import { deleteWorkflowRecord } from "@/lib/actions";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function WorkflowPage() {
  const tenantId = await getCurrentTenantId();

  const [patients, patientEvents, services, providers, records] = await Promise.all([
    prisma.patient.findMany({ where: { tenantId }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.setting.findMany({ where: { tenantId, type: "PatientEvent", active: true }, orderBy: { sortOrder: "asc" } }),
    prisma.setting.findMany({ where: { tenantId, type: "Service", active: true }, orderBy: { sortOrder: "asc" } }),
    prisma.setting.findMany({ where: { tenantId, type: "Provider", active: true }, orderBy: { sortOrder: "asc" } }),
    prisma.workflowRecord.findMany({
      where: { tenantId },
      include: {
        patient: true,
        tasks: { orderBy: { dueDate: "asc" } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Patient Workflow</h1>
        <p className="mt-1 text-sm text-muted">
          Every treatment and event, with its follow-up sequence tracked to completion.
        </p>
      </div>

      <NewEventForm
        patients={patients}
        patientEvents={patientEvents}
        services={services}
        providers={providers}
        todayInput={toDateInput(todayStart())}
      />

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-canvas/50 text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-3 font-medium">Patient</th>
                <th className="px-4 py-3 font-medium">Event</th>
                <th className="px-4 py-3 font-medium">Service</th>
                <th className="px-4 py-3 font-medium">Event Date</th>
                <th className="px-4 py-3 font-medium">Next Follow-Up</th>
                <th className="px-4 py-3 font-medium">Progress</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {records.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-muted">
                    No records yet. Add your first treatment above.
                  </td>
                </tr>
              ) : (
                records.map((r) => {
                  const done = r.tasks.filter((t) => t.status === "Completed").length;
                  const total = r.tasks.length;
                  const nextTask = r.tasks.find((t) => t.status !== "Completed");
                  return (
                    <tr key={r.id} className="border-b border-line/60 hover:bg-canvas/40">
                      <td className="px-4 py-3">
                        <Link href={`/patients/${r.patientId}`} className="font-medium text-ink hover:underline">
                          {r.patient.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-muted">{r.patientEvent}</td>
                      <td className="px-4 py-3">{r.service}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{formatDate(r.eventDate)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {nextTask ? (
                          <span>
                            {nextTask.workflowStep}
                            <span className="ml-1 text-xs text-muted">
                              · {formatDate(nextTask.dueDate)}
                            </span>
                          </span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-muted">
                        {done}/{total} steps
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={statusTone(r.status)}>{r.status}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <form action={deleteWorkflowRecord}>
                          <input type="hidden" name="recordId" value={r.id} />
                          <button className="text-xs text-danger hover:underline">
                            Delete
                          </button>
                        </form>
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
