/**
 * Seeds the LL Aesthetics operating system with its CONFIGURATION only:
 *   - the follow-up rules engine (from the TOOL Service Rules Master document)
 *   - dropdown vocabularies (services, steps, providers, etc.)
 *   - message-template placeholders (one per rule automation)
 *   - a couple of clearly-fake demo patients so the app isn't empty
 *
 * NO real patient data is committed here. Real patients are added through the
 * app and live only in your local database.
 *
 * Timings (delay in days) for steps that the source document didn't specify are
 * sensible defaults — all editable in-app on the Service Rules screen.
 */
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password";

const prisma = new PrismaClient();

const TENANT = { name: "LL Aesthetics", slug: "ll-aesthetics" };
const DEFAULT_OWNER = "Front Desk";

// Canonical follow-up step specs: [delayDays, anchor, priority].
// This is the single place to tune default timing for a step.
const STEP: Record<string, { d: number; a: string; p: string }> = {
  "Post-Care Instructions": { d: 0, a: "Treatment Completed", p: "High" },
  "1-Day Check-In": { d: 1, a: "Treatment Date", p: "High" },
  "2-Day Check-In": { d: 2, a: "Treatment Date", p: "Medium" },
  "2-Week Results Check": { d: 14, a: "Treatment Date", p: "Medium" },
  "2.5-Month Rebooking Reminder": { d: 75, a: "Treatment Date", p: "Medium" },
  "4-Week Rebooking Reminder": { d: 28, a: "Treatment Date", p: "Medium" },
  "5-Week Rebooking Reminder": { d: 35, a: "Treatment Date", p: "Medium" },
  "6-Month Reactivation": { d: 180, a: "Treatment Date", p: "Low" },
  "9-Month Reactivation": { d: 270, a: "Treatment Date", p: "Low" },
  "4-8 Week Rebooking Reminder": { d: 42, a: "Treatment Date", p: "Medium" }, // ~6 wk midpoint
  "Monthly Rebooking Reminder": { d: 30, a: "Treatment Date", p: "Medium" },
  "Refer a Friend Reminder": { d: 30, a: "Treatment Date", p: "Low" },
  "Next Treatment Reminder (Series)": { d: 28, a: "Treatment Date", p: "Medium" },
  "Next Treatment Reminder (4-6 Weeks)": { d: 35, a: "Treatment Date", p: "Medium" },
  "Membership Invitation": { d: 3, a: "Treatment Date", p: "Medium" },
  "Rebooking Reminder": { d: 28, a: "Treatment Date", p: "Medium" },
  "Welcome Message": { d: 0, a: "Treatment Date", p: "High" },
  "Treatment Plan Follow-Up #1 (No Booking)": { d: 2, a: "Treatment Date", p: "High" },
  "Treatment Plan Follow-Up #2 (No Booking)": { d: 7, a: "Treatment Date", p: "High" },
  "Promotional Follow-Up": { d: 14, a: "Treatment Date", p: "Low" },
  "Treatment Plan Follow-Up #1": { d: 2, a: "Treatment Plan Created", p: "High" },
  "Treatment Plan Follow-Up #2": { d: 7, a: "Treatment Plan Created", p: "High" },
  "Promotional Reminder": { d: 14, a: "Treatment Plan Created", p: "Low" },
  "Thank You Message": { d: 1, a: "Treatment Date", p: "Medium" },
  "Consultation Invitation": { d: 3, a: "Treatment Date", p: "Medium" },
  "Lead Greeting #1": { d: 0, a: "Lead Created", p: "High" },
  "Lead Greeting #2": { d: 3, a: "Lead Created", p: "Medium" },
  "Lead Promotion Greeting": { d: 5, a: "Lead Created", p: "Medium" },
  "Follow-Up": { d: 2, a: "Treatment Date", p: "Medium" },
  "Prescription Sent Notification": { d: 0, a: "Prescription Date", p: "High" },
  "1-Month Refill Reminder": { d: 30, a: "Prescription Date", p: "Medium" },
  // Safety-net general sequence (used when a service has no rules of its own):
  "2-Day Check-In (General)": { d: 2, a: "Treatment Date", p: "Medium" },
};

