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

export async function processMindbodyWebhook(
  tenantId: string,
  payload: MindbodyWebhookPayload
) {
  switch (payload.eventId) {
    case "appointmentBooking.created":
      return handleAppointmentCreated(tenantId, payload);

    default:
      // Everything else is intentionally ignored for now.
      return;
  }
}

async function handleAppointmentCreated(
  tenantId: string,
  payload: MindbodyWebhookPayload
) {
  const data = payload.eventData;
  if (!data?.clientUniqueId) return;

  console.log(
    `[Mindbody] Appointment created for client ${data.clientUniqueId}`
  );

  // Phase 1:
  // Next we'll resolve/create the patient and attach the Mindbody Client ID.
}