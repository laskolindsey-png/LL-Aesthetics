import { prisma } from "@/lib/prisma";
import { getCurrentTenantId } from "@/lib/tenant";
import { getSessionUser } from "@/lib/currentUser";
import { money } from "@/lib/plans";
import { formatDate, toDateInput, todayStart } from "@/lib/dates";
import { EXPENSE_CATEGORY_NAMES } from "@/lib/finance";
import { createExpense, deleteExpense } from "@/lib/financeActions";
import { FinanceTabs } from "@/components/FinanceTabs";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ExpensesPage() {
  const me = await getSessionUser();
  if (!me) redirect("/login");
  if (me.role !== "owner") redirect("/");
  const tenantId = await getCurrentTenantId();

  const [entries, vendors] = await Promise.all([
    prisma.expenseEntry.findMany({
      where: { tenantId },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 100,
    }),
    prisma.vendor.findMany({ where: { tenantId }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Expenses</h1>
        <p className="mt-1 text-sm text-muted">
          Log what you spend. Pick a known vendor to pre-fill its category, or type a new one.
        </p>
      </div>

      <FinanceTabs />

      <form action={createExpense} className="card grid gap-3 p-5 md:grid-cols-6">
        <div>
          <label className="label">Date</label>
          <input type="date" name="date" className="input" defaultValue={toDateInput(todayStart())} required />
        </div>
        <div className="md:col-span-2">
          <label className="label">Vendor</label>
          <input name="vendor" className="input" list="vendor-list" placeholder="e.g. Allergan" />
          <datalist id="vendor-list">
            {vendors.map((v) => <option key={v.id} value={v.name} />)}
          </datalist>
        </div>
        <div className="md:col-span-2">
          <label className="label">Description</label>
          <input name="description" className="input" placeholder="(optional)" />
        </div>
        <div>
          <label className="label">Amount</label>
          <input name="amount" type="number" step="0.01" className="input" placeholder="0.00" required />
        </div>
        <div className="md:col-span-2">
          <label className="label">Category</label>
          <select name="category" className="input" defaultValue="Operating">
            {EXPENSE_CATEGORY_NAMES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="label">Subcategory</label>
          <input name="subcategory" className="input" placeholder="e.g. Injectables, Software" />
        </div>
        <label className="flex items-center gap-2 self-end text-sm text-ink md:col-span-1">
          <input type="checkbox" name="recurring" className="h-4 w-4" /> Recurring
        </label>
        <div className="md:col-span-1 flex items-end justify-end">
          <button className="btn-primary">Add Expense</button>
        </div>
      </form>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-canvas/50 text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Vendor</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-muted">No expenses logged yet.</td></tr>
              ) : (
                entries.map((e) => (
                  <tr key={e.id} className="border-b border-line/60">
                    <td className="px-4 py-3 whitespace-nowrap text-muted">{formatDate(e.date)}</td>
                    <td className="px-4 py-3 text-ink">
                      {e.vendor ?? "—"}
                      {e.recurring && <span className="ml-1.5 rounded bg-blush/40 px-1.5 py-0.5 text-[10px] text-clay">recurring</span>}
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {e.category}{e.subcategory ? ` · ${e.subcategory}` : ""}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap font-medium text-danger">{money(e.amount)}</td>
                    <td className="px-4 py-3 text-right">
                      <form action={deleteExpense}>
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
