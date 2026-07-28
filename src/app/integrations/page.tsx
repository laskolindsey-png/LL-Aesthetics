import { prisma } from "@/lib/prisma";
import { getCurrentTenantId } from "@/lib/tenant";
import { getSessionUser } from "@/lib/currentUser";
import { getOrInitMindbodyConfig, hasApiKey, hasWebhookSecret } from "@/lib/mindbody";
import { saveMindbodyConfig, clearWebhookLog } from "@/lib/integrationActions";
import { formatDate } from "@/lib/dates";
import { Badge } from "@/components/Badge";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

function Dot({ ok }: { ok: boolean }) {
  return (
    <span className={`inline-block h-2.5 w-2.5 rounded-full ${ok ? "bg-success" : "bg-line"}`} />
  );
}

export default async function IntegrationsPage() {
  const me = await getSessionUser();
  if (!me) redirect("/login");
  if (me.role !== "owner") redirect("/");

  const tenantId = await getCurrentTenantId();
  const config = await getOrInitMindbodyConfig(tenantId);
  const apiKey = hasApiKey();
  const webhookSecret = hasWebhookSecret();
  const events = await prisma.webhookEvent.findMany({
    where: { tenantId, provider: "Mindbody" },
    orderBy: { receivedAt: "desc" },
    take: 10,
  });

  const connected = apiKey && webhookSecret && !!config.siteId;
  const webhookPath = "/api/webhooks/mindbody";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Integrations</h1>
          <p className="mt-1 text-sm text-muted">
            Connect Mindbody so appointments flow in automatically. Owner-only.
          </p>
        </div>
        <span className="rounded-lg border border-line bg-canvas px-3 py-1.5 text-xs text-muted">
          🔒 Owner only
        </span>
      </div>

      <div className="card p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-ink">Mindbody</h2>
            <p className="text-sm text-muted">Bookings &amp; sales — the source of truth.</p>
          </div>
          <Badge tone={connected && config.enabled ? "success" : connected ? "warning" : "neutral"}>
            {connected && config.enabled ? "Connected & On" : connected ? "Ready — switch on" : "Not connected yet"}
          </Badge>
        </div>

        {/* Setup checklist */}
        <div className="mt-5 grid gap-2 rounded-lg border border-line bg-canvas/40 p-4 text-sm">
          <div className="flex items-center gap-2">
            <Dot ok={apiKey} />
            <span className={apiKey ? "text-ink" : "text-muted"}>
              API key installed {apiKey ? "" : "— set MINDBODY_API_KEY as a secret"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Dot ok={webhookSecret} />
            <span className={webhookSecret ? "text-ink" : "text-muted"}>
              Webhook signing secret installed {webhookSecret ? "" : "— set MINDBODY_WEBHOOK_SECRET as a secret"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Dot ok={!!config.siteId} />
            <span className={config.siteId ? "text-ink" : "text-muted"}>
              Site ID entered {config.siteId ? `(${config.siteId})` : "— add it below"}
            </span>
          </div>
        </div>

        {/* Config form */}
        <form action={saveMindbodyConfig} className="mt-5 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label">Mindbody Site ID</label>
              <input
                name="siteId"
                defaultValue={config.siteId ?? ""}
                className="input"
                placeholder="e.g. 123456"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" name="autoCreateVisits" defaultChecked={config.autoCreateVisits} className="h-4 w-4" />
            When an appointment completes, create the follow-up workflow automatically
          </label>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" name="enabled" defaultChecked={config.enabled} className="h-4 w-4" />
            <span>
              <strong>Turn the connection on</strong> — process incoming events
              {!connected && <span className="text-muted"> (finish the checklist above first)</span>}
            </span>
          </label>
          <div className="flex justify-end">
            <button className="btn-primary">Save</button>
          </div>
        </form>
      </div>

      {/* Webhook endpoint */}
      <div className="card p-6">
        <h2 className="text-sm font-semibold text-ink">Webhook URL</h2>
        <p className="mt-1 text-sm text-muted">
          Give this address to Mindbody when subscribing to events (appointments,
          sales, clients). Add it to your app&rsquo;s domain:
        </p>
        <code className="mt-3 block overflow-x-auto rounded-lg border border-line bg-canvas/50 px-3 py-2 text-sm text-ink">
          https://&lt;your-app-domain&gt;{webhookPath}
        </code>
        <p className="mt-2 text-xs text-muted">
          Every event that arrives is verified and logged below — even before you
          switch processing on — so nothing is ever lost.
        </p>
      </div>

      {/* Event log */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <h2 className="text-sm font-semibold text-ink">Recent events</h2>
          {events.length > 0 && (
            <form action={clearWebhookLog}>
              <button className="text-xs text-muted hover:text-danger">Clear log</button>
            </form>
          )}
        </div>
        {events.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted">
            No events received yet. Once Mindbody is subscribed to your webhook URL,
            they&rsquo;ll appear here.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-canvas/50 text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-5 py-2.5 font-medium">Received</th>
                <th className="px-5 py-2.5 font-medium">Event</th>
                <th className="px-5 py-2.5 font-medium">Signature</th>
                <th className="px-5 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id} className="border-b border-line/60">
                  <td className="px-5 py-2.5 whitespace-nowrap text-muted">
                    {formatDate(e.receivedAt)}
                  </td>
                  <td className="px-5 py-2.5 text-ink">{e.eventType ?? "—"}</td>
                  <td className="px-5 py-2.5">
                    <Badge tone={e.signatureValid ? "success" : "danger"}>
                      {e.signatureValid ? "Verified" : "Rejected"}
                    </Badge>
                  </td>
                  <td className="px-5 py-2.5 text-muted">{e.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
