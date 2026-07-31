import { prisma } from "@/lib/prisma";
import { getCurrentTenantId } from "@/lib/tenant";
import { todayStart, toDateInput, formatDate } from "@/lib/dates";
import { money } from "@/lib/plans";
import { Badge } from "@/components/Badge";
import { NewMembershipForm } from "@/components/NewMembershipForm";
import { setMembershipStatus, deleteMembership } from "@/lib/membershipActions";
import { MEMBERSHIP_STATUSES, membershipStatusTone } from "@/lib/membershipStatus";
import Link from "next/link";

export const dynamic = "force-dynamic";

const FILTERS: Record<string, { label: string; where: object }> = {
  active: { label: "Active", where: { status: "Active" } },
  paused: { label: "Paused", where: { status: "Paused" } },
  cancelled: { label: "Cancelled", where: { status: "Cancelled" } },
  all: { label: "All", where: {} },
};

function Kpi({ label, value, tone = "ink" }: { label: string; value: string; tone?: "ink" | "success" | "accent" | "warning" }) {
  const color =
    tone === "success" ? "text-success" : tone === "accent" ? "text-accent" : tone === "warning" ? "text-warning" : "text-ink";
  return (
    <div className="card p-4">
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted">{label}</div>
      <div className={`mt-1.5 text-2xl font-semibold ${color}`}>{value}</div>
    </div>
  );
}

export default async function MembershipsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; imported?: string }>;
}) {
  const { filter, imported } = await searchParams;
  const key = filter && FILTERS[filter] ? filter : "active";
  const active = FILTERS[key];
  const tenantId = await getCurrentTenantId();
  const now = todayStart();
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const [members, activeMembers, allActive, renewingSoon] = await Promise.all([
    prisma.membership.findMany({ where: { tenantId, ...active.where }, orderBy: [{ memberName: "asc" }] }),
    prisma.membership.count({ where: { tenantId, status: "Active" } }),
    prisma.membership.findMany({ where: { tenantId, status: "Active" }, select: { monthlyAmount: true } }),
    prisma.membership.count({
      where: { tenantId, status: "Active", renewalDate: { gte: now, lte: monthEnd } },
    }),
  ]);

  const mrr = allActive.reduce((s, m) => s + (m.monthlyAmount ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Memberships</h1>
          <p className="mt-1 text-sm text-muted">
            Your recurring-revenue members — who&apos;s active, what they&apos;re worth, and what&apos;s renewing.
          </p>
        </div>
        <Link href="/memberships/import" className="btn-ghost">
          Import from spreadsheet
        </Link>
      </div>

      {imported && (
        <div className="rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
          Imported {imported} member{imported === "1" ? "" : "s"} from your spreadsheet.
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Active members" value={String(activeMembers)} tone="success" />
        <Kpi label="Monthly recurring" value={money(mrr)} tone="accent" />
        <Kpi label="Annualized value" value={money(mrr * 12)} tone="accent" />
        <Kpi label="Renewing this month" value={String(renewingSoon)} tone={renewingSoon ? "warning" : "ink"} />
      </div>

      <NewMembershipForm todayInput={toDateInput(now)} />

      <div className="flex flex-wrap gap-1">
        {Object.entries(FILTERS).map(([k, f]) => (
          <Link
            key={k}
            href={`/memberships?filter=${k}`}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              k === key ? "bg-ink text-white" : "text-muted hover:bg-canvas hover:text-ink"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-canvas/50 text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-3 font-medium">Member</th>
                <th className="px-4 py-3 font-medium">Tier</th>
                <th className="px-4 py-3 font-medium">Monthly</th>
                <th className="px-4 py-3 font-medium">Renews</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {members.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted">
                    No members in this view. Add one above.
                  </td>
                </tr>
              ) : (
                members.map((m) => (
                  <tr key={m.id} className="border-b border-line/60 align-top">
                    <td className="px-4 py-3">
                      <div className="font-medium text-ink">{m.memberName}</div>
                      {m.phone && <div className="text-xs text-muted">{m.phone}</div>}
                      {m.notes && <div className="mt-0.5 text-xs text-muted">{m.notes}</div>}
                    </td>
                    <td className="px-4 py-3 text-muted">{m.tier}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-ink">{money(m.monthlyAmount)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted">
                      {m.renewalDate ? formatDate(m.renewalDate) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-1.5">
                        <Badge tone={membershipStatusTone(m.status)}>{m.status}</Badge>
                        <div className="flex flex-wrap gap-1">
                          {MEMBERSHIP_STATUSES.map((s) => (
                            <form key={s} action={setMembershipStatus}>
                              <input type="hidden" name="id" value={m.id} />
                              <input type="hidden" name="status" value={s} />
                              <button
                                className={`rounded border px-1.5 py-0.5 text-[10px] ${
                                  m.status === s
                                    ? "border-ink bg-ink text-white"
                                    : "border-line text-muted hover:bg-canvas hover:text-ink"
                                }`}
                              >
                                {s}
                              </button>
                            </form>
                          ))}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <form action={deleteMembership}>
                        <input type="hidden" name="id" value={m.id} />
                        <button className="text-[11px] text-muted hover:text-danger">Remove</button>
                      </form>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
