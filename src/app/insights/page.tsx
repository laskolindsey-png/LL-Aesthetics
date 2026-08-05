import { prisma } from "@/lib/prisma";
import { getCurrentTenantId } from "@/lib/tenant";
import { getSessionUser } from "@/lib/currentUser";
import { todayStart, monthsAgo } from "@/lib/dates";
import { money } from "@/lib/plans";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// KPI benchmark tiers — clay = Average, amber = Great, sage = Elite (your palette).
type Grade = "average" | "great" | "elite";

function tierChipClass(grade: Grade): string {
  return grade === "elite"
    ? "border-success/30 bg-success/10 text-success"
    : grade === "great"
    ? "border-warning/30 bg-warning/10 text-[#9a6f28]"
    : "border-danger/30 bg-danger/10 text-danger";
}
function tierLabel(grade: Grade): string {
  return grade === "elite" ? "Elite ★" : grade === "great" ? "Great" : "Average";
}
function tierValueColor(grade: Grade): string {
  return grade === "elite" ? "text-success" : grade === "great" ? "text-warning" : "text-danger";
}
// Grade a higher-is-better metric against its Great and Elite thresholds.
function gradeUp(value: number | null, greatMin: number, eliteMin: number): Grade | undefined {
  if (value == null) return undefined;
  if (value >= eliteMin) return "elite";
  if (value >= greatMin) return "great";
  return "average";
}

// A single KPI tile. `pending` marks metrics that need the Mindbody connection —
// they show their definition and a "Mindbody" chip until data flows in. `grade`
// colors the tile by benchmark tier and shows the tier chip.
function Kpi({
  label,
  value,
  sub,
  tone = "ink",
  pending = false,
  grade,
}: {
  label: string;
  value?: string;
  sub?: string;
  tone?: "ink" | "success" | "warning" | "danger" | "accent" | "muted";
  pending?: boolean;
  grade?: Grade;
}) {
  const color = grade
    ? tierValueColor(grade)
    : tone === "success"
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
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="text-[11px] font-medium uppercase tracking-wide text-muted">{label}</div>
        {pending ? (
          <span className="rounded-full border border-line px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-muted">
            Mindbody
          </span>
        ) : grade ? (
          <span
            className={`rounded-full border px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide ${tierChipClass(
              grade
            )}`}
          >
            {tierLabel(grade)}
          </span>
        ) : (
          <span className="rounded-full border border-success/30 bg-success/10 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-success">
            Live
          </span>
        )}
      </div>
      <div className={`mt-2 text-2xl font-semibold ${pending ? "text-muted/40" : color}`}>
        {pending ? "—" : value ?? "—"}
      </div>
      {sub && <div className="mt-1 text-[11px] leading-snug text-muted">{sub}</div>}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-sm font-semibold uppercase tracking-wide text-ink">{children}</h2>;
}

