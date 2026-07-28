import { prisma } from "@/lib/prisma";
import { getCurrentTenantId } from "@/lib/tenant";
import { addSetting, deleteSetting } from "@/lib/actions";

export const dynamic = "force-dynamic";

const LABELS: Record<string, string> = {
  Provider: "Providers",
  AssignedTo: "Assigned To",
  PatientEvent: "Patient Events",
  Service: "Services",
  WorkflowStep: "Workflow Steps",
  Priority: "Priority Levels",
  Status: "Statuses",
  ActionResult: "Action Results",
  ServiceCategory: "Service Categories",
  Anchor: "Anchor Dates",
  LeadSource: "Lead Sources",
  PeptideProduct: "Peptide Products",
};

const ORDER = Object.keys(LABELS);

export default async function SettingsPage() {
  const tenantId = await getCurrentTenantId();
  const settings = await prisma.setting.findMany({
    where: { tenantId },
    orderBy: [{ type: "asc" }, { sortOrder: "asc" }],
  });

  const grouped = new Map<string, typeof settings>();
  for (const s of settings) {
    if (!grouped.has(s.type)) grouped.set(s.type, []);
    grouped.get(s.type)!.push(s);
  }
  const types = ORDER.filter((t) => grouped.has(t));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Settings</h1>
        <p className="mt-1 text-sm text-muted">
          The dropdown lists that power the whole system. Add or remove options
          here and they update everywhere.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {types.map((type) => (
          <div key={type} className="card p-5">
            <h2 className="mb-3 text-sm font-semibold text-ink">{LABELS[type]}</h2>

            <div className="flex flex-wrap gap-1.5">
              {grouped.get(type)!.map((s) => (
                <span
                  key={s.id}
                  className="inline-flex items-center gap-1.5 rounded-full border border-line bg-canvas px-2.5 py-0.5 text-xs text-ink"
                >
                  {s.value}
                  <form action={deleteSetting}>
                    <input type="hidden" name="settingId" value={s.id} />
                    <button
                      className="text-muted hover:text-danger"
                      title={`Remove ${s.value}`}
                      aria-label={`Remove ${s.value}`}
                    >
                      ×
                    </button>
                  </form>
                </span>
              ))}
            </div>

            <form action={addSetting} className="mt-3 flex gap-2">
              <input type="hidden" name="type" value={type} />
              <input
                name="value"
                className="input py-1.5 text-sm"
                placeholder={`Add ${LABELS[type].replace(/s$/, "").toLowerCase()}…`}
              />
              <button className="btn-ghost py-1.5 text-xs">Add</button>
            </form>
          </div>
        ))}
      </div>
    </div>
  );
}
