import { prisma } from "@/lib/prisma";
import { getCurrentTenantId } from "@/lib/tenant";
import { formatDate } from "@/lib/dates";
import { Badge } from "@/components/Badge";
import { NewLeadForm } from "@/components/NewLeadForm";
import { markLeadBooked } from "@/lib/leadActions";
import { stageTone } from "@/lib/leadStage";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ show?: string }>;
}) {
  const { show } = await searchParams;
  const showAll = show === "all";
  const tenantId = await getCurrentTenantId();

  const [sources, assignees, leads] = await Promise.all([
    prisma.setting.findMany({ where: { tenantId, type: "LeadSource", active: true }, orderBy: { sortOrder: "asc" } }),
    prisma.setting.findMany({ where: { tenantId, type: "AssignedTo", active: true }, orderBy: { sortOrder: "asc" } }),
    prisma.lead.findMany({
      where: showAll ? { tenantId } : { tenantId, stage: { notIn: ["Booked", "Lost"] }, archivedAt: null },
      include: { tasks: { orderBy: { dueDate: "asc" } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const bookedCount = await prisma.lead.count({ where: { tenantId, stage: "Booked" } });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Leads</h1>
          <p className="mt-1 text-sm text-muted">
            Prospective patients who haven&apos;t booked yet. Track how they found
            you and move them through to a booking.
          </p>
        </div>
        <div className="text-right text-xs text-muted">
          <div>{bookedCount} booked all-time</div>
          <Link href={showAll ? "/leads" : "/leads?show=all"} className="text-accent hover:underline">
            {showAll ? "Show active only" : "Show booked & lost"}
          </Link>
        </div>
      </div>

      <NewLeadForm sources={sources} assignees={assignees} />

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-canvas/50 text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-3 font-medium">Lead</th>
                <th className="px-4 py-3 font-medium">Source</th>
                <th className="px-4 py-3 font-medium">Stage</th>
                <th className="px-4 py-3 font-medium">Next Step</th>
                <th className="px-4 py-3 font-medium">Progress</th>
                <th className="px-4 py-3 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {leads.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted">
                    {showAll ? "No leads yet." : "No active leads. Add one above."}
                  </td>
                </tr>
              ) : (
                leads.map((l) => {
                  const done = l.tasks.filter((t) => t.status === "Completed").length;
                  const total = l.tasks.length;
                  const next = l.tasks.find((t) => t.status !== "Completed" && t.status !== "Cancelled");
                  const closed = l.stage === "Booked" || l.stage === "Lost";
                  return (
                    <tr key={l.id} className="border-b border-line/60 hover:bg-canvas/40">
                      <td className="px-4 py-3">
                        <Link href={`/leads/${l.id}`} className="font-medium text-ink hover:underline">
                          {l.name}
                        </Link>
                        <div className="text-xs text-muted">{l.phone || l.email || ""}</div>
                      </td>
                      <td className="px-4 py-3 text-muted">{l.source || "—"}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge tone={stageTone(l.stage)}>{l.stage}</Badge>
                          {l.contactHold && (
                            <span title={l.contactHold} className="text-xs">
                              {l.contactHold === "Do Not Contact" ? "🚫" : "⏸"}
                            </span>
                          )}
                          {l.responseStatus === "No response" && (
                            <span title="No response yet" className="text-xs text-[#9a6f28]">
                              ⚠
                            </span>
                          )}
                          {l.archivedAt && <Badge tone="neutral">Archived</Badge>}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {next ? (
                          <span>
                            {next.workflowStep}
                            <span className="ml-1 text-xs text-muted">· {formatDate(next.dueDate)}</span>
                          </span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-muted">{done}/{total} steps</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-3">
                          {!closed && (
                            <form action={markLeadBooked}>
                              <input type="hidden" name="leadId" value={l.id} />
                              <button className="btn-primary py-1 text-xs">Booked ✓</button>
                            </form>
                          )}
                          <Link href={`/leads/${l.id}`} className="text-xs text-accent hover:underline">
                            View →
                          </Link>
                        </div>
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
