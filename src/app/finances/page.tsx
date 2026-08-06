import { prisma } from "@/lib/prisma";
import { getCurrentTenantId } from "@/lib/tenant";
import { getSessionUser } from "@/lib/currentUser";
import { money } from "@/lib/plans";
import { periodRange, monthsInRange, pct, type FinancePeriod } from "@/lib/finance";
import { FinanceTabs } from "@/components/FinanceTabs";
import { todayStart } from "@/lib/dates";
import { redirect } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

function Kpi({ label, value, tone = "ink", sub }: { label: string; value: string; tone?: string; sub?: string }) {
  const color =
    tone === "success" ? "text-success" : tone === "danger" ? "text-danger" : tone === "accent" ? "text-accent" : "text-ink";
  return (
    <div className="card p-5">
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted">{label}</div>
      <div className={`mt-1.5 text-2xl font-semibold ${color}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-muted">{sub}</div>}
    </div>
  );
}

export default async function FinancesPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const me = await getSessionUser();
  if (!me) redirect("/login");
  if (me.role !== "owner") redirect("/");

  const { period: periodRaw } = await searchParams;
  const period: FinancePeriod = periodRaw === "year" ? "year" : "month";
  const tenantId = await getCurrentTenantId();
  const { start, end, label } = periodRange(period, todayStart());
  const months = Math.max(1, monthsInRange(start, end));

  const [manualRevenue, activeMembers, completedItems, expenses] = await Promise.all([
    prisma.revenueEntry.findMany({ where: { tenantId, periodStart: { gte: start, lt: end } } }),
    prisma.membership.findMany({ where: { tenantId, status: "Active" }, select: { monthlyAmount: true } }),
    prisma.treatmentPlanItem.findMany({
      where: { tenantId, status: "Completed", completedDate: { gte: start, lt: end } },
      select: { price: true },
    }),
    prisma.expenseEntry.findMany({ where: { tenantId, date: { gte: start, lt: end } } }),
  ]);

  // Revenue: recorded entries (Mindbody import/auto + manual) plus, only as a
  // fallback, an estimate for anything not yet flowing from real data.
  const mrr = activeMembers.reduce((s, m) => s + (m.monthlyAmount ?? 0), 0);
  const membershipEstimate = mrr * months;
  const serviceRevenue = completedItems.reduce((s, i) => s + (i.price ?? 0), 0);

  const revByCat = new Map<string, number>();
  // Real recorded revenue first (includes Mindbody memberships, service, retail).
  for (const r of manualRevenue) revByCat.set(r.category, (revByCat.get(r.category) ?? 0) + r.amount);

  // Membership dues are billed on the 1st/15th and captured as real entries once
  // Mindbody is flowing. Only fall back to the active-member estimate when we
  // have no real membership revenue this period — so the two never double-count.
  const membershipRecorded = revByCat.get("Membership Revenue") ?? 0;
  const usingMembershipEstimate = membershipRecorded === 0 && membershipEstimate > 0;
  if (usingMembershipEstimate) {
    revByCat.set("Membership Revenue", membershipEstimate);
  }

  // Completed Aura-plan treatments (manual pipeline), kept as a distinct line.
  if (serviceRevenue > 0) {
    revByCat.set("Service Revenue (completed)", (revByCat.get("Service Revenue (completed)") ?? 0) + serviceRevenue);
  }

  const totalRevenue = [...revByCat.values()].reduce((s, v) => s + v, 0);

  const expByCat = new Map<string, number>();
  for (const e of expenses) expByCat.set(e.category, (expByCat.get(e.category) ?? 0) + e.amount);
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);

  const net = totalRevenue - totalExpenses;
  const margin = pct(net, totalRevenue);

  const revSources = [...revByCat.entries()].sort((a, b) => b[1] - a[1]);
  const expTop = [...expByCat.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Financials</h1>
          <p className="mt-1 text-sm text-muted">
            Revenue, expenses, and profit — owner-only. Membership and completed-treatment
            revenue flow in automatically; expenses you log below.
          </p>
        </div>
        <span className="rounded-lg border border-line bg-canvas px-3 py-1.5 text-xs text-muted">🔒 Owner only</span>
      </div>

      <FinanceTabs />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1">
          {(["month", "year"] as const).map((p) => (
            <Link
              key={p}
              href={`/finances?period=${p}`}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                p === period ? "bg-ink text-white" : "text-muted hover:bg-canvas hover:text-ink"
              }`}
            >
              {p === "month" ? "This Month" : "This Year"}
            </Link>
          ))}
        </div>
        <span className="text-sm font-medium text-ink">{label}</span>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Kpi label="Revenue" value={money(totalRevenue)} tone="success" />
        <Kpi label="Expenses" value={money(totalExpenses)} tone={totalExpenses ? "danger" : "ink"} />
        <Kpi label="Net Profit" value={money(net)} tone={net >= 0 ? "success" : "danger"} />
        <Kpi label="Profit Margin" value={totalRevenue ? `${margin}%` : "—"} tone="accent" sub="net ÷ revenue" />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-1 text-sm font-semibold text-ink">Revenue Sources</h2>
          <p className="mb-3 text-xs text-muted">Where revenue is coming from</p>
          {revSources.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">No revenue in this period yet.</p>
          ) : (
            <ul className="space-y-2">
              {revSources.map(([cat, amt]) => (
                <li key={cat} className="flex items-center justify-between text-sm">
                  <span className="text-ink">{cat}</span>
                  <span className="font-medium text-ink">
                    {money(amt)} <span className="text-xs text-muted">({pct(amt, totalRevenue)}%)</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card p-5">
          <h2 className="mb-1 text-sm font-semibold text-ink">Expense Analysis</h2>
          <p className="mb-3 text-xs text-muted">Where money is being spent</p>
          {expTop.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">No expenses logged in this period.</p>
          ) : (
            <ul className="space-y-2">
              {expTop.map(([cat, amt]) => (
                <li key={cat} className="flex items-center justify-between text-sm">
                  <span className="text-ink">{cat}</span>
                  <span className="font-medium text-ink">
                    {money(amt)} <span className="text-xs text-muted">({pct(amt, totalExpenses)}%)</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {usingMembershipEstimate ? (
        <p className="text-xs text-muted">
          ↳ {money(membershipEstimate)} of revenue is <em>estimated</em> from {activeMembers.length} active members
          ({money(mrr)}/mo{period === "year" ? ` × ${months} months` : ""}). Import a Mindbody Sales report (or let
          checkouts flow in) and real membership dues replace this estimate automatically.
        </p>
      ) : membershipRecorded > 0 ? (
        <p className="text-xs text-muted">
          ↳ Membership revenue ({money(membershipRecorded)}) reflects real Mindbody dues this period, not an estimate.
        </p>
      ) : null}
    </div>
  );
}
