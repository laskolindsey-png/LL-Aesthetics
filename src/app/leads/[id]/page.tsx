import { prisma } from "@/lib/prisma";
import { getCurrentTenantId } from "@/lib/tenant";
import { formatDate, daysUntil } from "@/lib/dates";
import { Badge, priorityTone } from "@/components/Badge";
import { completeTask } from "@/lib/actions";
import {
  setLeadStage,
  markLeadBooked,
  markLeadLost,
  deleteLead,
  editLead,
  archiveLead,
  unarchiveLead,
  setContactHold,
  setResponseStatus,
} from "@/lib/leadActions";
import { OPEN_STAGES, stageTone } from "@/lib/leadStage";
import { notFound } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

const LOST_REASONS = [
  "Went elsewhere",
  "Price",
  "No response",
  "Not ready",
  "Too far",
  "Duplicate / Spam",
  "Other",
];

export default async function LeadDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tenantId = await getCurrentTenantId();

  const [lead, actionResults] = await Promise.all([
    prisma.lead.findFirst({
      where: { id, tenantId },
      include: { tasks: { orderBy: { stepNumber: "asc" } } },
    }),
    prisma.setting.findMany({ where: { tenantId, type: "ActionResult", active: true }, orderBy: { sortOrder: "asc" } }),
  ]);
  if (!lead) notFound();

  const closed = lead.stage === "Booked" || lead.stage === "Lost";
  const archived = !!lead.archivedAt;
  const active = !closed && !archived;
  const noResponse = lead.responseStatus === "No response";
  const hasOpenSteps = lead.tasks.some((t) => t.status !== "Completed" && t.status !== "Cancelled");

  return (
    <div className="space-y-6">
      <div>
        <Link href="/leads" className="text-xs text-muted hover:text-ink">
          ← All leads
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold text-ink">{lead.name}</h1>
          <Badge tone={stageTone(lead.stage)}>{lead.stage}</Badge>
          {lead.responseStatus && (
            <Badge tone={lead.responseStatus === "Responded" ? "success" : "warning"}>{lead.responseStatus}</Badge>
          )}
          {archived && <Badge tone="neutral">Archived</Badge>}
        </div>
        <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted">
          {lead.source && <span>Source: {lead.source}</span>}
          {lead.phone && <span>{lead.phone}</span>}
          {lead.email && <span>{lead.email}</span>}
          <span>Added {formatDate(lead.createdAt)}</span>
          {lead.firstContactedAt && <span>First contacted {formatDate(lead.firstContactedAt)}</span>}
          {lead.assignedTo && <span>Assigned: {lead.assignedTo}</span>}
        </div>

        {/* Contact-hold flag — highly visible so nobody reaches out by mistake */}
        {lead.contactHold && (
          <div
            className={`mt-3 rounded-lg px-3 py-2 text-sm font-medium ${
              lead.contactHold === "Do Not Contact" ? "bg-danger/15 text-danger" : "bg-warning/15 text-[#9a6f28]"
            }`}
          >
            {lead.contactHold === "Do Not Contact" ? "🚫 Do Not Contact" : "⏸ Outreach On Hold"} — follow-ups are paused.
          </div>
        )}

        {/* Notes — made prominent */}
        {lead.notes && (
          <div className="mt-3 rounded-lg border border-accent/30 bg-blush/40 px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-accent">Notes</div>
            <p className="mt-1 text-base leading-relaxed text-ink">{lead.notes}</p>
          </div>
        )}
      </div>

      {/* Edit details — fix a typo, phone, email, etc. without changing stage or follow-ups */}
      <details className="card p-4">
        <summary className="cursor-pointer text-sm font-semibold text-ink">✏️ Edit lead details</summary>
        <form action={editLead} className="mt-3 grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="leadId" value={lead.id} />
          <label className="text-xs text-muted">
            Name
            <input name="name" defaultValue={lead.name} required className="input mt-1 w-full" />
          </label>
          <label className="text-xs text-muted">
            Phone
            <input name="phone" defaultValue={lead.phone ?? ""} className="input mt-1 w-full" />
          </label>
          <label className="text-xs text-muted">
            Email
            <input name="email" defaultValue={lead.email ?? ""} className="input mt-1 w-full" />
          </label>
          <label className="text-xs text-muted">
            Source
            <input name="source" defaultValue={lead.source ?? ""} className="input mt-1 w-full" />
          </label>
          <label className="text-xs text-muted">
            Assigned to
            <input name="assignedTo" defaultValue={lead.assignedTo ?? ""} className="input mt-1 w-full" />
          </label>
          <label className="text-xs text-muted sm:col-span-2">
            Notes
            <textarea name="notes" defaultValue={lead.notes ?? ""} rows={2} className="input mt-1 w-full" />
          </label>
          <div className="flex justify-end sm:col-span-2">
            <button className="btn-primary py-1.5 text-xs">Save changes</button>
          </div>
        </form>
      </details>

      {/* Archived banner + restore */}
      {archived && (
        <div className="card flex flex-wrap items-center justify-between gap-3 p-4 text-sm text-muted">
          <span>
            This lead is <strong className="text-ink">archived</strong> and hidden from your active list.
          </span>
          <form action={unarchiveLead}>
            <input type="hidden" name="leadId" value={lead.id} />
            <button className="btn-ghost py-1.5 text-xs">Restore</button>
          </form>
        </div>
      )}

      {/* Stage + close controls */}
      {active && (
        <div className="card space-y-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-muted">Stage:</span>
            {OPEN_STAGES.map((s) => (
              <form key={s} action={setLeadStage}>
                <input type="hidden" name="leadId" value={lead.id} />
                <input type="hidden" name="stage" value={s} />
                <button
                  className={`rounded-lg border px-2.5 py-1 text-xs ${
                    lead.stage === s
                      ? "border-ink bg-ink text-white"
                      : "border-line text-muted hover:bg-canvas hover:text-ink"
                  }`}
                >
                  {s}
                </button>
              </form>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <form action={markLeadBooked}>
              <input type="hidden" name="leadId" value={lead.id} />
              <button className="btn-primary py-1.5 text-xs">Mark Booked ✓</button>
            </form>
            <form action={markLeadLost} className="flex items-center gap-1.5">
              <input type="hidden" name="leadId" value={lead.id} />
              <select name="lostReason" defaultValue="" className="input w-auto py-1 text-xs">
                <option value="">Reason (optional)…</option>
                {LOST_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <button className="btn-ghost py-1.5 text-xs">Mark Lost</button>
            </form>
          </div>
        </div>
      )}

      {/* Follow-up management: response + outreach hold */}
      {active && (
        <div className="card space-y-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-muted">Response:</span>
            {["Responded", "No response"].map((v) => (
              <form key={v} action={setResponseStatus}>
                <input type="hidden" name="leadId" value={lead.id} />
                <input type="hidden" name="responseStatus" value={v} />
                <button
                  className={`rounded-lg border px-2.5 py-1 text-xs ${
                    lead.responseStatus === v
                      ? "border-ink bg-ink text-white"
                      : "border-line text-muted hover:bg-canvas hover:text-ink"
                  }`}
                >
                  {v}
                </button>
              </form>
            ))}
            {lead.responseStatus && (
              <form action={setResponseStatus}>
                <input type="hidden" name="leadId" value={lead.id} />
                <input type="hidden" name="responseStatus" value="" />
                <button className="text-xs text-muted hover:text-ink">clear</button>
              </form>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-muted">Outreach:</span>
            {lead.contactHold ? (
              <form action={setContactHold}>
                <input type="hidden" name="leadId" value={lead.id} />
                <input type="hidden" name="contactHold" value="" />
                <button className="btn-ghost py-1.5 text-xs">Resume outreach</button>
              </form>
            ) : (
              <>
                <form action={setContactHold}>
                  <input type="hidden" name="leadId" value={lead.id} />
                  <input type="hidden" name="contactHold" value="On Hold" />
                  <button className="rounded-lg border border-line px-2.5 py-1 text-xs text-muted hover:bg-canvas hover:text-ink">
                    ⏸ On Hold
                  </button>
                </form>
                <form action={setContactHold}>
                  <input type="hidden" name="leadId" value={lead.id} />
                  <input type="hidden" name="contactHold" value="Do Not Contact" />
                  <button className="rounded-lg border border-line px-2.5 py-1 text-xs text-muted hover:bg-canvas hover:text-ink">
                    🚫 Do Not Contact
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      {/* Closed banner */}
      {closed && (
        <div className="card p-4 text-sm text-muted">
          This lead is <strong className="text-ink">{lead.stage}</strong>
          {lead.convertedAt && lead.stage === "Booked" && ` (booked ${formatDate(lead.convertedAt)})`}
          {lead.stage === "Lost" && lead.lostReason && ` · ${lead.lostReason}`}. Its follow-ups have stopped.
        </div>
      )}

      {/* Journey */}
      <section className="card p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-ink">Follow-up Journey</h2>
          {noResponse && hasOpenSteps && (
            <span className="rounded-lg bg-warning/15 px-2 py-1 text-xs font-medium text-[#9a6f28]">
              ⚠ No response yet — consider holding before the next message
            </span>
          )}
        </div>
        {lead.tasks.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">No follow-up steps.</p>
        ) : (
          <div className="space-y-2">
            {lead.tasks.map((t) => {
              const done = t.status === "Completed";
              const cancelled = t.status === "Cancelled";
              const d = daysUntil(t.dueDate);
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
                    <span className={done || cancelled ? "text-muted line-through" : "text-ink"}>
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
                    ) : cancelled ? (
                      <span>Cancelled</span>
                    ) : (
                      <>
                        <span className={d !== null && d < 0 ? "text-danger" : ""}>
                          Due {formatDate(t.dueDate)}
                        </span>
                        <form action={completeTask} className="flex items-center gap-1.5">
                          <input type="hidden" name="taskId" value={t.id} />
                          <select name="actionResult" className="input w-auto py-1 text-xs" defaultValue="">
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
        )}
      </section>

      {/* Bottom actions */}
      <div className="flex justify-end gap-4">
        {!archived && (
          <form action={archiveLead}>
            <input type="hidden" name="leadId" value={lead.id} />
            <button className="text-xs text-muted hover:text-ink hover:underline">Archive this lead</button>
          </form>
        )}
        <form action={deleteLead}>
          <input type="hidden" name="leadId" value={lead.id} />
          <button className="text-xs text-danger hover:underline">Delete this lead</button>
        </form>
      </div>
    </div>
  );
}
