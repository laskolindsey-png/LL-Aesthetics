import { prisma } from "./prisma";
import { createWorkflowRecord } from "./workflowService";

type MindbodyWebhookPayload = {
  eventId?: string;
  eventData?: {
    appointmentId?: number;
    clientId?: string;
    clientUniqueId?: number;
    clientFirstName?: string;
    clientLastName?: string;
    clientPhone?: string | null;
    clientEmail?: string | null;
    appointmentName?: string;
    status?: string;
    staffFirstName?: string;
    staffLastName?: string;
    startDateTime?: string;
    endDateTime?: string;

    saleId?: number;
    saleDateTime?: string;
    appointmentIds?: number[];
    items?: Array<{
      type?: string;
      name?: string;
      quantity?: number;
      amountPaid?: number;
      recipientClientId?: string;
    }>;
  };
};

function normalizePhone(value?: string | null): string | null {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits || null;
}

function isCompletedAppointment(payload: MindbodyWebhookPayload): boolean {
  const status = String(payload.eventData?.status ?? "")
    .trim()
    .toLowerCase();

  return ["completed", "checked out", "checkout", "finished"].includes(status);
}

// --- Tox Tracker sync -------------------------------------------------------
// The Tox Tracker's reactivation clock should be driven by real Mindbody visits,
// not spreadsheet guesses. These helpers keep it current going forward: a Botox
// visit stamps the patient's last-visit date (creating a tracker row if they're
// new), and a booked "2 week enhancement" clears the dosing-check flag.

function isBotoxService(service: string): boolean {
  const s = service.toLowerCase();
  return /\b(botox|dysport|jeuveau|xeomin|daxxify|neurotoxin|neuromodulator|wrinkle relaxer|lip flip|tox)\b/.test(
    s
  );
}

function isTwoWeekEnhancement(service: string): boolean {
  const s = service.toLowerCase();
  const twoWeek =
    s.includes("2 week") ||
    s.includes("two week") ||
    s.includes("2-week") ||
    s.includes("two-week");
  return (
    twoWeek &&
    (s.includes("enhance") ||
      s.includes("touch") ||
      s.includes("follow") ||
      s.includes("visit") ||
      s.includes("check"))
  );
}

// A Botox visit came in: stamp the tracker's last-visit date (forward only —
// never move it backwards) and create a tracker row if the patient is new.
// Matches an existing tracker row by patient link first, then by name.
async function recordToxVisit(
  tenantId: string,
  patient: { id: string; name: string; phone: string | null },
  eventDate: Date
) {
  let tox = await prisma.toxPatient.findFirst({
    where: { tenantId, patientId: patient.id },
  });
  if (!tox) {
    tox = await prisma.toxPatient.findFirst({
      where: {
        tenantId,
        name: { equals: patient.name, mode: "insensitive" },
      },
    });
  }

  if (tox) {
    const data: Record<string, unknown> = {};
    if (!tox.patientId) data.patientId = patient.id;
    if (!tox.lastVisitDate || tox.lastVisitDate < eventDate) {
      data.lastVisitDate = eventDate;
    }
    if (Object.keys(data).length === 0) return tox;
    try {
      return await prisma.toxPatient.update({ where: { id: tox.id }, data });
    } catch {
      // A unique patient link may already be held by another row — retry
      // without touching the link so the date still advances.
      delete data.patientId;
      if (Object.keys(data).length === 0) return tox;
      return prisma.toxPatient.update({ where: { id: tox.id }, data });
    }
  }

  return prisma.toxPatient.create({
    data: {
      tenantId,
      name: patient.name,
      phone: patient.phone,
      patientId: patient.id,
      status: "awaiting",
      lastVisitDate: eventDate,
    },
  });
}

// A "2 week enhancement" was booked (or attended): mark it on the tracker so the
// "check dosing" flag clears for this cycle. Only updates an existing row.
async function markTwoWeekBooked(
  tenantId: string,
  patient: { id: string; name: string },
  whenDate: Date | null
) {
  let tox = await prisma.toxPatient.findFirst({
    where: { tenantId, patientId: patient.id },
  });
  if (!tox) {
    tox = await prisma.toxPatient.findFirst({
      where: {
        tenantId,
        name: { equals: patient.name, mode: "insensitive" },
      },
    });
  }
  if (!tox) return;
  await prisma.toxPatient.update({
    where: { id: tox.id },
    data: {
      twoWeekBooked: true,
      twoWeekDate: whenDate ?? tox.twoWeekDate,
    },
  });
}

