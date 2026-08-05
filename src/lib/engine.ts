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
// Mindbody service names often don't exactly match a Service Rule name — they add
// a size/tier suffix ("Laser Hair Removal Sm"), a brand tag ("PRX (WiQO)"), or use a
// different family name ("HydraFacial Signature"). This resolver routes those to the
// correct rule instead of dropping them into the generic fallback.

// Strip a "Category | Service" prefix, keeping the service portion.
function canonicalService(raw: string): string {
  return (raw.split("|").pop() ?? raw).trim();
}

// Explicit routes for names that don't share a prefix with any rule.
// Matched when the (lowercased) service name STARTS WITH the given prefix.
const SERVICE_ALIASES: { prefix: string; rule: string }[] = [
  // All PRX (incl. "PRX (WiQO)") share the same aftercare.
  { prefix: "prx", rule: "PRX Package (Non-Member)" },
  // Named facials that all follow the facial rule.
  { prefix: "hydrafacial", rule: "Facial (Non-Member)" },
  { prefix: "honey enzyme", rule: "Facial (Non-Member)" },
  { prefix: "foaming enzyme", rule: "Facial (Non-Member)" },
  { prefix: "fire and ice", rule: "Facial (Non-Member)" },
];

/**
 * Map a raw Mindbody service name to a known rule service name, or null.
 * Order: exact → explicit alias → rule-name prefix ("Laser Hair Removal Sm"
 * → "Laser Hair Removal"), preferring the most specific (longest) rule.
 */
function resolveRuleService(rawService: string, ruleNames: string[]): string | null {
  const lower = canonicalService(rawService).toLowerCase();
  if (!lower) return null;

  const exact = ruleNames.find((r) => r.toLowerCase() === lower);
  if (exact) return exact;

  for (const a of SERVICE_ALIASES) {
    if (lower.startsWith(a.prefix)) {
      const target = ruleNames.find((r) => r.toLowerCase() === a.rule.toLowerCase());
      if (target) return target;
    }
  }

  const prefixMatch = ruleNames
    .filter((r) => {
      const rl = r.toLowerCase();
      return lower === rl || lower.startsWith(rl + " ");
    })
    .sort((a, b) => b.length - a.length)[0];
  return prefixMatch ?? null;
}

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
  if (rules.length > 0) return rules;

  if (patientEvent === "Treatment Completed") {
    // Resolve a variant/alias name (e.g. "Laser Hair Removal Sm", "PRX (WiQO)",
    // "HydraFacial Signature") to a real rule before falling back to generic.
    const known = await prisma.serviceRule.findMany({
      where: { tenantId, patientEvent, active: true },
      select: { service: true },
      distinct: ["service"],
    });
    const names = known.map((r) => r.service).filter((n) => n !== "General Follow-Up");
    const resolved = resolveRuleService(service, names);
    if (resolved) {
      rules = await prisma.serviceRule.findMany({
        where: { tenantId, patientEvent, service: resolved, active: true },
        orderBy: { step: "asc" },
      });
      if (rules.length > 0) return rules;
    }

    // Generic safety net for a completed treatment with no matching rule at all.
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
