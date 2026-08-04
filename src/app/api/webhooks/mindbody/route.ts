import { prisma } from "@/lib/prisma";
import {
  verifyWebhookSignature,
  extractEventType,
  hasWebhookSecret,
} from "@/lib/mindbody";

import { processMindbodyWebhook } from "@/lib/mindbodyProcessor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Mindbody webhook receiver — the "inbox" for events (appointment booked/
 * completed, sale, client updated). It verifies the signature, logs every event
 * durably (so nothing is lost), and — once the connection is switched on — hands
 * known events to the processors. Until then it safely records and acknowledges.
 *
 * Give Mindbody this URL when subscribing:  https://<your-app>/api/webhooks/mindbody
 */
export async function POST(req: Request) {
  const raw = await req.text();
  const signature = req.headers.get("x-mindbody-signature");

  // Not configured yet — accept nothing until the signing secret is in place.
  if (!hasWebhookSecret()) {
    return Response.json(
      { ok: false, reason: "Webhook secret not configured." },
      { status: 503 }
    );
  }

  const tenant = await prisma.tenant.findFirst({ orderBy: { createdAt: "asc" } });
  const signatureValid = verifyWebhookSignature(raw, signature);

  let payload: unknown = null;
  try {
    payload = raw ? JSON.parse(raw) : null;
  } catch {
    payload = null;
  }
  const eventType = extractEventType(payload);

  // Always log the event, valid or not — auditable trail.
  await prisma.webhookEvent.create({
    data: {
      tenantId: tenant?.id ?? null,
      provider: "Mindbody",
      eventType,
      signatureValid,
      status: signatureValid ? "received" : "error",
      error: signatureValid ? null : "Invalid or missing signature",
      payload: raw.slice(0, 20000), // guard against oversized bodies
    },
  });

  if (!signatureValid) {
    return Response.json({ ok: false, reason: "Invalid signature" }, { status: 401 });
  }

  // Note the heartbeat so the connection page can show "last event received".
 if (tenant) {
  const config = await prisma.mindbodyConfig.findUnique({
    where: { tenantId: tenant.id },
  });

  if (config) {
    await prisma.mindbodyConfig.update({
      where: { tenantId: tenant.id },
      data: { lastEventAt: new Date() },
    });
  }

  if (!config?.enabled || !payload || typeof payload !== "object") {
    await prisma.webhookEvent.updateMany({
      where: {
        tenantId: tenant.id,
        provider: "Mindbody",
        payload: raw.slice(0, 20000),
        status: "received",
      },
      data: {
        status: "ignored",
      },
    });
  } else {
    try {
      await processMindbodyWebhook(
        tenant.id,
        payload as Parameters<typeof processMindbodyWebhook>[1]
      );

      await prisma.webhookEvent.updateMany({
        where: {
          tenantId: tenant.id,
          provider: "Mindbody",
          payload: raw.slice(0, 20000),
          status: "received",
        },
        data: {
          status: "processed",
          error: null,
        },
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown processing error";

      await prisma.webhookEvent.updateMany({
        where: {
          tenantId: tenant.id,
          provider: "Mindbody",
          payload: raw.slice(0, 20000),
          status: "received",
        },
        data: {
          status: "error",
          error: message.slice(0, 1000),
        },
      });

      console.error("[Mindbody] Webhook processing failed:", error);
    }
  }
}

  return Response.json({ ok: true });
}

// A GET is handy for a quick "is this endpoint reachable?" check.
export async function GET() {
  return Response.json({ ok: true, endpoint: "mindbody-webhook", ready: hasWebhookSecret() });
}
