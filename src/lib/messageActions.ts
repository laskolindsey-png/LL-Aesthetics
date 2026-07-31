"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "./prisma";
import { getCurrentTenantId } from "./tenant";
import { defaultMessageFor } from "./templates";

export async function updateMessageTemplate(formData: FormData) {
  const tenantId = await getCurrentTenantId();
  const id = String(formData.get("id") ?? "");
  const body = String(formData.get("body") ?? "");
  const channel = String(formData.get("channel") ?? "SMS").trim() || "SMS";
  const tpl = await prisma.messageTemplate.findFirst({ where: { id, tenantId } });
  if (!tpl) throw new Error("Template not found.");
  await prisma.messageTemplate.update({ where: { id }, data: { body, channel } });
  revalidatePath("/messages");
  revalidatePath("/tasks");
}

// Fill any EMPTY templates with friendly starter copy — a one-click head start.
// Templates that already have text are left untouched.
export async function fillStarterMessages() {
  const tenantId = await getCurrentTenantId();
  const templates = await prisma.messageTemplate.findMany({ where: { tenantId } });
  for (const t of templates) {
    if (!t.body || !t.body.trim()) {
      await prisma.messageTemplate.update({
        where: { id: t.id },
        data: { body: defaultMessageFor(t.key) },
      });
    }
  }
  revalidatePath("/messages");
  revalidatePath("/tasks");
}
