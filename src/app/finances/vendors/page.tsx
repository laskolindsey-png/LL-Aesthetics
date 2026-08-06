import { prisma } from "@/lib/prisma";
import { getCurrentTenantId } from "@/lib/tenant";
import { getSessionUser } from "@/lib/currentUser";
import { money } from "@/lib/plans";
import { formatDate } from "@/lib/dates";
import { EXPENSE_CATEGORY_NAMES } from "@/lib/finance";
import { createVendor, editVendor, deleteVendor } from "@/lib/financeActions";
import { FinanceTabs } from "@/components/FinanceTabs";
import { redirect } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function VendorsPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const me = await getSessionUser();
  if (!me) redirect("/login");
  if (me.role !== "owner") redirect("/");
  const { edit } = await searchParams;
  const tenantId = await getCurrentTenantId();

  const [vendors, expenses] = await Promise.all([
    prisma.vendor.findMany({ where: { tenantId }, orderBy: { name: "asc" } }),
    prisma.expenseEntry.findMany({
      where: { tenantId, vendor: { not: null } },
      select: { vendor: true, amount: true, date: true },
    }),
  ]);

  // Aggregate spend per vendor name.
  const agg = new Map<string, { total: number; count: number; last: Date }>();
  for (const e of expenses) {
    const name = (e.vendor ?? "").trim();
    if (!name) continue;
    const cur = agg.get(name) ?? { total: 0, count: 0, last: e.date };
    cur.total += e.amount;
    cur.count += 1;
    if (e.date > cur.last) cur.last = e.date;
    agg.set(name, cur);
  }
  const analysis = [...agg.entries()].sort((a, b) => b[1].total - a[1].total);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Vendors</h1>
        <p className="mt-1 text-sm text-muted">
          Who you pay, how much, and how often — plus account numbers and login notes for
          your suppliers and bills. Add a default category so expenses tag faster.
        </p>
      </div>

      <FinanceTabs />

      <form action={createVendor} className="card grid gap-3 p-5 md:grid-cols-4">
        <div>
          <label className="label">Vendor / bill name</label>
          <input name="name" className="input" placeholder="e.g. Galderma, City Water" required />
        </div>
        <div>
          <label className="label">Default category</label>
          <select name="defaultCategory" className="input" defaultValue="">
            <option value="">—</option>
            {EXPENSE_CATEGORY_NAMES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Default subcategory</label>
          <input name="defaultSubcategory" className="input" placeholder="(optional)" />
        </div>
        <div>
          <label className="label">Account #</label>
          <input name="accountNumber" className="input" placeholder="(optional)" />
        </div>
        <div className="md:col-span-3">
          <label className="label">Notes / login (no passwords)</label>
          <input name="notes" className="input" placeholder="Username, portal URL, phone # — keep real passwords in a password manager" />
        </div>
        <div className="flex items-end justify-end">
          <button className="btn-primary">Add Vendor</button>
        </div>
      </form>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-ink">Vendor Analysis</h2>
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-canvas/50 text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-4 py-3 font-medium">Vendor</th>
                  <th className="px-4 py-3 font-medium">Total Paid</th>
                  <th className="px-4 py-3 font-medium">Transactions</th>
                  <th className="px-4 py-3 font-medium">Last Purchase</th>
                </tr>
              </thead>
              <tbody>
                {analysis.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-muted">No vendor spend recorded yet.</td></tr>
                ) : (
                  analysis.map(([name, v]) => (
                    <tr key={name} className="border-b border-line/60">
                      <td className="px-4 py-3 text-ink">{name}</td>
                      <td className="px-4 py-3 whitespace-nowrap font-medium text-ink">{money(v.total)}</td>
                      <td className="px-4 py-3 text-muted">{v.count}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-muted">{formatDate(v.last)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {vendors.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-ink">Saved Vendors &amp; Accounts</h2>
          <div className="grid gap-2 md:grid-cols-2">
            {vendors.map((v) =>
              edit === v.id ? (
                <div key={v.id} className="card p-3 text-sm md:col-span-2">
                  <form action={editVendor} className="grid gap-2 md:grid-cols-4">
                    <input type="hidden" name="id" value={v.id} />
                    <input name="name" className="input py-1.5 text-sm" defaultValue={v.name} placeholder="Name" required />
                    <select name="defaultCategory" className="input py-1.5 text-sm" defaultValue={v.defaultCategory ?? ""}>
                      <option value="">—</option>
                      {EXPENSE_CATEGORY_NAMES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <input name="defaultSubcategory" className="input py-1.5 text-sm" defaultValue={v.defaultSubcategory ?? ""} placeholder="Subcategory" />
                    <input name="accountNumber" className="input py-1.5 text-sm" defaultValue={v.accountNumber ?? ""} placeholder="Account #" />
                    <input name="notes" className="input py-1.5 text-sm md:col-span-4" defaultValue={v.notes ?? ""} placeholder="Notes / login (no passwords)" />
                    <div className="flex items-center gap-3 md:col-span-4">
                      <button className="btn-primary py-1.5 text-sm">Save</button>
                      <Link href="/finances/vendors" className="text-sm text-muted hover:text-ink">Cancel</Link>
                    </div>
                  </form>
                </div>
              ) : (
                <div key={v.id} className="card p-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-medium text-ink">{v.name}</span>
                      {v.defaultCategory && (
                        <span className="ml-2 text-xs text-muted">
                          {v.defaultCategory}{v.defaultSubcategory ? ` · ${v.defaultSubcategory}` : ""}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <Link href={`/finances/vendors?edit=${v.id}`} className="text-xs text-accent hover:underline">Edit</Link>
                      <form action={deleteVendor}>
                        <input type="hidden" name="id" value={v.id} />
                        <button className="text-xs text-danger hover:underline">Remove</button>
                      </form>
                    </div>
                  </div>
                  {(v.accountNumber || v.notes) && (
                    <div className="mt-1.5 space-y-0.5 text-xs text-muted">
                      {v.accountNumber && <div>Acct # <span className="text-ink">{v.accountNumber}</span></div>}
                      {v.notes && <div>{v.notes}</div>}
                    </div>
                  )}
                </div>
              )
            )}
          </div>
        </section>
      )}
    </div>
  );
}