export async function processMindbodyWebhook(
  tenantId: string,
  payload: MindbodyWebhookPayload
) {
  switch (payload.eventId) {
    case "appointmentBooking.created":
    case "appointmentBooking.updated":
      return handleAppointmentEvent(tenantId, payload);

    case "appointmentBooking.cancelled":
      return handleAppointmentCancelled(tenantId, payload);

    case "clientSale.created":
      return handleClientSaleCreated(tenantId, payload);

    default:
      return;
  }
}

async function resolvePatient(
  tenantId: string,
  payload: MindbodyWebhookPayload
) {
  const data = payload.eventData;
  if (!data) return null;

  const mindbodyClientId = String(
    data.clientId ?? data.clientUniqueId ?? ""
  ).trim();

  const firstName = String(data.clientFirstName ?? "").trim();
  const lastName = String(data.clientLastName ?? "").trim();
  const name = `${firstName} ${lastName}`.trim();

  const phone = normalizePhone(data.clientPhone);
  const email = String(data.clientEmail ?? "").trim() || null;

  if (!mindbodyClientId || !name) {
    console.warn(
      "[Mindbody] Appointment event is missing client ID or client name."
    );
    return null;
  }

  let patient = await prisma.patient.findFirst({
    where: {
      tenantId,
      mindbodyClientId,
    },
  });

  if (!patient && phone) {
    patient = await prisma.patient.findFirst({
      where: {
        tenantId,
        name,
        phone,
      },
    });
  }

  if (patient) {
    return prisma.patient.update({
      where: { id: patient.id },
      data: {
        mindbodyClientId,
        phone: phone ?? patient.phone,
        email: email ?? patient.email,
      },
    });
  }

  return prisma.patient.create({
    data: {
      tenantId,
      name,
      phone,
      email,
      mindbodyClientId,
    },
  });
}

async function handleAppointmentEvent(
  tenantId: string,
  payload: MindbodyWebhookPayload
) {
  const data = payload.eventData;
  if (!data) return;

  const patient = await resolvePatient(tenantId, payload);
  if (!patient) return;

  const service = String(data.appointmentName ?? "").trim();

  // A booked "2 week enhancement" clears the dosing-check flag for this cycle,
  // whether or not the visit has happened yet — so run this before the
  // completion gate below.
  if (service && isTwoWeekEnhancement(service)) {
    const startRaw = String(data.startDateTime ?? "").trim();
    const startDate = startRaw ? new Date(startRaw) : null;
    const when =
      startDate && !Number.isNaN(startDate.getTime()) ? startDate : null;
    try {
      await markTwoWeekBooked(tenantId, patient, when);
    } catch (err) {
      console.warn("[Mindbody] Could not mark 2-week enhancement booking.", err);
    }
  }

  // Scheduled and rescheduled appointments update the patient mapping only.
  // Follow-up workflows begin only after Mindbody reports completion.
  if (!isCompletedAppointment(payload)) {
    return patient;
  }

  const appointmentId = String(data.appointmentId ?? "").trim();
  const startDateTime = String(data.startDateTime ?? "").trim();

  if (!appointmentId || !service || !startDateTime) {
    console.warn(
      "[Mindbody] Completed appointment is missing ID, service, or start date."
    );
    return patient;
  }

  const eventDate = new Date(startDateTime);

  if (Number.isNaN(eventDate.getTime())) {
    console.warn("[Mindbody] Appointment start date is invalid.");
    return patient;
  }

  // Keep the Tox Tracker's reactivation clock honest from real visits.
  if (isBotoxService(service) || isTwoWeekEnhancement(service)) {
    try {
      await recordToxVisit(tenantId, patient, eventDate);
    } catch (err) {
      console.warn("[Mindbody] Could not sync Tox Tracker visit.", err);
    }
  }

  const config = await prisma.mindbodyConfig.findUnique({
    where: { tenantId },
  });

  // Appointments before the configured lookback date update the patient mapping
  // but do not create a workflow or tasks.
  if (
    config?.workflowCutoffDate &&
    eventDate < config.workflowCutoffDate
  ) {
    return patient;
  }

  const provider =
    `${String(data.staffFirstName ?? "").trim()} ${String(
      data.staffLastName ?? ""
    ).trim()}`.trim() || null;

  return createWorkflowRecord({
    tenantId,
    patientId: patient.id,
    patientEvent: "Treatment Completed",
    service,
    eventDate,
    provider,
    mindbodyAppointmentId: appointmentId,
    skipPastDueTasks: true,
    notes: "Created automatically from Mindbody.",
  });
}