// Each service and its ordered follow-up sequence, exactly per the master doc.
type Svc = { event: string; service: string; category: string; steps: string[] };
const SERVICES: Svc[] = [
  // ---- Medical Services (trigger: Treatment Completed) ----
  { event: "Treatment Completed", service: "Botox", category: "Injectable", steps: ["2-Week Results Check", "2.5-Month Rebooking Reminder"] },
  { event: "Treatment Completed", service: "BBL HERO", category: "Laser", steps: ["Post-Care Instructions", "2-Day Check-In", "2-Week Results Check", "4-Week Rebooking Reminder"] },
  { event: "Treatment Completed", service: "Complexion Renewal", category: "Skin / Facial", steps: ["Post-Care Instructions", "2-Day Check-In", "4-Week Rebooking Reminder"] },
  { event: "Treatment Completed", service: "Dermal Filler", category: "Injectable", steps: ["Post-Care Instructions", "2-Day Check-In", "2-Week Results Check", "6-Month Reactivation"] },
  { event: "Treatment Completed", service: "Forever Clear", category: "Laser", steps: ["Post-Care Instructions", "2-Day Check-In", "Next Treatment Reminder (Series)"] },
  { event: "Treatment Completed", service: "HALO", category: "Laser", steps: ["Post-Care Instructions", "1-Day Check-In", "2-Week Results Check", "6-Month Reactivation"] },
  { event: "Treatment Completed", service: "Laser Hair Removal", category: "Laser", steps: ["Post-Care Instructions", "4-8 Week Rebooking Reminder"] },
  { event: "Treatment Completed", service: "PRF EZ Gel", category: "Regenerative", steps: ["Post-Care Instructions", "1-Day Check-In", "5-Week Rebooking Reminder", "9-Month Reactivation"] },
  { event: "Treatment Completed", service: "PRF Hair Restoration", category: "Regenerative", steps: ["Post-Care Instructions", "1-Day Check-In", "Next Treatment Reminder (Series)", "9-Month Reactivation"] },
  { event: "Treatment Completed", service: "XERF", category: "Laser", steps: ["2-Day Check-In", "5-Week Rebooking Reminder", "6-Month Reactivation"] },

  // ---- Aesthetician Services (trigger: Treatment Completed) ----
  { event: "Treatment Completed", service: "Facial Membership", category: "Skin / Facial", steps: ["Monthly Rebooking Reminder", "Refer a Friend Reminder"] },
  { event: "Treatment Completed", service: "Facial (Non-Member)", category: "Skin / Facial", steps: ["4-Week Rebooking Reminder", "Membership Invitation", "6-Month Reactivation"] },
  { event: "Treatment Completed", service: "Microneedling Membership", category: "Skin / Facial", steps: ["Next Treatment Reminder (4-6 Weeks)", "Refer a Friend Reminder"] },
  { event: "Treatment Completed", service: "Microneedling (Non-Member)", category: "Skin / Facial", steps: ["Next Treatment Reminder (4-6 Weeks)", "Membership Invitation", "6-Month Reactivation"] },
  { event: "Treatment Completed", service: "PRX Membership", category: "Skin / Facial", steps: ["Refer a Friend Reminder"] },
  { event: "Treatment Completed", service: "PRX Package (Non-Member)", category: "Skin / Facial", steps: ["Post-Care Instructions", "Rebooking Reminder", "Membership Invitation", "6-Month Reactivation"] },
  { event: "Treatment Completed", service: "Chemical Peel Membership", category: "Skin / Facial", steps: ["Refer a Friend Reminder"] },
  { event: "Treatment Completed", service: "Chemical Peel (Non-Member)", category: "Skin / Facial", steps: ["Membership Invitation", "6-Month Reactivation"] },

  // ---- Non-Treatment Workflows ----
  { event: "Consultation Scheduled", service: "Consultation", category: "Consultation", steps: ["Welcome Message", "Treatment Plan Follow-Up #1 (No Booking)", "Treatment Plan Follow-Up #2 (No Booking)", "Promotional Follow-Up"] },
  { event: "Treatment Plan Created", service: "Treatment Plan", category: "Treatment Plan", steps: ["Treatment Plan Follow-Up #1", "Treatment Plan Follow-Up #2", "Promotional Reminder"] },
  { event: "Treatment Completed", service: "Aura Photos", category: "General", steps: ["Thank You Message", "Consultation Invitation"] },
  { event: "Walk-In / Spa Tour", service: "Tour / Walk-In", category: "Lead", steps: ["Lead Greeting #1", "Lead Greeting #2", "Promotional Follow-Up"] },
  { event: "Consultation Scheduled", service: "Peptides Consultation", category: "Peptide", steps: ["Follow-Up", "Prescription Sent Notification", "1-Month Refill Reminder"] },

  // ---- Leads pipeline (drives the Leads page greeting sequence) ----
  { event: "New Lead", service: "Lead", category: "Lead", steps: ["Lead Greeting #1", "Lead Greeting #2", "Lead Promotion Greeting"] },

  // ---- Safety net ----
  { event: "Treatment Completed", service: "General Follow-Up", category: "General", steps: ["Post-Care Instructions", "2-Day Check-In"] },
];

