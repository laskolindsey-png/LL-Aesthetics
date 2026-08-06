import { prisma } from "@/lib/prisma";
import { getCurrentTenantId } from "@/lib/tenant";
import { getSessionUser } from "@/lib/currentUser";
import { money } from "@/lib/plans";
import { formatDate, toDateInput, todayStart } from "@/lib/dates";
import { REVENUE_CATEGORIES } from "@/lib/finance";
import { createRevenue, deleteRevenue, importMindbodyRevenueCsv } from "@/lib/financeActions";
import { FinanceTabs } from "@/components/FinanceTabs";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const IMPORT_ERRORS: Record<string, string> = {
  nofile: "No file was selected. Choose your exported .csv and try again.",
  empty: "That file looked empty — make sure it has a header row plus your sales.",
  cols: "Couldn't find a date and amount column. Check the report has Sale Date and a total/amount column.",
};

export default async function RevenuePage({
  searchParams,
}: {
  searchParams: Promise<{ imported?: string; skipped?: string; error?: string }>;
}) {
  const me = await getSessionUser();
  if (!me) redirect("/login");
  if (me.role !== "owner") redirect("/");
  const { imported, skipped, error } = await searchParams;
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

      {imported !== undefined && (
        <div className="rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
          Imported {imported} sale{imported === "1" ? "" : "s"} from Mindbody.
          {skipped && skipped !== "0" ? ` Skipped ${skipped} membership line${skipped === "1" ? "" : "s"} (counted automatically on the Dashboard).` : ""}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {IMPORT_ERRORS[error] ?? "Something went wrong with that file. Please try again."}
        </div>
      )}

      {/* Import a Mindbody Sales report (Export to Excel → save as CSV). */}
      <div className="card border-dashed p-5">
        <h2 className="text-sm font-semibold text-ink">Import from a Mindbody Sales report</h2>
        <p className="mt-1 text-xs text-muted">
          In Mindbody: Reports → Sales → <strong>Sales</strong>, pick your dates, then{" "}
          <strong>Export to Excel</strong> and save it as a <strong>CSV</strong>. Upload it here and each
          sale becomes revenue. Membership lines are skipped (they&apos;re already counted on the Dashboard).
          Re-uploading the same report is safe — it replaces, it doesn&apos;t double.
        </p>
        <form action={importMindbodyRevenueCsv} className="mt-3 flex flex-wrap items-center gap-3">
          <input
            type="file"
            name="file"
            accept=".csv,text/csv"
            required
            className="block text-sm text-ink file:mr-3 file:rounded-lg file:border-0 file:bg-ink file:px-3 file:py-1.5 file:text-sm file:text-white hover:file:bg-ink/90"
          />
          <button className="btn-accent">Import sales</button>
        </form>
      </div>

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
                    <td className="px-4 py-3 text-ink">
                      {e.category}
                      {e.source && (
                        <span className="ml-1.5 rounded bg-canvas px-1.5 py-0.5 text-[10px] text-muted">
                          {e.source.replace(/^Mindbody /, "MB ")}
                        </span>
                      )}
                    </td>
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
