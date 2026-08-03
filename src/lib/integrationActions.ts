"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "./prisma";
import { getCurrentTenantId } from "./tenant";
import { getSessionUser } from "./currentUser";

async function requireOwner() {
  const me = await getSessionUser();
  if (!me || me.role !== "owner") throw new Error("Owner access required.");
  return me;
}
export async function saveMindbodyConfig(formData: FormData) {
  await requireOwner();

  const tenantId = await getCurrentTenantId();
  const siteId = String(formData.get("siteId") ?? "").trim() || null;

  const workflowCutoffDateRaw = String(
    formData.get("workflowCutoffDate") ?? ""
  ).trim();

  const workflowCutoffDate = workflowCutoffDateRaw
    ? new Date(`${workflowCutoffDateRaw}T00:00:00`)
    : null;

  const enabled = formData.get("enabled") != null;
  const autoCreateVisits = formData.get("autoCreateVisits") != null;

  await prisma.mindbodyConfig.upsert({
    where: { tenantId },
    create: {
      tenantId,
      siteId,
      workflowCutoffDate,
      enabled,
      autoCreateVisits,
    },
    update: {
      siteId,
      workflowCutoffDate,
      enabled,
      autoCreateVisits,
    },
  });

  revalidatePath("/integrations");
}

export async function clearWebhookLog() {
  await requireOwner();
  const tenantId = await getCurrentTenantId();
  await prisma.webhookEvent.deleteMany({ where: { tenantId } });
  revalidatePath("/integrations");
}