// --- Settings vocabularies ---
const SETTINGS: Record<string, string[]> = {
  Provider: ["Lindsey Lasko", "Kayton Sickels", "Kamryn Rice", "Reese Munger", "Front Desk"],
  AssignedTo: ["Front Desk", "Provider", "Patient Care Coordinator", "Office Manager", "Marketing", "Billing", "Owner"],
  PatientEvent: [
    "Treatment Completed", "Consultation Scheduled", "Treatment Plan Created", "Walk-In / Spa Tour",
    "New Lead", "Appointment Booked", "Membership Purchased", "Prescription Sent", "Peptide Refill Due",
    "Patient Overdue", "No Show", "Pricing Inquiry", "Retail Purchase",
  ],
  Service: [
    "Botox", "Dermal Filler", "BBL HERO", "Complexion Renewal", "Forever Clear", "HALO",
    "Laser Hair Removal", "PRF EZ Gel", "PRF Hair Restoration", "XERF",
    "Facial Membership", "Facial (Non-Member)", "Microneedling Membership", "Microneedling (Non-Member)",
    "PRX Membership", "PRX Package (Non-Member)", "Chemical Peel Membership", "Chemical Peel (Non-Member)",
    "Consultation", "Treatment Plan", "Aura Photos", "Tour / Walk-In", "Peptides Consultation",
    "Lead", "Membership", "Retail Product", "General Follow-Up", "General",
  ],
  WorkflowStep: [
    "Post-Care Instructions", "1-Day Check-In", "2-Day Check-In", "2-Week Results Check",
    "2.5-Month Rebooking Reminder", "4-Week Rebooking Reminder", "5-Week Rebooking Reminder",
    "4-8 Week Rebooking Reminder", "Monthly Rebooking Reminder", "Rebooking Reminder",
    "6-Month Reactivation", "9-Month Reactivation", "Refer a Friend Reminder", "Membership Invitation",
    "Next Treatment Reminder (Series)", "Next Treatment Reminder (4-6 Weeks)",
    "Welcome Message", "Treatment Plan Follow-Up #1 (No Booking)", "Treatment Plan Follow-Up #2 (No Booking)",
    "Treatment Plan Follow-Up #1", "Treatment Plan Follow-Up #2", "Promotional Follow-Up", "Promotional Reminder",
    "Thank You Message", "Consultation Invitation", "Lead Greeting #1", "Lead Greeting #2",
    "Follow-Up", "Prescription Sent Notification", "1-Month Refill Reminder",
    "Lead Promotion Greeting", "Results Check", "Call Patient", "Provider Review",
  ],
  Priority: ["Critical", "High", "Medium", "Low"],
  Status: ["Pending", "Scheduled", "In Progress", "Waiting on Patient", "Completed", "Closed", "Cancelled"],
  ActionResult: [
    "Rebooked", "Appointment Scheduled", "Interested", "Left Voicemail", "Spoke with Patient", "Sent Text",
    "Sent Email", "No Answer", "Declined Treatment", "Declined Follow-Up", "Needs Provider Review",
    "Prescription Sent", "Referred a Friend", "Joined Membership", "Completed", "Cancelled", "Custom",
  ],
  ServiceCategory: [
    "Injectable", "Laser", "Skin / Facial", "Regenerative", "Peptide", "Membership", "Consultation",
    "Treatment Plan", "Lead", "Appointment", "Retail", "Reactivation", "General",
  ],
  Anchor: [
    "Treatment Completed", "Treatment Date", "Appointment Booked", "Appointment Date", "Treatment Plan Created",
    "Lead Created", "Tour Date", "Membership Purchase Date", "Prescription Date", "Previous Step",
  ],
  LeadSource: [
    "Walk-In", "Phone Call", "Social Message", "Instagram DM", "Facebook", "Referral",
    "Website", "Email", "Event", "Existing Patient", "Other",
  ],
  PeptideProduct: [
    "Tirzepatide", "Semaglutide", "CJC 1295/Ipamorelin", "Ipamorelin", "Tesamorelin",
    "Tesamorelin/AOD 9604", "AOD-9604", "BPC-157", "NAD+", "PT-141 (Bremelanotide)",
    "GHK-Cu", "Sermorelin", "Glutathione",
  ],
};

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { slug: TENANT.slug },
    update: {},
    create: TENANT,
  });
  const tenantId = tenant.id;

  // Only seed configuration into a FRESH database (or when FORCE_SEED=1).
  // This protects your live rules, settings, and patients across redeploys.
  const existingRules = await prisma.serviceRule.count({ where: { tenantId } });
  const force = process.env.FORCE_SEED === "1";

  if (existingRules > 0 && !force) {
    console.log("Config already present — leaving your rules, settings, and data untouched.");
  } else {
    await seedConfig(tenantId, tenant.name);
  }

  // Always ensure an owner login exists (never overwrites an existing password).
  await ensureOwner(tenantId);
}

