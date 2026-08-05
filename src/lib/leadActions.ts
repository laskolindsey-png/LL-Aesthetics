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

/** Fix a lead's details (typo, phone, email, source, etc.) without touching its stage or follow-ups. */
export async function editLead(formData: FormData) {
  const tenantId = await getCurrentTenantId();
  const id = String(formData.get("leadId") ?? "");
  const lead = await prisma.lead.findFirst({ where: { id, tenantId } });
  if (!lead) throw new Error("Lead not found.");

  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Lead name is required.");
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const email = String(formData.get("email") ?? "").trim() || null;
  const source = String(formData.get("source") ?? "").trim() || null;
  const assignedTo = String(formData.get("assignedTo") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  await prisma.lead.update({
    where: { id },
    data: { name, phone, email, source, assignedTo, notes },
  });
  revalidateLeadViews();
}

export async function setLeadStage(formData: FormData) {
  const tenantId = await getCurrentTenantId();
  const id = String(formData.get("leadId") ?? "");
  const stage = String(formData.get("stage") ?? "").trim();
  const lead = await prisma.lead.findFirst({ where: { id, tenantId } });
  if (!lead) throw new Error("Lead not found.");
  const data: { stage: string; firstContactedAt?: Date } = { stage };
  // Stamp the first-contacted date the first time they're moved to "Contacted".
  if (stage === "Contacted" && !lead.firstContactedAt) data.firstContactedAt = new Date();
  await prisma.lead.update({ where: { id }, data });
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

/** Lead went cold — close it (with an optional reason) and stop pending follow-ups. */
export async function markLeadLost(formData: FormData) {
  const tenantId = await getCurrentTenantId();
  const id = String(formData.get("leadId") ?? "");
  const reason = String(formData.get("lostReason") ?? "").trim() || null;
  const lead = await prisma.lead.findFirst({ where: { id, tenantId } });
  if (!lead) throw new Error("Lead not found.");
  await prisma.lead.update({ where: { id }, data: { stage: "Lost", lostReason: reason } });
  await prisma.task.updateMany({
    where: { leadId: id, status: { not: "Completed" } },
    data: { status: "Cancelled" },
  });
  revalidateLeadViews();
}

/** Archive a lead — hide it from the active pipeline without deleting. Pending follow-ups stop. */
export async function archiveLead(formData: FormData) {
  const tenantId = await getCurrentTenantId();
  const id = String(formData.get("leadId") ?? "");
  const lead = await prisma.lead.findFirst({ where: { id, tenantId } });
  if (!lead) throw new Error("Lead not found.");
  await prisma.lead.update({ where: { id }, data: { archivedAt: new Date() } });
  await prisma.task.updateMany({
    where: { leadId: id, status: { notIn: ["Completed", "Cancelled"] } },
    data: { status: "Cancelled" },
  });
  revalidateLeadViews();
  redirect("/leads");
}

/** Restore an archived lead back into the active view. Does not recreate its follow-ups. */
export async function unarchiveLead(formData: FormData) {
  const tenantId = await getCurrentTenantId();
  const id = String(formData.get("leadId") ?? "");
  const lead = await prisma.lead.findFirst({ where: { id, tenantId } });
  if (!lead) throw new Error("Lead not found.");
  await prisma.lead.update({ where: { id }, data: { archivedAt: null } });
  revalidateLeadViews();
}

/** Put outreach On Hold or mark Do Not Contact (pauses pending follow-ups + flags the team). Empty value clears it. */
export async function setContactHold(formData: FormData) {
  const tenantId = await getCurrentTenantId();
  const id = String(formData.get("leadId") ?? "");
  const value = String(formData.get("contactHold") ?? "").trim() || null;
  const lead = await prisma.lead.findFirst({ where: { id, tenantId } });
  if (!lead) throw new Error("Lead not found.");
  await prisma.lead.update({ where: { id }, data: { contactHold: value } });
  // Holding or Do-Not-Contact stops any pending outreach; clearing it leaves things as they are.
  if (value) {
    await prisma.task.updateMany({
      where: { leadId: id, status: { notIn: ["Completed", "Cancelled"] } },
      data: { status: "Cancelled" },
    });
  }
  revalidateLeadViews();
}

/** Record whether the lead has responded to outreach. Empty value clears it. */
export async function setResponseStatus(formData: FormData) {
  const tenantId = await getCurrentTenantId();
  const id = String(formData.get("leadId") ?? "");
  const value = String(formData.get("responseStatus") ?? "").trim() || null;
  const lead = await prisma.lead.findFirst({ where: { id, tenantId } });
  if (!lead) throw new Error("Lead not found.");
  await prisma.lead.update({ where: { id }, data: { responseStatus: value } });
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
