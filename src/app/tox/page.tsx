import { prisma } from "@/lib/prisma";
import { getCurrentTenantId } from "@/lib/tenant";
import { formatDate, monthsAgo } from "@/lib/dates";
import { Badge } from "@/components/Badge";
import { NewToxPatientForm } from "@/components/NewToxPatientForm";
import { startReactivation, startReactivationForAllDue } from "@/lib/toxActions";
import {
  TOX_LABEL,
  toxStatusTone,
  TOX_ROW_TINT,
  REACTIVATE_MONTHS,
} from "@/lib/toxStatus";
import { ToxSetColorCell } from "@/components/ToxSetColorCell";
import Link from "next/link";

export const dynamic = "force-dynamic";

const STATUS_FILTERS: Record<string, { label: string; where: object }> = {
  all: { label: "All", where: {} },
  happy: { label: "🟢 Happy", where: { status: "happy" } },
  watch: { label: "🟡 Tough", where: { status: "watch" } },
  not_happy: { label: "🔴 Not Happy", where: { status: "not_happy" } },
  awaiting: { label: "⚪ Awaiting", where: { status: "awaiting" } },
  club: { label: "★ Club", where: { isClubMember: true } },
};

function Kpi({
  label,
  value,
  tone = "ink",
  href,
}: {
  label: string;
  value: string;
  tone?: "ink" | "success" | "warning" | "danger" | "muted" | "accent";
  href?: string;
}) {
  const color =
    tone === "success"
      ? "text-success"
      : tone === "warning"
      ? "text-warning"
      : tone === "danger"
      ? "text-danger"
      : tone === "accent"
      ? "text-accent"
      : tone === "muted"
      ? "text-muted"
      : "text-ink";
  const body = (
    <div className="card p-4">
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted">{label}</div>
      <div className={`mt-1.5 text-2xl font-semibold ${color}`}>{value}</div>
    </div>
  );
  return href ? (
    <Link href={href} className="block transition-transform hover:-translate-y-0.5">
      {body}
    </Link>
  ) : (
    body
  );
}

