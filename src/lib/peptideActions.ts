"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
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

// --- Historical import -----------------------------------------------------
// A small RFC-4180-ish CSV parser (handles quotes, commas, newlines in fields).
function parsePeptideCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((f) => f.trim() !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); if (row.some((f) => f.trim() !== "")) rows.push(row); }
  return rows;
}

// Bulk-load past peptide orders from the practice's tracker spreadsheet, for
// record. Defaults to status "Received" so history shows as completed and stays
// out of the active "To Fill" queue. Creates rows directly (no follow-up tasks
// are generated for historical orders). Dedup-safe on name + product + tracking.
export async function importPeptidesCsv(formData: FormData) {
  const tenantId = await getCurrentTenantId();
  const file = formData.get("file") as File | null;
  const statusRaw = String(formData.get("status") ?? "Received");
  const status = ["Requested", "Approved", "Filled", "Shipped", "Received"].includes(statusRaw)
    ? statusRaw
    : "Received";
  if (!file || file.size === 0) redirect("/peptides/import?error=nofile");

  const rows = parsePeptideCsv(await file.text());
  if (rows.length < 2) redirect("/peptides/import?error=empty");

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const col = (...names: string[]) => {
    for (const n of names) {
      const i = header.findIndex((h) => h === n);
      if (i >= 0) return i;
    }
    return -1;
  };
  const iName = col("full name", "patient name", "patient", "name");
  const iDob = col("date of birth", "dob");
  const iPhone = col("phone number", "phone", "contact");
  const iAddress = col("address", "street");
  const iCity = col("city");
  const iState = col("state");
  const iZip = col("zip", "zip code");
  const iNotes = col("notes", "note");
  const iOrder = col("order", "product", "peptide");
  const iDosing = col("script & dosing", "dosing", "script");
  const iAmount = col("order amount", "amount", "price", "cost");
  const iDateOrdered = col("date ordered", "order date", "date");
  const iTracking = col("tracking number", "tracking", "tracking #");
  const iCarrier = col("carrier");
  const iStatusNotes = col("status/notes", "status notes", "status");
  const iInvoice = col("invoice", "invoice #", "inv");
  if (iName < 0 || iOrder < 0) redirect("/peptides/import?error=cols");

  const cell = (r: string[], i: number) => (i >= 0 ? (r[i] ?? "").trim() : "");

  let created = 0;
  let skipped = 0;
  for (const r of rows.slice(1)) {
    const name = cell(r, iName);
    const product = cell(r, iOrder);
    if (!name || !product) continue;

    const amountRaw = cell(r, iAmount).replace(/[$,]/g, "");
    const amount = amountRaw ? Number(amountRaw) || null : null;
    const tracking = cell(r, iTracking) || null;

    const dup = await prisma.peptideOrder.findFirst({
      where: { tenantId, patientName: name, product, trackingNumber: tracking },
    });
    if (dup) { skipped++; continue; }

    const noteVal = cell(r, iNotes);
    const statusNote = cell(r, iStatusNotes);
    const combinedNotes = [noteVal, statusNote].filter(Boolean).join(" · ") || null;
    const shipTo = /ll aesthetics|clinic|office/i.test(noteVal) ? "LL Aesthetics" : "Patient";

    let orderDate: Date | null = null;
    const dRaw = cell(r, iDateOrdered);
    if (dRaw) {
      const d = new Date(dRaw);
      if (!isNaN(d.getTime())) orderDate = d;
    }

    await prisma.peptideOrder.create({
      data: {
        tenantId,
        patientName: name,
        product,
        dob: cell(r, iDob) || null,
        phone: cell(r, iPhone) || null,
        address: cell(r, iAddress) || null,
        city: cell(r, iCity) || null,
        state: cell(r, iState) || null,
        zip: cell(r, iZip) || null,
        dosing: cell(r, iDosing) || null,
        amount,
        trackingNumber: tracking,
        carrier: cell(r, iCarrier) || null,
        invoice: cell(r, iInvoice) || null,
        notes: combinedNotes,
        shipTo,
        orderType: "New",
        orderDate: orderDate ?? new Date(),
        status,
      },
    });
    created++;
  }

  revalidatePath("/peptides");
  redirect(`/peptides?imported=${created}&skipped=${skipped}`);
}
