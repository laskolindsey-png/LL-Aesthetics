import { getSessionUser } from "@/lib/currentUser";
import { hasChloeBrain, CHLOE_PERSONA } from "@/lib/chloe";
import { Badge } from "@/components/Badge";
import { redirect } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ChloePage() {
  const me = await getSessionUser();
  if (!me) redirect("/login");
  if (me.role !== "owner") redirect("/");

  const connected = hasChloeBrain();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Chloe</h1>
          <p className="mt-1 text-sm text-muted">
            Your AI concierge. Phase 1: Chloe drafts your follow-ups in her voice —
            you review and send. Owner-only.
          </p>
        </div>
        <Badge tone={connected ? "success" : "warning"}>
          {connected ? "Brain connected" : "Brain not connected"}
        </Badge>
      </div>

      {/* Status / setup */}
      <div className="card p-6">
        <h2 className="text-sm font-semibold text-ink">How Chloe thinks</h2>
        <p className="mt-1 text-sm text-muted">
          Chloe runs on <strong>your own</strong> AI model key, under{" "}
          <strong>your own</strong> HIPAA agreement — nothing is shared, and her
          personality &amp; rules stay yours.
        </p>
        <div className="mt-4 grid gap-2 rounded-lg border border-line bg-canvas/40 p-4 text-sm">
          <div className="flex items-center gap-2">
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${connected ? "bg-success" : "bg-line"}`} />
            <span className={connected ? "text-ink" : "text-muted"}>
              AI model key installed {connected ? "" : "— set ANTHROPIC_API_KEY as a secret (with a signed BAA)"}
            </span>
          </div>
        </div>
        {!connected && (
          <p className="mt-3 text-xs text-muted">
            To activate live drafting: sign a BAA with your AI provider (Anthropic
            offers one), then have your developer set the <code>ANTHROPIC_API_KEY</code>{" "}
            secret. The moment it&apos;s in place, the{" "}
            <Link href="/tasks" className="text-accent hover:underline">
              “✨ Draft with Chloe”
            </Link>{" "}
            button on every task goes live. Cost is a fraction of a cent per message.
          </p>
        )}
        {connected && (
          <p className="mt-3 text-sm text-success">
            ✓ Chloe is ready. Use <strong>✨ Draft with Chloe</strong> on any task in
            Today&apos;s Tasks.
          </p>
        )}
      </div>

      {/* Her personality (read-only) */}
      <div className="card p-6">
        <h2 className="text-sm font-semibold text-ink">Chloe&apos;s personality &amp; rules</h2>
        <p className="mt-1 text-xs text-muted">
          This is the brief she thinks from — her voice, her manners, and her
          bright-red escalation line. (Editable in-app is coming; for now it&apos;s
          the same brief from your Chloe Blueprint.)
        </p>
        <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded-lg border border-line bg-canvas/40 p-4 text-xs leading-relaxed text-ink">
          {CHLOE_PERSONA}
        </pre>
      </div>

      <div className="card p-5">
        <h2 className="text-sm font-semibold text-ink">What&apos;s next for Chloe</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
          <li><strong>Phase 1 (now):</strong> she drafts, you approve &amp; send.</li>
          <li><strong>Phase 2:</strong> connect a text channel (Weave/Twilio) so she replies to inbound patient texts.</li>
          <li><strong>Phase 3:</strong> live two-way conversations + booking through Mindbody, plus voice (Retell).</li>
        </ul>
      </div>
    </div>
  );
}
