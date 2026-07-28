import { prisma } from "@/lib/prisma";
import { getCurrentTenantId } from "@/lib/tenant";
import { formatDate, toDateInput, toDateInput as di, monthsAgo } from "@/lib/dates";
import { Badge } from "@/components/Badge";
import {
  TOX_LABEL,
  TOX_HINT,
  TOX_DOT,
  TOX_CHECK_STATUSES,
  toxStatusTone,
  REACTIVATE_MONTHS,
} from "@/lib/toxStatus";
import {
  addToxCheck,
  updateToxPatient,
  deleteToxCheck,
  deleteToxPatient,
  startReactivation,
  linkToxToPatient,
  createAndLinkPatient,
  unlinkToxPatient,
} from "@/lib/toxActions";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ToxPatientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tenantId = await getCurrentTenantId();
  const patient = await prisma.toxPatient.findFirst({
    where: { id, tenantId },
    include: {
      checks: { orderBy: [{ checkDate: "desc" }, { createdAt: "desc" }] },
      tasks: {
        where: { workflowStep: "6-Month Reactivation", status: { notIn: ["Completed", "Cancelled"] } },
        select: { id: true },
      },
    },
  });
  if (!patient) notFound();

  const lapsed =
    patient.lastVisitDate != null && patient.lastVisitDate < monthsAgo(REACTIVATE_MONTHS);
  const hasReactivationTask = patient.tasks.length > 0;

  // Linked patient record (for the shared visit timeline), plus candidates to link.
  const linkedPatient = patient.patientId
    ? await prisma.patient.findUnique({
        where: { id: patient.patientId },
        include: { records: { orderBy: { eventDate: "desc" }, take: 3 } },
      })
    : null;
  const candidates = patient.patientId
    ? []
    : await prisma.patient.findMany({
        where: { tenantId },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
        take: 1000,
      });
  const suggestion = !patient.patientId
    ? candidates.find((c) => c.name.trim().toLowerCase() === patient.name.trim().toLowerCase())
    : undefined;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/tox" className="text-sm text-muted hover:text-ink">
          ← Botox Tracker
        </Link>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-3xl leading-none">{TOX_DOT[patient.status]}</span>
          <div>
            <h1 className="text-2xl font-semibold text-ink">{patient.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
              <Badge tone={toxStatusTone(patient.status)}>{TOX_LABEL[patient.status]}</Badge>
              {patient.phone && <span>{patient.phone}</span>}
              {patient.isClubMember && (
                <span className="rounded bg-blush/40 px-1.5 py-0.5 text-[11px] font-medium text-clay">
                  ★ Club member
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {lapsed && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3">
          <p className="text-sm text-ink">
            ⏰ Last seen {formatDate(patient.lastVisitDate)} — over {REACTIVATE_MONTHS} months ago.
            This patient is due for a reactivation reach-out.
          </p>
          {hasReactivationTask ? (
            <span className="text-sm text-success">✓ Reactivation task created</span>
          ) : (
            <form action={startReactivation}>
              <input type="hidden" name="id" value={patient.id} />
              <button className="btn-primary py-1.5 text-sm">Start reactivation task</button>
            </form>
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Log a results check */}
        <div className="card p-5 lg:col-span-1">
          <h2 className="text-sm font-semibold text-ink">Log a results check</h2>
          <p className="mt-1 text-xs text-muted">
            How did they feel this visit? This updates their color and adds to the
            history below.
          </p>
          <form action={addToxCheck} className="mt-4 space-y-3">
            <input type="hidden" name="id" value={patient.id} />
            <div>
              <label className="label">Result</label>
              <div className="grid grid-cols-3 gap-2">
                {TOX_CHECK_STATUSES.map((s, idx) => (
                  <label
                    key={s}
                    className="flex cursor-pointer flex-col items-center gap-1 rounded-lg border border-line px-2 py-2 text-center text-xs hover:bg-canvas has-[:checked]:border-ink has-[:checked]:bg-canvas"
                    title={TOX_HINT[s]}
                  >
                    <input
                      type="radio"
                      name="status"
                      value={s}
                      defaultChecked={idx === 0}
                      className="sr-only"
                    />
                    <span className="text-lg leading-none">{TOX_DOT[s]}</span>
                    <span className="font-medium text-ink">{TOX_LABEL[s]}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="label">Date</label>
              <input
                type="date"
                name="checkDate"
                defaultValue={toDateInput(new Date())}
                className="input"
              />
            </div>
            <div>
              <label className="label">Note (optional)</label>
              <textarea
                name="note"
                rows={2}
                className="input"
                placeholder="What did they say?"
              />
            </div>
            <button className="btn-primary w-full">Save check</button>
          </form>
        </div>

        {/* History timeline */}
        <div className="card p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold text-ink">
            Satisfaction history
            <span className="ml-2 font-normal text-muted">
              {patient.checks.length} entr{patient.checks.length === 1 ? "y" : "ies"}
            </span>
          </h2>
          {patient.checks.length === 0 ? (
            <p className="mt-4 text-sm text-muted">
              No checks logged yet. Add the first one on the left — it&apos;ll start
              the timeline.
            </p>
          ) : (
            <ol className="mt-4 space-y-3">
              {patient.checks.map((c) => (
                <li key={c.id} className="flex items-start gap-3">
                  <span className="mt-0.5 text-lg leading-none">{TOX_DOT[c.status]}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-ink">{TOX_LABEL[c.status]}</span>
                      <span className="text-xs text-muted">{formatDate(c.checkDate)}</span>
                    </div>
                    {c.note && <div className="mt-0.5 text-sm text-muted">{c.note}</div>}
                  </div>
                  <form action={deleteToxCheck}>
                    <input type="hidden" name="checkId" value={c.id} />
                    <input type="hidden" name="id" value={patient.id} />
                    <button className="text-[11px] text-muted hover:text-danger">Remove</button>
                  </form>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      {/* Linked patient record — the shared visit timeline */}
      <div className="card p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-ink">Patient record</h2>
            <p className="mt-1 text-xs text-muted">
              Link this Botox patient to their main record so treatments (and
              Mindbody visits) keep the reactivation clock current — no double entry.
            </p>
          </div>
        </div>

        {linkedPatient ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm">
              <div className="flex items-center gap-2">
                <span className="text-success">✓ Linked to</span>
                <Link href={`/patients/${linkedPatient.id}`} className="font-medium text-ink hover:underline">
                  {linkedPatient.name}
                </Link>
              </div>
              <div className="mt-1 text-xs text-muted">
                {linkedPatient.records.length > 0
                  ? `Last treatment on file: ${formatDate(linkedPatient.records[0].eventDate)} (${linkedPatient.records[0].service})`
                  : "No treatments recorded yet — logging one will update the visit clock here."}
              </div>
            </div>
            <form action={unlinkToxPatient}>
              <input type="hidden" name="id" value={patient.id} />
              <button className="text-xs text-muted hover:text-danger">Unlink</button>
            </form>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {suggestion && (
              <form action={linkToxToPatient} className="flex flex-wrap items-center gap-2 rounded-lg border border-success/30 bg-success/10 px-3 py-2">
                <input type="hidden" name="id" value={patient.id} />
                <input type="hidden" name="patientId" value={suggestion.id} />
                <span className="text-sm text-ink">
                  Found a matching record: <strong>{suggestion.name}</strong>
                </span>
                <button className="btn-primary py-1 text-xs">Link them</button>
              </form>
            )}
            <div className="flex flex-wrap items-end gap-2">
              <form action={linkToxToPatient} className="flex items-end gap-2">
                <input type="hidden" name="id" value={patient.id} />
                <div>
                  <label className="label">Link to an existing patient</label>
                  <select name="patientId" className="input w-64" defaultValue="">
                    <option value="">Choose a patient…</option>
                    {candidates.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <button className="btn-ghost">Link</button>
              </form>
              <span className="pb-2 text-xs text-muted">or</span>
              <form action={createAndLinkPatient} className="pb-0.5">
                <input type="hidden" name="id" value={patient.id} />
                <button className="btn-ghost">Create a new record from this profile</button>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* Standing info */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-ink">Patient details</h2>
        <form action={updateToxPatient} className="mt-4 grid gap-4 md:grid-cols-2">
          <input type="hidden" name="id" value={patient.id} />
          <div>
            <label className="label">Name</label>
            <input name="name" defaultValue={patient.name} className="input" />
          </div>
          <div>
            <label className="label">Contact #</label>
            <input name="phone" defaultValue={patient.phone ?? ""} className="input" />
          </div>
          <div>
            <label className="label">Initial treatment</label>
            <input
              name="initialTreatment"
              defaultValue={patient.initialTreatment ?? ""}
              className="input"
            />
          </div>
          <div>
            <label className="label">Two-week date</label>
            <input
              type="date"
              name="twoWeekDate"
              defaultValue={patient.twoWeekDate ? di(patient.twoWeekDate) : ""}
              className="input"
            />
          </div>
          <div>
            <label className="label">Last visit</label>
            <input
              type="date"
              name="lastVisitDate"
              defaultValue={patient.lastVisitDate ? di(patient.lastVisitDate) : ""}
              className="input"
            />
            <p className="mt-1 text-[11px] text-muted">
              Drives the {REACTIVATE_MONTHS}-month reactivation reminder. Updates
              automatically each time you log a check.
            </p>
          </div>
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                name="isClubMember"
                defaultChecked={patient.isClubMember}
                className="h-4 w-4"
              />
              Club member
            </label>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                name="twoWeekBooked"
                defaultChecked={patient.twoWeekBooked}
                className="h-4 w-4"
              />
              Two-week booked
            </label>
          </div>
          <div className="md:col-span-2">
            <label className="label">Standing notes</label>
            <textarea
              name="notes"
              defaultValue={patient.notes ?? ""}
              rows={2}
              className="input"
              placeholder="Notes that always apply to this patient"
            />
          </div>
          <div className="md:col-span-2 flex justify-end">
            <button className="btn-primary">Save details</button>
          </div>
        </form>
        <div className="mt-4 border-t border-line/60 pt-4">
          <form action={deleteToxPatient}>
            <input type="hidden" name="id" value={patient.id} />
            <button className="text-xs text-danger hover:underline">Delete patient</button>
          </form>
        </div>
      </div>
    </div>
  );
}
