"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "./prisma";
import { getCurrentTenantId } from "./tenant";
import { generateTasks, makeRecordCode } from "./engine";
import { filterDuplicateFollowUps } from "./dedupe";
import { fromDateInput } from "./dates";

/**
 * Record a new patient event and auto-generate its follow-up tasks.
 * This is the workbook's "New Treatment Entry" — the moment the engine fires.
 */
export async function createEvent(formData: FormData) {
  const tenantId = await getCurrentTenantId();

  const patientName = String(formData.get("patientName") ?? "").trim();
  const existingPatientId = String(formData.get("patientId") ?? "").trim();
  const patientEvent = String(formData.get("patientEvent") ?? "").trim();
  const service = String(formData.get("service") ?? "").trim();
  const provider = String(formData.get("provider") ?? "").trim() || null;
  const eventDateRaw = String(formData.get("eventDate") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!patientEvent || !service || !eventDateRaw) {
    throw new Error("Patient event, service, and event date are required.");
  }
  if (!existingPatientId && !patientName) {
    throw new Error("Choose an existing patient or enter a new patient name.");
  }

  const eventDate = fromDateInput(eventDateRaw);

  // Resolve the patient (existing selection wins; otherwise create).
  let patientId = existingPatientId;
  if (!patientId) {
    const patient = await prisma.patient.create({
      data: { tenantId, name: patientName },
    });
    patientId = patient.id;
  }

  const generated = await generateTasks(tenantId, patientEvent, service, eventDate);

  // Same-day de-duplication: if this patient already has the same communication
  // due on the same day (e.g. from another service today), don't create it again.
  const { toCreate, suppressed } = await filterDuplicateFollowUps(
    tenantId,
    patientId,
    generated
  );

  // If everything was a duplicate, the visit still gets logged — it just rides on
  // the follow-ups already scheduled for the patient today.
  const recordStatus = toCreate.length > 0 ? "In Progress" : "Completed";
  const mergeNote =
    suppressed.length > 0
      ? `${suppressed.length} follow-up${suppressed.length === 1 ? "" : "s"} merged — patient already has ${
          suppressed.length === 1 ? "it" : "them"
        } today.`
      : null;
  const finalNotes = [notes, mergeNote].filter(Boolean).join(" · ") || null;

  await prisma.workflowRecord.create({
    data: {
      tenantId,
      code: makeRecordCode(),
      patientId,
      provider,
      patientEvent,
      service,
      eventDate,
      notes: finalNotes,
      status: recordStatus,
      tasks: {
        create: toCreate.map((t) => ({
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

  // Share the visit timeline: if this patient is tracked in the Botox Tracker,
  // advance their last-visit so the reactivation clock reflects this real visit
  // (only ever moves forward). No duplicate reminders — this just resets the
  // reactivation window; rebooking still comes from the workflow rules alone.
  await prisma.toxPatient.updateMany({
    where: {
      tenantId,
      patientId,
      OR: [{ lastVisitDate: null }, { lastVisitDate: { lt: eventDate } }],
    },
    data: { lastVisitDate: eventDate },
  });

  revalidatePath("/");
  revalidatePath("/tasks");
  revalidatePath("/workflow");
  revalidatePath("/patients");
  revalidatePath("/tox");
}

/** Mark a task complete, capturing what was done. */
export async function completeTask(formData: FormData) {
  const tenantId = await getCurrentTenantId();
  const taskId = String(formData.get("taskId") ?? "");
  const actionResult = String(formData.get("actionResult") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  const task = await prisma.task.findFirst({ where: { id: taskId, tenantId } });
  if (!task) throw new Error("Task not found.");

  await prisma.task.update({
    where: { id: taskId },
    data: { status: "Completed", completedDate: new Date(), actionResult, notes },
  });

  // If this is a treatment-record task and every task on the record is now done,
  // close the record out. (Lead tasks don't auto-close anything.)
  if (task.recordId) {
    const remaining = await prisma.task.count({
      where: { recordId: task.recordId, status: { not: "Completed" } },
    });
    if (remaining === 0) {
      await prisma.workflowRecord.update({
        where: { id: task.recordId },
        data: { status: "Completed" },
      });
    }
  }

  revalidatePath("/");
  revalidatePath("/tasks");
  revalidatePath("/workflow");
  revalidatePath("/leads");
}

/** Toggle a rule on/off from the Service Rules screen. */
export async function toggleRule(formData: FormData) {
  const tenantId = await getCurrentTenantId();
  const ruleId = String(formData.get("ruleId") ?? "");
  const rule = await prisma.serviceRule.findFirst({ where: { id: ruleId, tenantId } });
  if (!rule) throw new Error("Rule not found.");
  await prisma.serviceRule.update({
    where: { id: ruleId },
    data: { active: !rule.active },
  });
  revalidatePath("/rules");
}

// --- Rule editing ------------------------------------------------------------

function parseRuleForm(formData: FormData) {
  const workflowStep = String(formData.get("workflowStep") ?? "").trim();
  const patientEvent = String(formData.get("patientEvent") ?? "").trim();
  const service = String(formData.get("service") ?? "").trim();
  if (!workflowStep || !patientEvent || !service) {
    throw new Error("Follow-up step, patient event, and service are all required.");
  }
  const num = (name: string, fallback = 0) => {
    const v = Number(formData.get(name));
    return Number.isFinite(v) ? v : fallback;
  };
  return {
    patientEvent,
    service,
    serviceCategory: String(formData.get("serviceCategory") ?? "").trim() || null,
    step: Math.max(1, Math.round(num("step", 1))),
    workflowStep,
    delayDays: Math.max(0, Math.round(num("delayDays", 0))),
    anchor: String(formData.get("anchor") ?? "Treatment Date").trim() || "Treatment Date",
    assignedTo: String(formData.get("assignedTo") ?? "Front Desk").trim() || "Front Desk",
    priority: String(formData.get("priority") ?? "Medium").trim() || "Medium",
    automationTemplate: String(formData.get("automationTemplate") ?? "").trim() || workflowStep,
    active: true,
  };
}

export async function createRule(formData: FormData) {
  const tenantId = await getCurrentTenantId();
  await prisma.serviceRule.create({ data: { tenantId, ...parseRuleForm(formData) } });
  revalidatePath("/rules");
  redirect("/rules");
}

export async function updateRule(formData: FormData) {
  const tenantId = await getCurrentTenantId();
  const id = String(formData.get("ruleId") ?? "");
  const rule = await prisma.serviceRule.findFirst({ where: { id, tenantId } });
  if (!rule) throw new Error("Rule not found.");
  await prisma.serviceRule.update({ where: { id }, data: parseRuleForm(formData) });
  revalidatePath("/rules");
  redirect("/rules");
}

export async function deleteRule(formData: FormData) {
  const tenantId = await getCurrentTenantId();
  const id = String(formData.get("ruleId") ?? "");
  const rule = await prisma.serviceRule.findFirst({ where: { id, tenantId } });
  if (!rule) throw new Error("Rule not found.");
  await prisma.serviceRule.delete({ where: { id } });
  revalidatePath("/rules");
}

// --- Settings editing --------------------------------------------------------

export async function addSetting(formData: FormData) {
  const tenantId = await getCurrentTenantId();
  const type = String(formData.get("type") ?? "").trim();
  const value = String(formData.get("value") ?? "").trim();
  if (!type || !value) throw new Error("A value is required.");
  const existing = await prisma.setting.findFirst({ where: { tenantId, type, value } });
  if (!existing) {
    const count = await prisma.setting.count({ where: { tenantId, type } });
    await prisma.setting.create({ data: { tenantId, type, value, sortOrder: count } });
  }
  revalidatePath("/settings");
}

export async function deleteSetting(formData: FormData) {
  const tenantId = await getCurrentTenantId();
  const id = String(formData.get("settingId") ?? "");
  const setting = await prisma.setting.findFirst({ where: { id, tenantId } });
  if (!setting) throw new Error("Setting not found.");
  await prisma.setting.delete({ where: { id } });
  revalidatePath("/settings");
}
