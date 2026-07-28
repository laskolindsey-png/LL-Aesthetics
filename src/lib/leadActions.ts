"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "./prisma";
import { getCurrentTenantId } from "./tenant";
import { generateTasks } from "./engine";
import { todayStart } from "./dates";

function revalidateLeadViews() {
  revalidatePath("/leads");
  revalidatePath("/tasks");
  revalidatePath("/");
}

/** Add a new lead and schedule their greeting/nurture follow-ups. */
export async function createLead(formData: FormData) {
  const tenantId = await getCurrentTenantId();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Lead name is required.");

  const phone = String(formData.get("phone") ?? "").trim() || null;
  const email = String(formData.get("email") ?? "").trim() || null;
  const source = String(formData.get("source") ?? "").trim() || null;
  const assignedTo = String(formData.get("assignedTo") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  // Fire the dedicated "New Lead" greeting sequence, anchored to today.
  const generated = await generateTasks(tenantId, "New Lead", "Lead", todayStart());

  await prisma.lead.create({
    data: {
      tenantId,
      name,
      phone,
      email,
      source,
      assignedTo,
      notes,
      stage: "New",
      tasks: {
        create: generated.map((t) => ({
          tenantId,
          stepNumber: t.stepNumber,
          workflowStep: t.workflowStep,
          assignedTo: t.assignedTo,
          priority: t.priority,
          anchor: t.anchor,
          delayDays: t.delayDays,
          dueDate: t.dueDate,
          automationTemplate: t.automationTemplate,
          status: "Pending",
        })),
      },
    },
  });

  revalidateLeadViews();
  redirect("/leads");
}

export async function setLeadStage(formData: FormData) {
  const tenantId = await getCurrentTenantId();
  const id = String(formData.get("leadId") ?? "");
  const stage = String(formData.get("stage") ?? "").trim();
  const lead = await prisma.lead.findFirst({ where: { id, tenantId } });
  if (!lead) throw new Error("Lead not found.");
  await prisma.lead.update({ where: { id }, data: { stage } });
  revalidateLeadViews();
}

/** They booked! Close the lead and stop its pending follow-ups. */
export async function markLeadBooked(formData: FormData) {
  const tenantId = await getCurrentTenantId();
  const id = String(formData.get("leadId") ?? "");
  const lead = await prisma.lead.findFirst({ where: { id, tenantId } });
  if (!lead) throw new Error("Lead not found.");
  await prisma.lead.update({
    where: { id },
    data: { stage: "Booked", convertedAt: new Date() },
  });
  await prisma.task.updateMany({
    where: { leadId: id, status: { not: "Completed" } },
    data: { status: "Cancelled" },
  });
  revalidateLeadViews();
}

/** Lead went cold — close it and stop pending follow-ups. */
export async function markLeadLost(formData: FormData) {
  const tenantId = await getCurrentTenantId();
  const id = String(formData.get("leadId") ?? "");
  const lead = await prisma.lead.findFirst({ where: { id, tenantId } });
  if (!lead) throw new Error("Lead not found.");
  await prisma.lead.update({ where: { id }, data: { stage: "Lost" } });
  await prisma.task.updateMany({
    where: { leadId: id, status: { not: "Completed" } },
    data: { status: "Cancelled" },
  });
  revalidateLeadViews();
}

export async function deleteLead(formData: FormData) {
  const tenantId = await getCurrentTenantId();
  const id = String(formData.get("leadId") ?? "");
  const lead = await prisma.lead.findFirst({ where: { id, tenantId } });
  if (!lead) throw new Error("Lead not found.");
  await prisma.lead.delete({ where: { id } });
  revalidateLeadViews();
  redirect("/leads");
}
