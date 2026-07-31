import { prisma } from "@/lib/prisma";
import { getCurrentTenantId } from "@/lib/tenant";
import { TEMPLATE_TOKENS } from "@/lib/templates";
import { updateMessageTemplate, fillStarterMessages } from "@/lib/messageActions";
import { ChloeTemplateField } from "@/components/ChloeTemplateField";
import { hasChloeBrain } from "@/lib/chloe";

export const dynamic = "force-dynamic";

export default async function MessagesPage() {
  const tenantId = await getCurrentTenantId();
  const templates = await prisma.messageTemplate.findMany({
    where: { tenantId },
    orderBy: [{ name: "asc" }],
  });
  const emptyCount = templates.filter((t) => !t.body?.trim()).length;
  const chloeReady = hasChloeBrain();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Messages</h1>
          <p className="mt-1 text-sm text-muted">
            The wording for each automatic follow-up. Write it once here, and every
            task shows the message ready to review and send.{" "}
            {chloeReady && (
              <span>
                Want it warmer? Tap <strong>Write in Chloe&apos;s voice</strong> on any
                template and she&apos;ll rewrite it (keeping your tags).
              </span>
            )}
          </p>
        </div>
        {emptyCount > 0 && (
          <form action={fillStarterMessages}>
            <button className="btn-accent">Fill in starter messages ({emptyCount})</button>
          </form>
        )}
      </div>

      {/* Merge-field legend */}
      <div className="card p-4">
        <div className="text-xs font-medium uppercase tracking-wide text-muted">
          Personalization tags — type these and they fill in automatically
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {TEMPLATE_TOKENS.map((t) => (
            <span key={t.token} className="rounded-lg border border-line bg-canvas/50 px-2.5 py-1 text-xs">
              <code className="text-accent">{t.token}</code>
              <span className="ml-1.5 text-muted">{t.desc}</span>
            </span>
          ))}
        </div>
      </div>

      {templates.length === 0 ? (
        <div className="card p-10 text-center text-sm text-muted">
          No message templates yet. They&apos;re created from your Service Rules.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {templates.map((t) => (
            <form key={t.id} action={updateMessageTemplate} className="card p-5">
              <input type="hidden" name="id" value={t.id} />
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-ink">{t.name}</h2>
                <select
                  name="channel"
                  defaultValue={t.channel}
                  className="input w-auto py-1 text-xs"
                >
                  <option>SMS</option>
                  <option>Email</option>
                </select>
              </div>
              {chloeReady ? (
                <ChloeTemplateField
                  templateId={t.id}
                  name="body"
                  defaultValue={t.body}
                  placeholder="Write this message… use the tags above to personalize."
                />
              ) : (
                <textarea
                  name="body"
                  defaultValue={t.body}
                  rows={4}
                  className="input mt-3 text-sm"
                  placeholder="Write this message… use the tags above to personalize."
                />
              )}
              <div className="mt-3 flex items-center justify-between">
                {!t.body?.trim() ? (
                  <span className="text-xs text-warning">Not written yet</span>
                ) : (
                  <span className="text-xs text-success">Ready</span>
                )}
                <button className="btn-primary py-1.5 text-xs">Save</button>
              </div>
            </form>
          ))}
        </div>
      )}
    </div>
  );
}
