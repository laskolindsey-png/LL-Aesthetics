"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "./prisma";
import { getCurrentTenantId } from "./tenant";
import { fromDateInput } from "./dates";
import { parseAuraPdf, auraDate } from "./auraPlan";

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

// --- Aura scan upload -------------------------------------------------------
// Accept an Aura "Treatment Plan" PDF: store the file with the patient (so it's
// downloadable later) AND auto-build a plan from its OVERVIEW. The file bytes are
// real PHI — they live in the DB, never in the repo.
export async function uploadAuraPlan(formData: FormData) {
  const tenantId = await getCurrentTenantId();
  const patientId = String(formData.get("patientId") ?? "");
  const patient = await prisma.patient.findFirst({ where: { id: patientId, tenantId } });
  if (!patient) throw new Error("Patient not found.");

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) redirect(`/patients/${patientId}?planError=nofile`);

  const buffer = Buffer.from(await file.arrayBuffer());

  let items: Awaited<ReturnType<typeof parseAuraPdf>>["items"] = [];
  // Capture WHY a scan didn't auto-build so it surfaces in the UI instead of a
  // silent $0. "notext" = no text extracted (image-only PDF or extractor failed
  // in this runtime); "nooverview" = text found but no OVERVIEW section matched;
  // "error:<msg>" = the extractor threw (reveals runtime issues like pdfjs).
  let scanDiag = "";
  try {
    const parsed = await parseAuraPdf(buffer);
    items = parsed.items;
    if (items.length === 0) {
      const text = (parsed.text ?? "").trim();
      scanDiag = text.length === 0 ? "notext" : "nooverview";
    }
  } catch (e) {
    console.error("[uploadAuraPlan] parse failed:", e);
    items = []; // still store the file even if parsing hiccups
    scanDiag = "error:" + String(e instanceof Error ? e.message : e).slice(0, 140);
  }

  // Store the file with the patient.
  const doc = await prisma.planDocument.create({
    data: {
      tenantId,
      patientId,
      fileName: file.name || "aura-plan.pdf",
      mimeType: file.type || "application/pdf",
      sizeBytes: buffer.length,
      source: "Aura Scan",
      data: buffer,
    },
  });

  // Build the plan from the parsed overview (if any).
  if (items.length) {
    const plan = await prisma.treatmentPlan.create({
      data: { tenantId, patientId, label: "Aura Plan", source: "Aura Scan", planDate: new Date() },
    });
    await prisma.planDocument.update({ where: { id: doc.id }, data: { planId: plan.id } });
    await prisma.treatmentPlanItem.createMany({
      data: items.map((it, i) => ({
        tenantId,
        planId: plan.id,
        category: it.category,
        treatment: it.treatment,
        targetDate: auraDate(it.date),
        durationMin: it.durationMin,
        price: it.price,
        sortOrder: i,
        status: "Recommended",
      })),
    });
  }

  revalidatePlanViews(patientId);
  const diag = items.length === 0 && scanDiag ? `&scan=${encodeURIComponent(scanDiag)}` : "";
  redirect(`/patients/${patientId}?uploaded=${items.length}${diag}`);
}

export async function deletePlanDocument(formData: FormData) {
  const tenantId = await getCurrentTenantId();
  const id = String(formData.get("docId") ?? "");
  const patientId = String(formData.get("patientId") ?? "");
  const doc = await prisma.planDocument.findFirst({ where: { id, tenantId } });
  if (!doc) throw new Error("Document not found.");
  await prisma.planDocument.delete({ where: { id } });
  revalidatePlanViews(patientId);
}