export default async function ToxPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; q?: string; imported?: string; updated?: string; reactivated?: string }>;
}) {
  const { filter, q, imported, updated, reactivated } = await searchParams;
  const key = filter ?? "all";
  const isReactivate = key === "reactivate";
  const tenantId = await getCurrentTenantId();
  const search = (q ?? "").trim();
  const cutoff = monthsAgo(REACTIVATE_MONTHS);

  const baseWhere: Record<string, unknown> = { tenantId };
  if (isReactivate) {
    baseWhere.lastVisitDate = { not: null, lt: cutoff };
  } else if (STATUS_FILTERS[key]) {
    Object.assign(baseWhere, STATUS_FILTERS[key].where);
  }
  if (search) baseWhere.name = { contains: search, mode: "insensitive" };

  const [patients, happy, watch, notHappy, awaiting, total, reactivateCount] = await Promise.all([
    prisma.toxPatient.findMany({
      where: baseWhere,
      orderBy: isReactivate ? [{ lastVisitDate: "asc" }] : [{ name: "asc" }],
      include: {
        _count: { select: { checks: true } },
        checks: {
          orderBy: [{ checkDate: "desc" }, { createdAt: "desc" }],
          take: 1,
          select: { note: true },
        },
        tasks: {
          where: { workflowStep: "6-Month Reactivation", status: { notIn: ["Completed", "Cancelled"] } },
          select: { id: true },
        },
      },
    }),
    prisma.toxPatient.count({ where: { tenantId, status: "happy" } }),
    prisma.toxPatient.count({ where: { tenantId, status: "watch" } }),
    prisma.toxPatient.count({ where: { tenantId, status: "not_happy" } }),
    prisma.toxPatient.count({ where: { tenantId, status: "awaiting" } }),
    prisma.toxPatient.count({ where: { tenantId } }),
    prisma.toxPatient.count({ where: { tenantId, lastVisitDate: { not: null, lt: cutoff } } }),
  ]);

  const checked = happy + watch + notHappy;
  const happyRate = checked ? Math.round((happy / checked) * 100) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Tox Tracker</h1>
          <p className="mt-1 text-sm text-muted">
            Track how each Botox patient felt at their results check. Set a color
            as they come in — every change is saved to their history.
          </p>
        </div>
        <Link href="/tox/import" className="btn-ghost">
          Import from spreadsheet
        </Link>
      </div>

      {(imported || updated) && (
        <div className="rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
          {imported && imported !== "0" && (
            <>Imported {imported} new patient{imported === "1" ? "" : "s"}. </>
          )}
          {updated && updated !== "0" && (
            <>Updated {updated} existing patient{updated === "1" ? "" : "s"} (dates/status filled in). </>
          )}
          {(!imported || imported === "0") && (!updated || updated === "0") && (
            <>No changes were made — double-check your column headers (e.g. a “Last Visit” date column).</>
          )}
        </div>
      )}
      {reactivated && (
        <div className="rounded-lg border border-accent/40 bg-accent/10 px-4 py-3 text-sm text-ink">
          Created {reactivated} reactivation task{reactivated === "1" ? "" : "s"} — find them in Today&apos;s Tasks.
        </div>
      )}

      {/* The little dashboard */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        <Kpi label="🟢 Happy" value={String(happy)} tone="success" />
        <Kpi label="🟡 Tough" value={String(watch)} tone="warning" />
        <Kpi label="🔴 Not Happy" value={String(notHappy)} tone="danger" />
        <Kpi label="⚪ Awaiting" value={String(awaiting)} tone="muted" />
        <Kpi label="Happy Rate" value={happyRate == null ? "—" : `${happyRate}%`} tone="accent" />
        <Kpi
          label={`⏰ Reactivate`}
          value={String(reactivateCount)}
          tone={reactivateCount ? "warning" : "muted"}
          href="/tox?filter=reactivate"
        />
      </div>

      <NewToxPatientForm />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1">
          {Object.entries(STATUS_FILTERS).map(([k, f]) => (
            <Link
              key={k}
              href={`/tox?filter=${k}${search ? `&q=${encodeURIComponent(search)}` : ""}`}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                k === key ? "bg-ink text-white" : "text-muted hover:bg-canvas hover:text-ink"
              }`}
            >
              {f.label}
            </Link>
          ))}
          <Link
            href="/tox?filter=reactivate"
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              isReactivate ? "bg-ink text-white" : "text-muted hover:bg-canvas hover:text-ink"
            }`}
          >
            ⏰ Reactivate
          </Link>
        </div>
        <form action="/tox" className="flex items-center gap-2">
          <input type="hidden" name="filter" value={key} />
          <input
            name="q"
            defaultValue={search}
            placeholder="Search name…"
            className="input w-44 py-1.5 text-sm"
          />
          <button className="btn-ghost py-1.5 text-sm">Search</button>
        </form>
      </div>

      {isReactivate && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3">
          <p className="text-sm text-ink">
            Patients not seen in {REACTIVATE_MONTHS}+ months (about two Botox cycles).
            {reactivateCount > 0 && " Create a reactivation reminder for each one at once:"}
          </p>
          {reactivateCount > 0 && (
            <form action={startReactivationForAllDue}>
              <button className="btn-primary py-1.5 text-sm">
                Create tasks for all {reactivateCount}
              </button>
            </form>
          )}
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-canvas/50 text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-3 py-2 font-medium">Patient</th>
                <th className="px-3 py-2 font-medium">{isReactivate ? "Last Visit" : "Last Check"}</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">{isReactivate ? "Reactivation" : "Set Color"}</th>
                <th className="px-3 py-2 font-medium">Comments</th>
              </tr>
            </thead>
            <tbody>
              {patients.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-10 text-center text-muted">
                    {isReactivate
                      ? "No lapsed patients right now. 🎉"
                      : total === 0
                      ? "No patients yet. Add one above, or import your spreadsheet."
                      : "No patients in this view."}
                  </td>
                </tr>
              ) : (
                patients.map((p) => {
                  const hasTask = p.tasks.length > 0;
                  return (
                    <tr
                      key={p.id}
                      className={`border-b border-line/60 ${TOX_ROW_TINT[p.status] ?? ""}`}
                    >
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5 whitespace-nowrap">
                          <Link href={`/tox/${p.id}`} className="font-medium text-ink hover:underline">
                            {p.name}
                          </Link>
                          {p.isClubMember && (
                            <span className="rounded bg-blush/40 px-1 py-0.5 text-[9px] font-medium text-clay">
                              ★
                            </span>
                          )}
                          {p.phone && <span className="text-[11px] text-muted">{p.phone}</span>}
                        </div>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-muted">
                        {isReactivate
                          ? p.lastVisitDate
                            ? formatDate(p.lastVisitDate)
                            : "—"
                          : p.lastCheckDate
                          ? formatDate(p.lastCheckDate)
                          : "—"}
                        {!isReactivate && p._count.checks > 0 && (
                          <span className="ml-1 text-[11px] text-muted/70">
                            ({p._count.checks})
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <Badge tone={toxStatusTone(p.status)}>{TOX_LABEL[p.status]}</Badge>
                      </td>
                      <td className="px-3 py-2">
                        {isReactivate ? (
                          hasTask ? (
                            <span className="text-xs text-success">✓ Task created</span>
                          ) : (
                            <form action={startReactivation}>
                              <input type="hidden" name="id" value={p.id} />
                              <button className="rounded border border-accent/50 bg-accent/10 px-2 py-1 text-xs text-ink hover:bg-accent/20">
                                Start reactivation
                              </button>
                            </form>
                          )
                        ) : (
                          <ToxSetColorCell id={p.id} status={p.status} />
                        )}
                      </td>
                      <td className="px-3 py-2 text-muted">
                        {p.notes ? (
                          <div className="line-clamp-1 max-w-xs">{p.notes}</div>
                        ) : p.checks[0]?.note ? (
                          <div className="line-clamp-1 max-w-xs text-[11px] text-muted/80">
                            🗒 {p.checks[0].note}
                          </div>
                        ) : (
                          <span className="text-muted/50">—</span>
                        )}
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
