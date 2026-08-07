import { prisma } from "@/lib/prisma";
import { getCurrentTenantId } from "@/lib/tenant";
import { getSessionUser } from "@/lib/currentUser";
import { money } from "@/lib/plans";
import { formatDate, toDateInput, todayStart } from "@/lib/dates";
import { periodRange, expenseOccurrences, EXPENSE_CATEGORIES, type FinancePeriod } from "@/lib/finance";
import { createExpense, deleteExpense } from "@/lib/financeActions";
import { FinanceTabs } from "@/components/FinanceTabs";
import { redirect } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

// Personal spending pulled from the business account (personal charges + owner
// draws). Kept out of the business P&L — this page is just so Lindsey can see
// how much she's spending personally.
const PERSONAL_CATEGORIES = ["Personal", "Owner Activity"];

export default async function PersonalPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const me = await getSessionUser();
  if (!me) redirect("/login");
  if (me.role !== "owner") redirect("/");

  const { period: periodRaw } = await searchParams;
  const period: FinancePeriod = periodRaw === "month" ? "month" : "year";
  const tenantId = await getCurrentTenantId();
  const today = todayStart();
  const { start, end, label } = periodRange(period, today);

  const entries = await prisma.expenseEntry.findMany({
    where: {
      tenantId,
      category: { in: PERSONAL_CATEGORIES },
      OR: [
        { recurring: false, date: { gte: start, lt: end } },
        { recurring: true, date: { lt: end } },
      ],
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });

  // Expand recurring across the period, total, and group by subcategory.
  const bySub = new Map<string, number>();
  let total = 0;
  const rows: { id: string; date: Date; vendor: string | null; subcategory: string | null; amount: number }[] = [];
  for (const e of entries) {
    const occ = expenseOccurrences(e.date, e.recurring, start, end, today);
    if (occ <= 0) continue;
    const amt = e.amount * occ;
    total += amt;
    const sub = e.subcategory || "Other";
    bySub.set(sub, (bySub.get(sub) ?? 0) + amt);
    rows.push({ id: e.id, date: e.date, vendor: e.vendor, subcategory: e.subcategory, amount: amt });
  }
  const subTop = [...bySub.entries()].sort((a, b) => b[1] - a[1]);
  const personalSubs = EXPENSE_CATEGORIES["Personal"];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Personal</h1>
          <p className="mt-1 text-sm text-muted">
            What you&apos;re spending <em>personally</em> from the business account. This is kept
            <strong> out</strong> of your business expenses and profit — it&apos;s here just so you can see it.
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
              href={`/finances/personal?period=${p}`}
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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="card p-5">
          <div className="text-[11px] font-medium uppercase tracking-wide text-muted">Personal Spending</div>
          <div className="mt-1.5 text-2xl font-semibold text-ink">{money(total)}</div>
          <div className="mt-1 text-xs text-muted">{label}</div>
        </div>
        <div className="card p-5 md:col-span-2">
          <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted">Where it goes</div>
          {subTop.length === 0 ? (
            <p className="py-2 text-sm text-muted">No personal spending recorded this period.</p>
          ) : (
            <ul className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
              {subTop.map(([sub, amt]) => (
                <li key={sub} className="flex items-center justify-between">
                  <span className="text-ink">{sub}</span>
                  <span className="font-medium text-ink">{money(amt)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Add a personal expense (category is fixed to Personal). */}
      <form action={createExpense} className="card grid gap-3 p-5 md:grid-cols-6">
        <input type="hidden" name="category" value="Personal" />
        <div>
          <label className="label">Date</label>
          <input type="date" name="date" className="input" defaultValue={toDateInput(todayStart())} required />
        </div>
        <div className="md:col-span-2">
          <label className="label">What / where</label>
          <input name="vendor" className="input" placeholder="e.g. Target, kids activity" />
        </div>
        <div className="md:col-span-2">
          <label className="label">Type</label>
          <input name="subcategory" className="input" list="personal-subs" placeholder="e.g. Kids, Dining" />
          <datalist id="personal-subs">
            {personalSubs.map((s) => <option key={s} value={s} />)}
          </datalist>
        </div>
        <div>
          <label className="label">Amount</label>
          <input name="amount" type="number" step="0.01" className="input" placeholder="0.00" required />
        </div>
        <div className="md:col-span-6 flex justify-end">
          <button className="btn-primary">Add personal expense</button>
        </div>
      </form>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-canvas/50 text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">What</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-muted">Nothing personal recorded yet. Tag a charge as <strong>Personal</strong> on the Expenses tab and it&apos;ll show here.</td></tr>
              ) : (
                rows.map((e) => (
                  <tr key={e.id} className="border-b border-line/60">
                    <td className="px-4 py-3 whitespace-nowrap text-muted">{formatDate(e.date)}</td>
                    <td className="px-4 py-3 text-ink">{e.vendor ?? "—"}</td>
                    <td className="px-4 py-3 text-muted">{e.subcategory ?? "—"}</td>
                    <td className="px-4 py-3 whitespace-nowrap font-medium text-ink">{money(e.amount)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <Link href={`/finances/expenses?edit=${e.id}`} className="text-xs text-accent hover:underline">Edit</Link>
                        <form action={deleteExpense}>
                          <input type="hidden" name="id" value={e.id} />
                          <button className="text-xs text-danger hover:underline">Remove</button>
                        </form>
                      </div>
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
