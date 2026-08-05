import { prisma } from "@/lib/prisma";
import { getCurrentTenantId } from "@/lib/tenant";
import { addDays, todayStart, daysUntil, formatDate } from "@/lib/dates";
import { Badge, priorityTone } from "@/components/Badge";
import { completeTask } from "@/lib/actions";
import { renderTemplate } from "@/lib/templates";
import { MessageBlock } from "@/components/MessageBlock";
import { ChloeDraftButton } from "@/components/ChloeDraftButton";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const tenantId = await getCurrentTenantId();
  const horizon = addDays(todayStart(), 1);

  const [tasks, actionResults, templateRows] = await Promise.all([
    prisma.task.findMany({
      where: {
        tenantId,
        status: { notIn: ["Completed", "Cancelled"] },
        // Leads live on the Leads page — keep their greeting/nurture follow-ups
        // out of the daily clinical task list so they don't flood it.
        leadId: null,
        OR: [{ dueDate: { lt: horizon } }, { dueDate: null }],
      },
      include: { record: { include: { patient: true } }, lead: true, peptideOrder: true, toxPatient: true },
      orderBy: [{ dueDate: "asc" }, { priority: "asc" }],
    }),
    prisma.setting.findMany({
      where: { tenantId, type: "ActionResult", active: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.messageTemplate.findMany({ where: { tenantId } }),
  ]);
  const templates = new Map(templateRows.map((t) => [t.key, t]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Today&apos;s Tasks</h1>
        <p className="mt-1 text-sm text-muted">
          Follow-ups, check-ins, and reminders due today or earlier. Work top to
          bottom and mark each one complete.
        </p>
      </div>

      {tasks.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-sm text-muted">
            No tasks due. Everything is up to date. ✓
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map((t) => {
            const d = daysUntil(t.dueDate);
            const late = d !== null && d < 0;
            const who = t.record
              ? t.record.patient.name
              : t.lead?.name ?? t.peptideOrder?.patientName ?? t.toxPatient?.name ?? "—";
            const context = t.record
              ? t.record.service
              : t.lead
                ? `Lead${t.lead.source ? ` · ${t.lead.source}` : ""}`
                : t.peptideOrder
                  ? `Peptide · ${t.peptideOrder.product}`
                  : t.toxPatient
                    ? "Botox · Reactivation"
                    : "";
            const link = t.record
              ? `/patients/${t.record.patientId}`
              : t.lead
                ? `/leads/${t.lead.id}`
                : t.peptideOrder
                  ? `/peptides`
                  : t.toxPatient
                    ? `/tox/${t.toxPatient.id}`
                    : "#";
            const openLabel = t.record
              ? "Open record →"
              : t.lead
                ? "Open lead →"
                : t.peptideOrder
                  ? "Open order →"
                  : t.toxPatient
                    ? "Open patient →"
                    : "Open →";

            // The drafted message for this follow-up, personalized — ready to
            // review and send. Empty until the template has wording (see Messages).
            const tpl = t.automationTemplate ? templates.get(t.automationTemplate) : undefined;
            const serviceForMsg = t.record
              ? t.record.service
              : t.peptideOrder
                ? t.peptideOrder.product
                : t.lead
                  ? "your visit"
                  : "";
            const message =
              tpl && tpl.body?.trim()
                ? renderTemplate(tpl.body, {
                    patient: who,
                    service: serviceForMsg,
                    date: t.record ? formatDate(t.record.eventDate) : "",
                  })
                : null;
            return (
              <div key={t.id} className="card p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-ink">{who}</span>
                      <Badge tone={priorityTone(t.priority)}>{t.priority}</Badge>
                      <span className="text-xs text-muted">{context}</span>
                    </div>
                    <div className="mt-1 text-sm text-ink">{t.workflowStep}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted">
                      <span>
                        Due {formatDate(t.dueDate)}
                        {late && (
                          <span className="ml-1 text-danger">
                            · {Math.abs(d!)}d overdue
                          </span>
                        )}
                        {d === 0 && <span className="ml-1 text-warning">· today</span>}
                      </span>
                      <span>Assigned: {t.assignedTo ?? "—"}</span>
                      {t.automationTemplate && (
                        <span>Template: {t.automationTemplate}</span>
                      )}
                      <Link href={link} className="text-accent hover:underline">
                        {openLabel}
                      </Link>
                    </div>
                  </div>

                  <form
                    action={completeTask}
                    className="flex shrink-0 items-center gap-2"
                  >
                    <input type="hidden" name="taskId" value={t.id} />
                    <select
                      name="actionResult"
                      className="input w-auto py-1.5 text-xs"
                      defaultValue=""
                    >
                      <option value="">Result…</option>
                      {actionResults.map((a) => (
                        <option key={a.id} value={a.value}>
                          {a.value}
                        </option>
                      ))}
                    </select>
                    <button className="btn-primary py-1.5 text-xs">Complete</button>
                  </form>
                </div>

                {message ? (
                  <MessageBlock text={message} />
                ) : t.automationTemplate ? (
                  <div className="mt-2 text-xs text-muted">
                    No message written for “{t.automationTemplate}” yet —{" "}
                    <Link href="/messages" className="text-accent hover:underline">
                      add one in Messages
                    </Link>
                    .
                  </div>
                ) : null}

                <ChloeDraftButton taskId={t.id} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