async function handleAppointmentCancelled(
  tenantId: string,
  payload: MindbodyWebhookPayload
) {
  const appointmentId = String(
    payload.eventData?.appointmentId ?? ""
  ).trim();

  if (!appointmentId) return;

  const record = await prisma.workflowRecord.findFirst({
    where: {
      tenantId,
      mindbodyAppointmentId: appointmentId,
    },
    include: {
      tasks: true,
    },
  });

  if (!record) return;

  await prisma.task.updateMany({
    where: {
      recordId: record.id,
      status: {
        not: "Completed",
      },
    },
    data: {
      status: "Cancelled",
      notes: "Cancelled automatically after Mindbody appointment cancellation.",
    },
  });

  await prisma.workflowRecord.update({
    where: {
      id: record.id,
    },
    data: {
      status: "Cancelled",
      notes: [record.notes, "Mindbody appointment cancelled."]
        .filter(Boolean)
        .join(" · "),
    },
  });
}

function normalizeServiceName(service: string): string {
  return service
    .split("|")
    .pop()
    ?.trim() ?? service.trim();
}

async function handleClientSaleCreated(
  tenantId: string,
  payload: MindbodyWebhookPayload
) {
  const data = payload.eventData;
  if (!data) return;

  const appointmentId = String(data.appointmentIds?.[0] ?? "").trim();

  const serviceItem = data.items?.find(
    (item) =>
      String(item.type ?? "").toLowerCase() === "service" &&
      String(item.name ?? "").trim()
  );

  const service = normalizeServiceName(
    String(serviceItem?.name ?? "")
  );

  const mindbodyClientId = String(
    serviceItem?.recipientClientId ?? data.clientUniqueId ?? ""
  ).trim();

  const saleDateTime = String(data.saleDateTime ?? "").trim();

  if (!appointmentId || !service || !mindbodyClientId || !saleDateTime) {
    console.warn(
      "[Mindbody] Sale event is missing appointment, service, client, or sale date."
    );
    return;
  }

  const eventDate = new Date(saleDateTime);

  if (Number.isNaN(eventDate.getTime())) {
    console.warn("[Mindbody] Sale date is invalid.");
    return;
  }

  const patient = await prisma.patient.findFirst({
    where: {
      tenantId,
      mindbodyClientId,
    },
  });

  if (!patient) {
    console.warn(
      `[Mindbody] No patient mapping found for client ${mindbodyClientId}.`
    );
    return;
  }

  const config = await prisma.mindbodyConfig.findUnique({
    where: { tenantId },
  });

  // Keep the Tox Tracker current when Botox is sold at checkout.
  if (isBotoxService(service) || isTwoWeekEnhancement(service)) {
    try {
      await recordToxVisit(tenantId, patient, eventDate);
    } catch (err) {
      console.warn("[Mindbody] Could not sync Tox Tracker visit from sale.", err);
    }
  }

  if (
    config?.workflowCutoffDate &&
    eventDate < config.workflowCutoffDate
  ) {
    return;
  }

  return createWorkflowRecord({
    tenantId,
    patientId: patient.id,
    patientEvent: "Treatment Completed",
    service,
    eventDate,
    mindbodyAppointmentId: appointmentId,
    skipPastDueTasks: true,
    notes: "Created automatically from Mindbody checkout.",
  });
}
