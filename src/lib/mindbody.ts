import crypto from "node:crypto";
import { prisma } from "./prisma";

/**
 * Mindbody integration helpers.
 *
 * Secrets live in environment variables, never in the database:
 *   MINDBODY_API_KEY        — for outbound Public API calls (Site data, sales…)
 *   MINDBODY_WEBHOOK_SECRET — the signing key used to verify inbound webhooks
 *
 * The non-secret config (Site ID, on/off switch) lives in MindbodyConfig so it's
 * editable in-app without a redeploy.
 */

export function hasApiKey(): boolean {
  return !!process.env.MINDBODY_API_KEY;
}

export function hasWebhookSecret(): boolean {
  return !!process.env.MINDBODY_WEBHOOK_SECRET;
}

export async function getMindbodyConfig(tenantId: string) {
  return prisma.mindbodyConfig.findUnique({ where: { tenantId } });
}

export async function getOrInitMindbodyConfig(tenantId: string) {
  const existing = await prisma.mindbodyConfig.findUnique({ where: { tenantId } });
  if (existing) return existing;
  return prisma.mindbodyConfig.create({ data: { tenantId } });
}

/**
 * Verify a Mindbody webhook signature. Mindbody signs the raw request body with
 * the subscription's message signature key (HMAC-SHA256, base64) and sends it in
 * the `X-Mindbody-Signature` header. We recompute and compare in constant time.
 *
 * The exact header/encoding is confirmed against a live event when the connection
 * is turned on; this follows Mindbody's documented scheme.
 */
export function verifyWebhookSignature(rawBody: string, headerSignature: string | null): boolean {
  const secret = process.env.MINDBODY_WEBHOOK_SECRET;
  if (!secret || !headerSignature) return false;
  const provided = headerSignature.replace(/^sha256=/i, "").trim();
  const expected = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Pull the event type out of a Mindbody webhook payload. Their envelope carries
 * an `eventId` like "appointment.booked" / "sale.created"; we fall back to a few
 * common shapes so the log is useful regardless of exact casing.
 */
export function extractEventType(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  return (
    (p.eventId as string) ??
    (p.eventType as string) ??
    (p.event as string) ??
    (p.messageType as string) ??
    null
  );
}