export default async function InsightsPage() {
  const me = await getSessionUser();
  if (!me) redirect("/login");
  if (me.role !== "owner") redirect("/");

  const tenantId = await getCurrentTenantId();
  const now = todayStart();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    totalPatients,
    planPipeline,
    peptideOpen,
    peptideReceived,
    toxHappy,
    toxChecked,
    toxLapsed,
    newLeadsThisMonth,
    totalLeads,
    bookedLeads,
    leadSources,
    tasksCompletedThisMonth,
    openFollowUps,
  ] = await Promise.all([
    prisma.patient.count({ where: { tenantId } }),
    prisma.treatmentPlanItem.aggregate({
      where: { tenantId, status: { in: ["Recommended", "Scheduled"] } },
      _sum: { price: true },
    }),
    prisma.peptideOrder.aggregate({
      where: { tenantId, status: { notIn: ["Received", "Cancelled"] } },
      _sum: { amount: true },
    }),
    prisma.peptideOrder.aggregate({
      where: { tenantId, status: "Received" },
      _sum: { amount: true },
    }),
    prisma.toxPatient.count({ where: { tenantId, status: "happy" } }),
    prisma.toxPatient.count({ where: { tenantId, status: { in: ["happy", "watch", "not_happy"] } } }),
    prisma.toxPatient.count({ where: { tenantId, lastVisitDate: { not: null, lt: monthsAgo(6) } } }),
    prisma.lead.count({ where: { tenantId, createdAt: { gte: monthStart } } }),
    prisma.lead.count({ where: { tenantId } }),
    prisma.lead.count({ where: { tenantId, OR: [{ stage: "Booked" }, { convertedAt: { not: null } }] } }),
    prisma.lead.groupBy({ by: ["source"], where: { tenantId }, _count: { _all: true } }),
    prisma.task.count({ where: { tenantId, status: "Completed", completedDate: { gte: monthStart } } }),
    prisma.task.count({ where: { tenantId, status: { notIn: ["Completed", "Cancelled"] } } }),
  ]);

  const happyRate = toxChecked ? Math.round((toxHappy / toxChecked) * 100) : null;
  const conversion = totalLeads ? Math.round((bookedLeads / totalLeads) * 100) : null;
  // Grade the live metrics that have benchmarks (higher is better).
  const happyGrade = gradeUp(happyRate, 75, 90);
  const conversionGrade = gradeUp(conversion, 40, 50);
  const topSources = leadSources
    .filter((s) => s.source)
    .sort((a, b) => b._count._all - a._count._all)
    .slice(0, 3);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Insights</h1>
          <p className="mt-1 text-sm text-muted">
            Your business at a glance — owner-only. Once Mindbody is connected, the
            financial and visit metrics below fill in automatically from your
            point-of-sale and schedule.
          </p>
        </div>
        <span className="rounded-lg border border-line bg-canvas px-3 py-1.5 text-xs text-muted">
          🔒 Owner only · not visible to staff
        </span>
      </div>

      <div className="flex items-center gap-4 text-[11px] text-muted">
        <span className="inline-flex items-center gap-1">
          <span className="rounded-full border border-success/30 bg-success/10 px-1.5 py-0.5 font-medium uppercase text-success">
            Live
          </span>
          computed now from LLAOS
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="rounded-full border border-line px-1.5 py-0.5 font-medium uppercase">
            Mindbody
          </span>
          fills in when connected
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted">
        <span>Benchmark tiers:</span>
        <span className="rounded-full border border-danger/30 bg-danger/10 px-1.5 py-0.5 font-medium uppercase text-danger">
          Average
        </span>
        <span>→</span>
        <span className="rounded-full border border-warning/30 bg-warning/10 px-1.5 py-0.5 font-medium uppercase text-[#9a6f28]">
          Great
        </span>
        <span>→</span>
        <span className="rounded-full border border-success/30 bg-success/10 px-1.5 py-0.5 font-medium uppercase text-success">
          Elite ★
        </span>
        <span>· graded against benchmarks for a spa your size</span>
      </div>

      {/* Revenue */}
      <div className="space-y-3">
        <SectionTitle>Revenue</SectionTitle>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi label="Revenue (this month)" pending sub="Total collected, from Mindbody sales" />
          <Kpi label="Average ticket" pending sub="Revenue ÷ number of visits" />
          <Kpi label="Revenue per patient" pending sub="Revenue ÷ unique patients seen" />
          <Kpi label="Retail / product %" pending sub="Share of revenue from product vs service" />
          <Kpi
            label="Treatment-plan pipeline"
            value={money(planPipeline._sum.price)}
            tone="accent"
            sub="Value of recommended + scheduled plan items"
          />
          <Kpi
            label="Peptide orders open"
            value={money(peptideOpen._sum.amount)}
            tone="accent"
            sub="Value of orders not yet received"
          />
          <Kpi
            label="Peptide revenue (received)"
            value={money(peptideReceived._sum.amount)}
            tone="success"
            sub="Delivered peptide orders"
          />
        </div>
      </div>

      {/* Patients & retention */}
      <div className="space-y-3">
        <SectionTitle>Patients &amp; Retention</SectionTitle>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi label="Total patients" value={String(totalPatients)} sub="Records in LLAOS" />
          <Kpi label="Rebooking %" pending sub="Patients who book their next visit before leaving" />
          <Kpi label="Visit frequency" pending sub="Average days between a patient's visits" />
          <Kpi label="No-show rate" pending sub="Missed appointments ÷ booked" />
          <Kpi
            label="Botox happy rate"
            value={happyRate == null ? "—" : `${happyRate}%`}
            tone="success"
            grade={happyGrade}
            sub="Happy ÷ all checked (from the tracker)"
          />
          <Kpi
            label="Lapsed Botox (6mo+)"
            value={String(toxLapsed)}
            tone={toxLapsed ? "warning" : "muted"}
            sub="Due for reactivation"
          />
          <Kpi label="New vs returning" pending sub="Split of first-time vs repeat visits" />
          <Kpi label="Active members" pending sub="Current membership count (from Mindbody)" />
        </div>
      </div>

      {/* Operations */}
      <div className="space-y-3">
        <SectionTitle>Operations</SectionTitle>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi label="Provider utilization" pending sub="Booked hours ÷ available hours, per provider" />
          <Kpi label="Chair / room utilization" pending sub="How full the schedule runs" />
          <Kpi
            label="Follow-ups done (mo.)"
            value={String(tasksCompletedThisMonth)}
            tone="success"
            sub="Tasks completed this month"
          />
          <Kpi
            label="Open follow-ups"
            value={String(openFollowUps)}
            tone={openFollowUps ? "warning" : "muted"}
            sub="Pending tasks right now"
          />
        </div>
      </div>

      {/* Growth */}
      <div className="space-y-3">
        <SectionTitle>Growth &amp; Marketing</SectionTitle>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi
            label="New leads (this month)"
            value={String(newLeadsThisMonth)}
            tone="accent"
            sub="Prospects added this month"
          />
          <Kpi
            label="Lead → booked"
            value={conversion == null ? "—" : `${conversion}%`}
            tone="accent"
            grade={conversionGrade}
            sub="Share of leads that became patients"
          />
          <Kpi label="Cost per acquisition" pending sub="Ad spend ÷ new patients (needs spend input)" />
          <Kpi label="Referral %" pending sub="New patients from referrals" />
        </div>
        {topSources.length > 0 && (
          <div className="card p-4">
            <div className="text-[11px] font-medium uppercase tracking-wide text-muted">
              Top lead sources
            </div>
            <div className="mt-2 space-y-1.5">
              {topSources.map((s) => {
                const pct = totalLeads ? Math.round((s._count._all / totalLeads) * 100) : 0;
                return (
                  <div key={s.source} className="flex items-center gap-3 text-sm">
                    <span className="w-32 shrink-0 text-ink">{s.source}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-canvas">
                      <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-16 shrink-0 text-right text-muted">
                      {s._count._all} · {pct}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <p className="text-xs text-muted">
        Metrics marked <strong>Mindbody</strong> activate when the integration goes
        live. Nothing here is shared with staff logins.
      </p>
    </div>
  );
}
