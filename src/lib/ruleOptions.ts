import { prisma } from "./prisma";

/** Loads all the dropdown vocabularies the rule editor needs. */
export async function loadRuleOptions(tenantId: string) {
  const settings = await prisma.setting.findMany({
    where: { tenantId, active: true },
    orderBy: { sortOrder: "asc" },
  });
  const by = (type: string) => settings.filter((s) => s.type === type).map((s) => s.value);
  return {
    patientEvents: by("PatientEvent"),
    services: by("Service"),
    workflowSteps: by("WorkflowStep"),
    categories: by("ServiceCategory"),
    anchors: by("Anchor"),
    assignees: by("AssignedTo"),
    priorities: by("Priority"),
  };
}
