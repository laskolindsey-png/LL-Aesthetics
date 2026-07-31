import { prisma } from "@/lib/prisma";
import { getCurrentTenantId } from "@/lib/tenant";
import { todayStart, toDateInput, formatDate } from "@/lib/dates";
import { money } from "@/lib/plans";
import { Badge } from "@/components/Badge";
import { NewPeptideOrderForm } from "@/components/NewPeptideOrderForm";
import { setPeptideStatus, updateTracking, deletePeptideOrder } from "@/lib/peptideActions";
import { PEPTIDE_STATUSES, peptideStatusTone } from "@/lib/peptideStatus";
import { PEPTIDE_PRODUCT_NAMES, PEPTIDE_PRICEBOOK } from "@/lib/peptideCatalog";
import Link from "next/link";

export const dynamic = "force-dynamic";

const FILTERS: Record<string, { label: string; statuses: string[] }> = {
  open: { label: "To Fill", statuses: ["Requested", "Approved", "Filled"] },
  transit: { label: "In Transit", statuses: ["Shipped"] },
  received: { label: "Received", statuses: ["Received"] },
  all: { label: "All", statuses: [] },
};

function Kpi({ label, value, tone = "ink" }: { label: string; value: string; tone?: "ink" | "warning" | "success" }) {
  const color = tone === "warning" ? "text-warning" : tone === "success" ? "text-success" : "text-ink";
  return (
    <div className="card p-5">
      <div className="text-xs font-medium uppercase tracking-wide text-muted">{label}</div>
      <div className={`mt-2 text-2xl font-semibold ${color}`}>{value}</div>
    </div>
  );
}

export default async function PeptidesPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; imported?: string; skipped?: string }>;
}) {
  const { filter, imported, skipped } = await searchParams;
  const key = filter && FILTERS[filter] ? filter : "open";
  const active = FILTERS[key];
  const tenantId = await getCurrentTenantId();
  const monthStart = new Date(todayStart().getFullYear(), todayStart().getMonth(), 1);

  const [orders, openCount, transitCount, receivedThisMonth, openValueRows] = await Promise.all([
    prisma.peptideOrder.findMany({
      where: active.statuses.length ? { tenantId, status: { in: active.statuses } } : { tenantId },
      orderBy: [{ createdAt: "desc" }],
    }),
    prisma.peptideOrder.count({ where: { tenantId, status: { in: ["Requested", "Approved", "Filled"] } } }),
    prisma.peptideOrder.count({ where: { tenantId, status: "Shipped" } }),
    prisma.peptideOrder.count({ where: { tenantId, status: "Received", createdAt: { gte: monthStart } } }),
    prisma.peptideOrder.findMany({
      where: { tenantId, status: { notIn: ["Received", "Cancelled"] } },
      select: { amount: true },
    }),
  ]);

  const openValue = openValueRows.reduce((s, o) => s + (o.amount ?? 0), 0);
  const products = PEPTIDE_PRODUCT_NAMES.map((value, i) => ({ id: `cat-${i}`, value }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Peptide Orders</h1>
          <p className="mt-1 text-sm text-muted">
            Enter orders here and track them through to delivery. Pick a product
            and the price fills itself.
          </p>
        </div>
        <Link href="/peptides/import" className="btn-ghost">
          Import history
        </Link>
      </div>

      {imported && (
        <div className="rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
          Imported {imported} order{imported === "1" ? "" : "s"} as completed history
          {skipped && Number(skipped) > 0 ? ` (skipped ${skipped} already on file)` : ""}.
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Kpi label="To Fill" value={String(openCount)} tone={openCount ? "warning" : "ink"} />
        <Kpi label="In Transit" value={String(transitCount)} />
        <Kpi label="Received This Month" value={String(receivedThisMonth)} tone="success" />
        <Kpi label="Open Order Value" value={money(openValue)} />
      </div>

      <NewPeptideOrderForm products={products} pricebook={PEPTIDE_PRICEBOOK} todayInput={toDateInput(todayStart())} />

      <div className="flex flex-wrap gap-1">
        {Object.entries(FILTERS).map(([k, f]) => (
          <Link
            key={k}
            href={`/peptides?filter=${k}`}
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
                <th className="px-4 py-3 font-medium">Patient</th>
                <th className="px-4 py-3 font-medium">Order</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Ship To</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Tracking</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted">
                    No orders in this view.
                  </td>
                </tr>
              ) : (
                orders.map((o) => (
                  <tr key={o.id} className="border-b border-line/60 align-top">
                    <td className="px-4 py-3">
                      <div className="font-medium text-ink">{o.patientName}</div>
                      <div className="text-xs text-muted">
                        {o.dob && `${o.dob} · `}
                        {o.orderType && o.orderType !== "New" ? o.orderType : ""}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-ink">{o.product}</div>
                      {o.dosing && <div className="text-xs text-muted">{o.dosing}</div>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted">{money(o.amount)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted">{o.shipTo}</td>
                    <td className="px-4 py-3">
                      <div className="space-y-1.5">
                        <Badge tone={peptideStatusTone(o.status)}>{o.status}</Badge>
                        <div className="flex flex-wrap gap-1">
                          {PEPTIDE_STATUSES.map((s) => (
                            <form key={s} action={setPeptideStatus}>
                              <input type="hidden" name="orderId" value={o.id} />
                              <input type="hidden" name="status" value={s} />
                              <button
                                className={`rounded border px-1.5 py-0.5 text-[10px] ${
                                  o.status === s
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
                      <form action={updateTracking} className="flex flex-wrap items-center gap-1.5">
                        <input type="hidden" name="orderId" value={o.id} />
                        <input
                          name="trackingNumber"
                          defaultValue={o.trackingNumber ?? ""}
                          className="input w-32 py-1 text-xs"
                          placeholder="Tracking #"
                        />
                        <select name="carrier" defaultValue={o.carrier ?? ""} className="input w-auto py-1 text-xs">
                          <option value="">Carrier</option>
                          <option>UPS</option>
                          <option>FedEx</option>
                          <option>USPS</option>
                          <option>Other</option>
                        </select>
                        <button className="btn-ghost py-1 text-xs">Save</button>
                      </form>
                      {o.invoice && <div className="mt-1 text-[11px] text-muted">Inv {o.invoice}</div>}
                      <form action={deletePeptideOrder} className="mt-1">
                        <input type="hidden" name="orderId" value={o.id} />
                        <button className="text-[11px] text-danger hover:underline">Delete</button>
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
