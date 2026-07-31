import { prisma } from "@/lib/prisma";
import { getCurrentTenantId } from "@/lib/tenant";
import { getSessionUser } from "@/lib/currentUser";
import { money } from "@/lib/plans";
import { formatDate, toDateInput, todayStart } from "@/lib/dates";
import { REVENUE_CATEGORIES } from "@/lib/finance";
import { createRevenue, deleteRevenue } from "@/lib/financeActions";
import { FinanceTabs } from "@/components/FinanceTabs";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function RevenuePage() {
  const me = await getSessionUser();
  if (!me) redirect("/login");
  if (me.role !== "owner") redirect("/");
  const tenantId = await getCurrentTenantId();

  const entries = await prisma.revenueEntry.findMany({
    where: { tenantId },
    orderBy: [{ periodStart: "desc" }, { createdAt: "desc" }],
    take: 100,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Revenue</h1>
        <p className="mt-1 text-sm text-muted">
          Log revenue by category. Membership and completed-treatment revenue are counted
          automatically on the Dashboard — use this for anything not already tracked (retail, one-offs).
        </p>
      </div>

      <FinanceTabs />

      <form action={createRevenue} className="card grid gap-3 p-5 md:grid-cols-6">
        <div className="md:col-span-1">
          <label className="label">Date</label>
          <input type="date" name="periodStart" className="input" defaultValue={toDateInput(todayStart())} required />
        </div>
        <div className="md:col-span-2">
          <label className="label">Category</label>
          <select name="category" className="input" defaultValue="Service Revenue">
            {REVENUE_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="label">Description</label>
          <input name="description" className="input" placeholder="(optional)" />
        </div>
        <div className="md:col-span-1">
          <label className="label">Amount</label>
          <input name="amount" type="number" step="0.01" className="input" placeholder="0.00" required />
        </div>
        <div className="md:col-span-6 flex justify-end">
          <button className="btn-primary">Add Revenue</button>
        </div>
      </form>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-canvas/50 text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Description</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-muted">No revenue entries yet.</td></tr>
              ) : (
                entries.map((e) => (
                  <tr key={e.id} className="border-b border-line/60">
                    <td className="px-4 py-3 whitespace-nowrap text-muted">{formatDate(e.periodStart)}</td>
                    <td className="px-4 py-3 text-ink">{e.category}</td>
                    <td className="px-4 py-3 text-muted">{e.description ?? "—"}</td>
                    <td className="px-4 py-3 whitespace-nowrap font-medium text-success">{money(e.amount)}</td>
                    <td className="px-4 py-3 text-right">
                      <form action={deleteRevenue}>
                        <input type="hidden" name="id" value={e.id} />
                        <button className="text-xs text-danger hover:underline">Remove</button>
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
