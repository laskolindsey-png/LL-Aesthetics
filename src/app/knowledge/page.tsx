import { prisma } from "@/lib/prisma";
import { getCurrentTenantId } from "@/lib/tenant";
import { KNOWLEDGE_CATEGORIES, CATEGORY_HINT } from "@/lib/knowledgeStarters";
import {
  createKnowledgeEntry,
  updateKnowledgeEntry,
  deleteKnowledgeEntry,
  fillStarterKnowledge,
} from "@/lib/knowledgeActions";

export const dynamic = "force-dynamic";

const CATEGORY_LABEL: Record<string, string> = {
  Service: "Services",
  FAQ: "FAQs",
  Aftercare: "Aftercare",
  Policy: "Policies",
  Pricing: "Pricing",
  Membership: "Membership",
  Promotion: "Promotions",
};

export default async function KnowledgePage() {
  const tenantId = await getCurrentTenantId();
  const entries = await prisma.knowledgeEntry.findMany({
    where: { tenantId },
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { title: "asc" }],
  });
  const total = entries.length;
  const unfilled = entries.filter((e) => !e.content.trim()).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Chloe&apos;s Knowledge Base</h1>
          <p className="mt-1 text-sm text-muted">
            What Chloe knows. She answers <strong>only</strong> from here — so fill it
            with your real services, answers, and policies. Blank means she&apos;ll
            defer to a human instead of guessing.
          </p>
        </div>
        {total === 0 && (
          <form action={fillStarterKnowledge}>
            <button className="btn-accent">Create starter knowledge</button>
          </form>
        )}
      </div>

      {total > 0 && unfilled > 0 && (
        <div className="rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-ink">
          {unfilled} of {total} entries are still blank. The more you fill in, the
          more Chloe can answer on her own.
        </div>
      )}

      {/* Add a new entry */}
      <form action={createKnowledgeEntry} className="card flex flex-wrap items-end gap-3 p-5">
        <div>
          <label className="label">Category</label>
          <select name="category" className="input w-auto" defaultValue="FAQ">
            {KNOWLEDGE_CATEGORIES.map((c) => (
              <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-[220px]">
          <label className="label">Title / question</label>
          <input name="title" className="input" placeholder="e.g. How long does filler last?" required />
        </div>
        <button className="btn-primary">Add entry</button>
      </form>

      {total === 0 ? (
        <div className="card p-10 text-center text-sm text-muted">
          Nothing yet. Click <strong>Create starter knowledge</strong> to lay down the
          common services, FAQs, and policies to fill in.
        </div>
      ) : (
        KNOWLEDGE_CATEGORIES.filter((c) => entries.some((e) => e.category === c)).map((cat) => (
          <div key={cat} className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink">
              {CATEGORY_LABEL[cat]}
            </h2>
            <div className="grid gap-3 md:grid-cols-2">
              {entries
                .filter((e) => e.category === cat)
                .map((e) => (
                  <form key={e.id} action={updateKnowledgeEntry} className="card p-4">
                    <input type="hidden" name="id" value={e.id} />
                    <input
                      name="title"
                      defaultValue={e.title}
                      className="input text-sm font-medium"
                    />
                    <textarea
                      name="content"
                      defaultValue={e.content}
                      rows={4}
                      className="input mt-2 text-sm"
                      placeholder={CATEGORY_HINT[cat] ?? "Answer in Chloe's voice…"}
                    />
                    <div className="mt-2 flex items-center justify-between">
                      {e.content.trim() ? (
                        <span className="text-xs text-success">Filled</span>
                      ) : (
                        <span className="text-xs text-warning">Blank</span>
                      )}
                      <div className="flex items-center gap-3">
                        <button className="btn-primary py-1.5 text-xs">Save</button>
                      </div>
                    </div>
                    <div className="mt-1 text-right">
                      <button
                        formAction={deleteKnowledgeEntry}
                        className="text-[11px] text-muted hover:text-danger"
                      >
                        Remove
                      </button>
                    </div>
                  </form>
                ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
