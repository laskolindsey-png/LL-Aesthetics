import { prisma } from "@/lib/prisma";
import { getCurrentTenantId } from "@/lib/tenant";
import { Badge } from "@/components/Badge";
import { createPatient } from "@/lib/actions";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function PatientsPage() {
  const tenantId = await getCurrentTenantId();
  const patients = await prisma.patient.findMany({
    where: { tenantId },
    orderBy: { name: "asc" },
    include: {
      records: {
        include: { tasks: { where: { status: { not: "Completed" } } } },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Patients</h1>
        <p className="mt-1 text-sm text-muted">
          Everyone in the system, with their open follow-ups. Most patients add
          themselves automatically from Mindbody — use the form below to add
          someone who isn&apos;t in Mindbody yet.
        </p>
      </div>

      {/* Add a patient by hand (e.g. to upload an Aura scan before their first visit). */}
      <details className="card p-4">
        <summary className="cursor-pointer text-sm font-medium text-ink">
          + Add a patient
        </summary>
        <form action={createPatient} className="mt-4 grid gap-3 md:grid-cols-4">
          <div className="md:col-span-2">
            <label className="label">Name</label>
            <input name="name" required className="input" placeholder="First Last" />
          </div>
          <div>
            <label className="label">Phone (optional)</label>
            <input name="phone" className="input" placeholder="(903) 555-0123" />
          </div>
          <div>
            <label className="label">Email (optional)</label>
            <input name="email" type="email" className="input" placeholder="name@email.com" />
          </div>
          <div className="md:col-span-4 flex justify-end">
            <button className="btn-primary">Add patient</button>
          </div>
        </form>
      </details>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-canvas/50 text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-4 py-3 font-medium">Patient</th>
              <th className="px-4 py-3 font-medium">Treatments</th>
              <th className="px-4 py-3 font-medium">Open Follow-ups</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {patients.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-muted">
                  No patients yet.
                </td>
              </tr>
            ) : (
              patients.map((p) => {
                const open = p.records.reduce((a, r) => a + r.tasks.length, 0);
                return (
                  <tr key={p.id} className="border-b border-line/60 hover:bg-canvas/40">
                    <td className="px-4 py-3">
                      <Link href={`/patients/${p.id}`} className="font-medium text-ink hover:underline">
                        {p.name}
                      </Link>
                      {p.isDemo && (
                        <span className="ml-2 text-xs text-muted">(demo)</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted">{p.records.length}</td>
                    <td className="px-4 py-3">
                      {open > 0 ? <Badge tone="accent">{open}</Badge> : <span className="text-muted">0</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/patients/${p.id}`} className="text-xs text-accent hover:underline">
                        View history →
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
