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

export async function processMindbodyWebhook(
  tenantId: string,
  payload: MindbodyWebhookPayload
) {
  switch (payload.eventId) {
    case "appointmentBooking.created":
    case "appointmentBooking.updated":
      return handleAppointmentEvent(tenantId, payload);

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

  // Scheduled and rescheduled appointments update the patient mapping only.
  // Follow-up workflows begin only after Mindbody reports completion.
  if (!isCompletedAppointment(payload)) {
    return patient;
  }

  const appointmentId = String(data.appointmentId ?? "").trim();
  const service = String(data.appointmentName ?? "").trim();
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