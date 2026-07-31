"use server";

import { prisma } from "./prisma";
import { getCurrentTenantId } from "./tenant";
import { formatDate } from "./dates";
import { draftWithChloe } from "./chloe";

export type ChloeResult = {
  ok: boolean;
  message?: string;
  escalate?: boolean;
  error?: string;
};

/** Have Chloe draft a message for a given follow-up task, in her voice. */
export async function generateChloeDraft(taskId: string): Promise<ChloeResult> {
  const tenantId = await getCurrentTenantId();
  const task = await prisma.task.findFirst({
    where: { id: taskId, tenantId },
    include: { record: { include: { patient: true } }, lead: true, peptideOrder: true, toxPatient: true },
  });
  if (!task) return { ok: false, error: "Task not found." };

  const patientName =
    task.record?.patient.name ??
    task.lead?.name ??
    task.peptideOrder?.patientName ??
    task.toxPatient?.name ??
    null;
  const service = task.record?.service ?? task.peptideOrder?.product ?? null;

  const facts: string[] = [];
  if (task.record) facts.push(`Last treatment: ${task.record.service} on ${formatDate(task.record.eventDate)}`);
  if (task.lead?.source) facts.push(`Lead source: ${task.lead.source}`);
  if (patientName) {
    const membership = await prisma.membership.findFirst({
      where: { tenantId, status: "Active", memberName: patientName },
    });
    if (membership) facts.push(`Active ${membership.tier} member`);
  }

  // Pull the relevant knowledge she's allowed to speak from (filled entries only).
  const knowledge: string[] = [];
  if (service) {
    const svc = await prisma.knowledgeEntry.findFirst({
      where: { tenantId, category: "Service", title: service, active: true, NOT: { content: "" } },
    });
    if (svc) knowledge.push(`${svc.title}: ${svc.content}`);
    const after = await prisma.knowledgeEntry.findFirst({
      where: { tenantId, category: "Aftercare", active: true, NOT: { content: "" }, title: { contains: service.split(" ")[0], mode: "insensitive" } },
    });
    if (after) knowledge.push(`${after.title}: ${after.content}`);
  }

  try {
    const draft = await draftWithChloe({
      kind: task.workflowStep,
      patientName,
      service,
      facts,
      knowledge,
    });
    return { ok: true, message: draft.message, escalate: draft.escalate };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Chloe hit an error." };
  }
}

/**
 * Have Chloe rewrite a message-library template in her voice — reusable, with
 * the merge tags kept in place. This is a one-time "make the fast template sound
 * like Chloe" pass; the front desk still reviews and saves it.
 */
export async function generateChloeTemplate(templateId: string): Promise<ChloeResult> {
  const tenantId = await getCurrentTenantId();
  const tpl = await prisma.messageTemplate.findFirst({ where: { id: templateId, tenantId } });
  if (!tpl) return { ok: false, error: "Template not found." };

  try {
    const draft = await draftWithChloe({
      kind: tpl.name,
      asTemplate: true,
    });
    return { ok: true, message: draft.message, escalate: draft.escalate };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Chloe hit an error." };
  }
}
