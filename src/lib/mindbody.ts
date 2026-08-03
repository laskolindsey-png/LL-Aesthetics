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

const MINDBODY_BASE_URL = "https://api.mindbodyonline.com/public/v6";

export async function mindbodyGet<T>(
  siteId: string,
  path: string,
  searchParams?: Record<string, string | number | boolean | undefined>
): Promise<T> {
  const apiKey = process.env.MINDBODY_API_KEY;

  if (!apiKey) {
    throw new Error("MINDBODY_API_KEY is not configured.");
  }

  const url = new URL(`${MINDBODY_BASE_URL}${path}`);

  for (const [key, value] of Object.entries(searchParams ?? {})) {
    if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url, {
    headers: {
      "API-Key": apiKey,
      SiteId: siteId,
      "User-Agent": "LL-Aesthetics-OS",
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Mindbody request failed (${response.status}): ${body || response.statusText}`
    );
  }

  return (await response.json()) as T;
}