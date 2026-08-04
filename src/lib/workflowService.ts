import { prisma } from "./prisma";
import { generateTasks, makeRecordCode } from "./engine";
import { filterDuplicateFollowUps } from "./dedupe";

export type CreateWorkflowInput = {
  tenantId: string;
  patientId: string;
  patientEvent: string;
  service: string;
  eventDate: Date;
  provider?: string | null;
  notes?: string | null;
  mindbodyAppointmentId?: string | null;
  skipPastDueTasks?: boolean;
};

export async function createWorkflowRecord(input: CreateWorkflowInput) {
  const {
    tenantId,
    patientId,
    patientEvent,
    service,
    eventDate,
    provider = null,
    notes = null,
    mindbodyAppointmentId = null,
    skipPastDueTasks = false,
  } = input;

  if (mindbodyAppointmentId) {
    const existing = await prisma.workflowRecord.findFirst({
      where: {
        tenantId,
        mindbodyAppointmentId,
      },
    });

    if (existing) {
      return {
        record: existing,
        created: false,
        skippedPastDue: 0,
        suppressedDuplicates: 0,
      };
    }
  }

  const generated = await generateTasks(
    tenantId,
    patientEvent,
    service,
    eventDate
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const eligibleTasks = skipPastDueTasks
    ? generated.filter((task) => task.dueDate >= today)
    : generated;

  const skippedPastDue = generated.length - eligibleTasks.length;

  const { toCreate, suppressed } = await filterDuplicateFollowUps(
    tenantId,
    patientId,
    eligibleTasks
  );

  const recordStatus = toCreate.length > 0 ? "In Progress" : "Completed";

  const notesParts = [notes];

  if (skippedPastDue > 0) {
    notesParts.push(
      `${skippedPastDue} past-due follow-up${
        skippedPastDue === 1 ? "" : "s"
      } skipped during Mindbody backfill.`
    );
  }

  if (suppressed.length > 0) {
    notesParts.push(
      `${suppressed.length} follow-up${
        suppressed.length === 1 ? "" : "s"
      } merged because the patient already had ${
        suppressed.length === 1 ? "it" : "them"
      } due that day.`
    );
  }

  const finalNotes = notesParts.filter(Boolean).join(" · ") || null;

  const record = await prisma.workflowRecord.create({
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
      mindbodyAppointmentId,
      tasks: {
        create: toCreate.map((task) => ({
          tenantId,
          stepNumber: task.stepNumber,
          workflowStep: task.workflowStep,
          assignedTo: task.assignedTo,
          priority: task.priority,
          anchor: task.anchor,
          delayDays: task.delayDays,
          dueDate: task.dueDate,
          automationTemplate: task.automationTemplate,
          status: "Pending",
        })),
      },
    },
  });

  await prisma.toxPatient.updateMany({
    where: {
      tenantId,
      patientId,
      OR: [{ lastVisitDate: null }, { lastVisitDate: { lt: eventDate } }],
    },
    data: {
      lastVisitDate: eventDate,
    },
  });

  return {
    record,
    created: true,
    skippedPastDue,
    suppressedDuplicates: suppressed.length,
  };
}