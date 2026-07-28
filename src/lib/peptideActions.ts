"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "./prisma";
import { getCurrentTenantId } from "./tenant";
import { fromDateInput, addDays } from "./dates";

// When an order ships, schedule its follow-ups off the shipped date:
// a 1-week check-in and a 30-day refill reminder. Runs once (first time shipped).
async function onShipped(tenantId: string, orderId: string, shippedAt: Date) {
  const existing = await prisma.task.count({ where: { peptideOrderId: orderId } });
  if (existing > 0) return;
  await prisma.task.createMany({
    data: [
      {
        tenantId, peptideOrderId: orderId, stepNumber: 1, workflowStep: "1-Week Check-In",
        assignedTo: "Front Desk", priority: "Medium", anchor: "Shipped Date", delayDays: 7,
        dueDate: addDays(shippedAt, 7), automationTemplate: "Peptide 1-Week Check-In", status: "Pending",
      },
      {
        tenantId, peptideOrderId: orderId, stepNumber: 2, workflowStep: "Peptide Refill Reminder",
        assignedTo: "Front Desk", priority: "Medium", anchor: "Shipped Date", delayDays: 30,
        dueDate: addDays(shippedAt, 30), automationTemplate: "Peptide Refill Reminder", status: "Pending",
      },
    ],
  });
}

function revalidatePeptides() {
  revalidatePath("/peptides");
  revalidatePath("/tasks");
  revalidatePath("/");
}

export async function createPeptideOrder(formData: FormData) {
  const tenantId = await getCurrentTenantId();
  const patientName = String(formData.get("patientName") ?? "").trim();
  const product = String(formData.get("product") ?? "").trim();
  if (!patientName || !product) throw new Error("Patient and product are required.");

  const str = (k: string) => String(formData.get(k) ?? "").trim() || null;
  const orderDateRaw = String(formData.get("orderDate") ?? "").trim();
  const amountRaw = String(formData.get("amount") ?? "").trim();

  await prisma.peptideOrder.create({
    data: {
      tenantId,
      patientName,
      product,
      dob: str("dob"),
      phone: str("phone"),
      shipTo: String(formData.get("shipTo") ?? "Patient") === "LL Aesthetics" ? "LL Aesthetics" : "Patient",
      address: str("address"),
      city: str("city"),
      state: str("state"),
      zip: str("zip"),
      dosing: str("dosing"),
      amount: amountRaw ? Number(amountRaw) || null : null,
      orderType: str("orderType"),
      notes: str("notes"),
      invoice: str("invoice"),
      provider: str("provider"),
      orderDate: orderDateRaw ? fromDateInput(orderDateRaw) : new Date(),
      status: "Requested",
    },
  });
  revalidatePath("/peptides");
}

export async function setPeptideStatus(formData: FormData) {
  const tenantId = await getCurrentTenantId();
  const id = String(formData.get("orderId") ?? "");
  const status = String(formData.get("status") ?? "").trim();
  const order = await prisma.peptideOrder.findFirst({ where: { id, tenantId } });
  if (!order) throw new Error("Order not found.");
  const nowShipping = status === "Shipped" && !order.shippedDate;
  const shippedAt = nowShipping ? new Date() : order.shippedDate;
  await prisma.peptideOrder.update({ where: { id }, data: { status, shippedDate: shippedAt } });
  if (nowShipping) await onShipped(tenantId, id, shippedAt!);
  revalidatePeptides();
}

export async function updateTracking(formData: FormData) {
  const tenantId = await getCurrentTenantId();
  const id = String(formData.get("orderId") ?? "");
  const trackingNumber = String(formData.get("trackingNumber") ?? "").trim() || null;
  const carrier = String(formData.get("carrier") ?? "").trim() || null;
  const order = await prisma.peptideOrder.findFirst({ where: { id, tenantId } });
  if (!order) throw new Error("Order not found.");
  // Adding a tracking number nudges the order to "Shipped" if it isn't further along.
  const status =
    trackingNumber && ["Requested", "Approved", "Filled"].includes(order.status) ? "Shipped" : order.status;
  const nowShipping = status === "Shipped" && !order.shippedDate;
  const shippedAt = nowShipping ? new Date() : order.shippedDate;
  await prisma.peptideOrder.update({ where: { id }, data: { trackingNumber, carrier, status, shippedDate: shippedAt } });
  if (nowShipping) await onShipped(tenantId, id, shippedAt!);
  revalidatePeptides();
}

export async function deletePeptideOrder(formData: FormData) {
  const tenantId = await getCurrentTenantId();
  const id = String(formData.get("orderId") ?? "");
  const order = await prisma.peptideOrder.findFirst({ where: { id, tenantId } });
  if (!order) throw new Error("Order not found.");
  await prisma.peptideOrder.delete({ where: { id } });
  revalidatePath("/peptides");
}