async function ensureOwner(tenantId: string) {
  const email = (process.env.SEED_ADMIN_EMAIL || "laskolindsey@gmail.com").toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Owner login already exists: ${email}`);
    return;
  }
  const password = process.env.SEED_ADMIN_PASSWORD || "changeme-now";
  await prisma.user.create({
    data: {
      tenantId,
      email,
      name: "Lindsey Lasko",
      role: "owner",
      passwordHash: hashPassword(password),
    },
  });
  console.log(`Created owner login: ${email}`);
}

async function seedConfig(tenantId: string, tenantName: string) {
  await prisma.task.deleteMany({ where: { tenantId } });
  await prisma.workflowRecord.deleteMany({ where: { tenantId } });
  await prisma.patient.deleteMany({ where: { tenantId, isDemo: true } });
  await prisma.serviceRule.deleteMany({ where: { tenantId } });
  await prisma.setting.deleteMany({ where: { tenantId } });
  await prisma.messageTemplate.deleteMany({ where: { tenantId } });

  // Flatten services → rules.
  const ruleRows: {
    tenantId: string; patientEvent: string; service: string; serviceCategory: string;
    step: number; workflowStep: string; delayDays: number; anchor: string;
    assignedTo: string; priority: string; automationTemplate: string; active: boolean;
  }[] = [];

  for (const svc of SERVICES) {
    svc.steps.forEach((label, i) => {
      const spec = STEP[label];
      if (!spec) throw new Error(`Missing STEP spec for "${label}"`);
      ruleRows.push({
        tenantId,
        patientEvent: svc.event,
        service: svc.service,
        serviceCategory: svc.category,
        step: i + 1,
        workflowStep: label.replace(" (General)", ""),
        delayDays: spec.d,
        anchor: spec.a,
        assignedTo: DEFAULT_OWNER,
        priority: spec.p,
        automationTemplate: label.replace(" (General)", ""),
        active: true,
      });
    });
  }
  await prisma.serviceRule.createMany({ data: ruleRows });

  // Settings vocabularies.
  for (const [type, values] of Object.entries(SETTINGS)) {
    await prisma.setting.createMany({
      data: values.map((value, i) => ({ tenantId, type, value, sortOrder: i })),
    });
  }

  // Message template placeholders (one per unique automation key).
  const templateKeys = Array.from(new Set(ruleRows.map((r) => r.automationTemplate)));
  await prisma.messageTemplate.createMany({
    data: templateKeys.map((key) => ({ tenantId, key, name: key, channel: "SMS", body: "" })),
  });

  // Fictional demo patients so the app isn't empty on first launch. Delete anytime.
  const demoNames = ["Demo — Jane Sample", "Demo — Alex Test"];
  for (const name of demoNames) {
    await prisma.patient.create({ data: { tenantId, name, isDemo: true } });
  }

  // Fictional demo Botox-tracker patients so the tracker shows its colors on
  // first launch. Import your real list on the Botox Tracker → Import screen.
  const demoTox: { name: string; status: string; note?: string; club?: boolean }[] = [
    { name: "Demo — Happy Patient", status: "happy", note: "Loved her results", club: true },
    { name: "Demo — Tough Patient", status: "watch", note: "Never quite happy, but keeps coming" },
    { name: "Demo — Unhappy Patient", status: "not_happy", note: "Didn't feel it worked" },
    { name: "Demo — New Patient", status: "awaiting" },
  ];
  for (const t of demoTox) {
    const p = await prisma.toxPatient.create({
      data: {
        tenantId,
        name: t.name,
        status: t.status,
        notes: t.note ?? null,
        isClubMember: !!t.club,
        isDemo: true,
        lastCheckDate: t.status !== "awaiting" ? new Date() : null,
      },
    });
    if (t.status !== "awaiting") {
      await prisma.toxCheck.create({
        data: { tenantId, toxPatientId: p.id, status: t.status, note: t.note ?? null },
      });
    }
  }

  const settingsCount = Object.values(SETTINGS).reduce((a, v) => a + v.length, 0);
  console.log(
    `Seeded "${tenantName}": ${ruleRows.length} rules across ${SERVICES.length} services, ` +
      `${settingsCount} settings, ${templateKeys.length} templates, 2 demo patients.`
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
