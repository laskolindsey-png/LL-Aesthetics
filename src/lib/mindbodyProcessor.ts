import { prisma } from "./prisma";

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
    startDateTime?: string;
    endDateTime?: string;
  };
};

function normalizePhone(value?: string | null): string | null {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits || null;
}

export async function processMindbodyWebhook(
  tenantId: string,
  payload: MindbodyWebhookPayload
) {
  switch (payload.eventId) {
    case "appointmentBooking.created":
      return handleAppointmentCreated(tenantId, payload);

    default:
      // Other event types will be added incrementally.
      return;
  }
}

async function handleAppointmentCreated(
  tenantId: string,
  payload: MindbodyWebhookPayload
) {
  const data = payload.eventData;
  if (!data) return;

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
      "[Mindbody] Appointment-created event is missing client ID or name."
    );
    return;
  }

  // First choice: an existing permanent Mindbody client mapping.
  let patient = await prisma.patient.findFirst({
    where: {
      tenantId,
      mindbodyClientId,
    },
  });

  // Second choice: Lindsey's requested deduplication rule — name + phone.
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
    patient = await prisma.patient.update({
      where: { id: patient.id },
      data: {
        mindbodyClientId,
        phone: phone ?? patient.phone,
        email: email ?? patient.email,
      },
    });

    console.log(
      `[Mindbody] Matched existing patient ${patient.id} to client ${mindbodyClientId}.`
    );

    return patient;
  }

  patient = await prisma.patient.create({
    data: {
      tenantId,
      name,
      phone,
      email,
      mindbodyClientId,
    },
  });

  console.log(
    `[Mindbody] Created patient ${patient.id} for client ${mindbodyClientId}.`
  );

  return patient;
}