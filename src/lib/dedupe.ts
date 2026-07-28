import { prisma } from "./prisma";
import { toDateInput } from "./dates";
import type { GeneratedTask } from "./engine";

/**
 * Same-day communication de-duplication.
 *
 * When a patient has several services in one day, each one generates its own
 * follow-up sequence — and those sequences overlap (two "Post-Care Instructions,"
 * two "2-Week Results Check," etc.). Without this, the patient would get the same
 * message two or three times. This keeps ONE of each communication per day and
 * drops the duplicates.
 *
 * It matters most once Mindbody is connected, because Mindbody sends a completed-
 * appointment event per service — so a 3-service day would otherwise fan out into
 * triple the reminders. The same logic protects manual entry today.
 *
 * A "communication" is identified by its template (falling back to the step name)
 * plus the day it's due. Matching keys collapse to one.
 */
export function communicationKey(
  workflowStep: string,
  automationTemplate: string | null,
  dueDate: Date | null
): string {
  const comm = (automationTemplate ?? workflowStep).trim().toLowerCase();
  const day = dueDate ? toDateInput(dueDate) : "no-date";
  return `${comm}::${day}`;
}

export type DedupeResult = {
  toCreate: GeneratedTask[];
  suppressed: GeneratedTask[];
};

/**
 * Given the follow-ups a new visit wants to create, return only the ones the
 * patient doesn't already have for that same day/communication — plus the list
 * that was suppressed as duplicates. De-dupes against existing open tasks AND
 * within the incoming batch itself.
 */
export async function filterDuplicateFollowUps(
  tenantId: string,
  patientId: string,
  candidates: GeneratedTask[]
): Promise<DedupeResult> {
  // Every still-open follow-up this patient already has (across all their records).
  const existing = await prisma.task.findMany({
    where: {
      tenantId,
      status: { notIn: ["Completed", "Cancelled"] },
      record: { patientId },
    },
    select: { workflowStep: true, automationTemplate: true, dueDate: true },
  });

  const seen = new Set(
    existing.map((t) => communicationKey(t.workflowStep, t.automationTemplate, t.dueDate))
  );

  const toCreate: GeneratedTask[] = [];
  const suppressed: GeneratedTask[] = [];
  for (const c of candidates) {
    const key = communicationKey(c.workflowStep, c.automationTemplate, c.dueDate);
    if (seen.has(key)) {
      suppressed.push(c);
    } else {
      seen.add(key); // also collapse duplicates within this same batch
      toCreate.push(c);
    }
  }
  return { toCreate, suppressed };
}
