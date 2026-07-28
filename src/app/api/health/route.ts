// Public health check for the host's uptime monitoring. No auth, no data.
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ ok: true });
}
