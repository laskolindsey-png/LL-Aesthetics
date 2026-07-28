"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "./prisma";
import { getCurrentTenantId } from "./tenant";
import { fromDateInput } from "./dates";

function revalidatePlanViews(patientId?: string) {
  revalidatePath("/plans");
  revalidatePath("/");
  if (patientId) revalidatePath(`/patients/${patientId}`);
}

export async function createPlan(formData: FormData) {
  const tenantId = await getCurrentTenantId();
  const patientId = String(formData.get("patientId") ?? "");
  const patient = await prisma.patient.findFirst({ where: { id: patientId, tenantId } });
  if (!patient) throw new Error("Patient not found.");

  const label = String(formData.get("label") ?? "").trim() || "Treatment Plan";
  const source = String(formData.get("source") ?? "").trim() || "Aura Scan";
  const planDateRaw = String(formData.get("planDate") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim() || null;

  await prisma.treatmentPlan.create({
    data: {
      tenantId,
      patientId,
      label,
      source,
      planDate: planDateRaw ? fromDateInput(planDateRaw) : null,
      notes,
    },
  });
  revalidatePlanViews(patientId);
}

export async function addPlanItem(formData: FormData) {
  const tenantId = await getCurrentTenantId();
  const planId = String(formData.get("planId") ?? "");
  const patientId = String(formData.get("patientId") ?? "");
  const plan = await prisma.treatmentPlan.findFirst({ where: { id: planId, tenantId } });
  if (!plan) throw new Error("Plan not found.");

  const treatment = String(formData.get("treatment") ?? "").trim();
  if (!treatment) throw new Error("Treatment is required.");
  const category = String(formData.get("category") ?? "").trim() || null;
  const targetRaw = String(formData.get("targetDate") ?? "").trim();
  const priceRaw = String(formData.get("price") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim() || null;

  const count = await prisma.treatmentPlanItem.count({ where: { planId } });
  await prisma.treatmentPlanItem.create({
    data: {
      tenantId,
      planId,
      category,
      treatment,
      targetDate: targetRaw ? fromDateInput(targetRaw) : null,
      price: priceRaw ? Number(priceRaw) || null : null,
      notes,
      sortOrder: count,
      status: "Recommended",
    },
  });
  revalidatePlanViews(patientId);
}

export async function setPlanItemStatus(formData: FormData) {
  const tenantId = await getCurrentTenantId();
  const id = String(formData.get("itemId") ?? "");
  const status = String(formData.get("status") ?? "").trim();
  const patientId = String(formData.get("patientId") ?? "");
  const item = await prisma.treatmentPlanItem.findFirst({ where: { id, tenantId } });
  if (!item) throw new Error("Item not found.");

  await prisma.treatmentPlanItem.update({
    where: { id },
    data: {
      status,
      scheduledDate: status === "Scheduled" ? new Date() : status === "Recommended" ? null : item.scheduledDate,
      completedDate: status === "Completed" ? new Date() : item.completedDate,
    },
  });
  revalidatePlanViews(patientId);
}

export async function deletePlanItem(formData: FormData) {
  const tenantId = await getCurrentTenantId();
  const id = String(formData.get("itemId") ?? "");
  const patientId = String(formData.get("patientId") ?? "");
  const item = await prisma.treatmentPlanItem.findFirst({ where: { id, tenantId } });
  if (!item) throw new Error("Item not found.");
  await prisma.treatmentPlanItem.delete({ where: { id } });
  revalidatePlanViews(patientId);
}

export async function deletePlan(formData: FormData) {
  const tenantId = await getCurrentTenantId();
  const id = String(formData.get("planId") ?? "");
  const patientId = String(formData.get("patientId") ?? "");
  const plan = await prisma.treatmentPlan.findFirst({ where: { id, tenantId } });
  if (!plan) throw new Error("Plan not found.");
  await prisma.treatmentPlan.delete({ where: { id } });
  revalidatePlanViews(patientId);
}
