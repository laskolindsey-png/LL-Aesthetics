import { prisma } from "@/lib/prisma";
import { getCurrentTenantId } from "@/lib/tenant";
import { Badge, priorityTone } from "@/components/Badge";
import { toggleRule, deleteRule } from "@/lib/actions";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function RulesPage() {
  const tenantId = await getCurrentTenantId();
  const rules = await prisma.serviceRule.findMany({
    where: { tenantId },
    orderBy: [{ patientEvent: "asc" }, { service: "asc" }, { step: "asc" }],
  });

  const groups = new Map<string, typeof rules>();
  for (const r of rules) {
    const key = `${r.service} — ${r.patientEvent}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Service Rules</h1>
          <p className="mt-1 text-sm text-muted">
            The engine behind every follow-up. Edit timing, add steps, or pause a
            rule — changes take effect immediately for new treatments.
          </p>
        </div>
        <Link href="/rules/new" className="btn-accent">
          + Add Rule
        </Link>
      </div>

      <div className="space-y-4">
        {[...groups.entries()].map(([key, seq]) => (
          <div key={key} className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-line bg-canvas/50 px-4 py-3">
              <h2 className="text-sm font-semibold text-ink">{key}</h2>
              <span className="text-xs text-muted">
                {seq.length} step{seq.length > 1 ? "s" : ""}
                {seq[0]?.serviceCategory ? ` · ${seq[0].serviceCategory}` : ""}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-muted">
                    <th className="px-4 py-2 font-medium">Step</th>
                    <th className="px-4 py-2 font-medium">Follow-Up</th>
                    <th className="px-4 py-2 font-medium">Timing</th>
                    <th className="px-4 py-2 font-medium">Assigned</th>
                    <th className="px-4 py-2 font-medium">Priority</th>
                    <th className="px-4 py-2 font-medium">On</th>
                    <th className="px-4 py-2 font-medium text-right">Edit</th>
                  </tr>
                </thead>
                <tbody>
                  {seq.map((r) => (
                    <tr key={r.id} className="border-t border-line/60">
                      <td className="px-4 py-2 text-muted">{r.step}</td>
                      <td className="px-4 py-2 text-ink">{r.workflowStep}</td>
                      <td className="px-4 py-2 text-muted">
                        {r.delayDays === 0 ? "Same day" : `+${r.delayDays} days`}
                      </td>
                      <td className="px-4 py-2 text-muted">{r.assignedTo}</td>
                      <td className="px-4 py-2">
                        <Badge tone={priorityTone(r.priority)}>{r.priority}</Badge>
                      </td>
                      <td className="px-4 py-2">
                        <form action={toggleRule}>
                          <input type="hidden" name="ruleId" value={r.id} />
                          <button
                            className={`text-xs font-medium ${r.active ? "text-success" : "text-muted"}`}
                          >
                            {r.active ? "● On" : "○ Off"}
                          </button>
                        </form>
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center justify-end gap-3">
                          <Link href={`/rules/${r.id}/edit`} className="text-xs text-accent hover:underline">
                            Edit
                          </Link>
                          <form action={deleteRule}>
                            <input type="hidden" name="ruleId" value={r.id} />
                            <button className="text-xs text-danger hover:underline">Delete</button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
