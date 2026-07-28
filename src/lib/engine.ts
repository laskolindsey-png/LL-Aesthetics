import { prisma } from "./prisma";
import { addDays, startOfDay } from "./dates";

/**
 * The follow-up engine.
 *
 * Given a patient event (e.g. "Treatment Completed" + "Botox"), it looks up the
 * matching active ServiceRules and returns one task per step, with each due date
 * computed as eventDate + the rule's delay.
 *
 * Anchor handling: the workbook anchors steps to labels like "Treatment Date" or
 * "Lead Created". In Phase 1 we capture a single event date per record, and every
 * anchor resolves to that date — which is correct for all current rules. When we
 * add multi-anchor events (Phase 3), this is the single function to extend.
 */
export async function findMatchingRules(
  tenantId: string,
  patientEvent: string,
  service: string
) {
  // Exact match first.
  let rules = await prisma.serviceRule.findMany({
    where: { tenantId, patientEvent, service, active: true },
    orderBy: { step: "asc" },
  });

  // Fall back to the "General Follow-Up" sequence for a completed treatment
  // whose specific service has no rules of its own.
  if (rules.length === 0 && patientEvent === "Treatment Completed") {
    rules = await prisma.serviceRule.findMany({
      where: { tenantId, patientEvent, service: "General Follow-Up", active: true },
      orderBy: { step: "asc" },
    });
  }

  return rules;
}

export type GeneratedTask = {
  stepNumber: number;
  workflowStep: string;
  assignedTo: string;
  priority: string;
  anchor: string;
  delayDays: number;
  dueDate: Date;
  automationTemplate: string | null;
};

export async function generateTasks(
  tenantId: string,
  patientEvent: string,
  service: string,
  eventDate: Date
): Promise<GeneratedTask[]> {
  const rules = await findMatchingRules(tenantId, patientEvent, service);
  const anchor = startOfDay(eventDate);
  return rules.map((r) => ({
    stepNumber: r.step,
    workflowStep: r.workflowStep,
    assignedTo: r.assignedTo,
    priority: r.priority,
    anchor: r.anchor,
    delayDays: r.delayDays,
    dueDate: addDays(anchor, r.delayDays),
    automationTemplate: r.automationTemplate,
  }));
}

/** Generate a human-friendly record code: T + timestamp, matching the workbook. */
export function makeRecordCode(now = new Date()): string {
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  return (
    "T" +
    now.getFullYear() +
    p(now.getMonth() + 1) +
    p(now.getDate()) +
    p(now.getHours()) +
    p(now.getMinutes()) +
    p(now.getSeconds()) +
    p(now.getMilliseconds(), 3)
  );
}
