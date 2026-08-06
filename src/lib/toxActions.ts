"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { getCurrentTenantId } from "./tenant";
import { fromDateInput, monthsAgo, todayStart } from "./dates";
import {
  normalizeToxStatus,
  TOX_CHECK_STATUSES,
  REACTIVATE_MONTHS,
  REACTIVATION_STEP,
} from "./toxStatus";

function revalidateTox(id?: string) {
  revalidatePath("/tox");
  if (id) revalidatePath(`/tox/${id}`);
}

// Record a results check: appends to the history AND updates the patient's
// current color. This is the one place status changes, so history stays honest.
async function logCheck(
  tenantId: string,
  toxPatientId: string,
  status: string,
  note: string | null,
  checkDate: Date
) {
  await prisma.toxCheck.create({
    data: { tenantId, toxPatientId, status, note, checkDate },
  });
  // A results check means they came in — advance last-visit too (never backwards).
  const p = await prisma.toxPatient.findUnique({ where: { id: toxPatientId } });
  const lastVisitDate =
    p?.lastVisitDate && p.lastVisitDate > checkDate ? p.lastVisitDate : checkDate;
  await prisma.toxPatient.update({
    where: { id: toxPatientId },
    data: { status, lastCheckDate: checkDate, lastVisitDate },
  });
}

export async function createToxPatient(formData: FormData) {
  const tenantId = await getCurrentTenantId();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Patient name is required.");
  const str = (k: string) => String(formData.get(k) ?? "").trim() || null;
  await prisma.toxPatient.create({
    data: {
      tenantId,
      name,
      phone: str("phone"),
      initialTreatment: str("initialTreatment"),
      isClubMember: formData.get("isClubMember") != null,
      notes: str("notes"),
      status: "awaiting",
    },
  });
  revalidateTox();
}

// Quick color set from the tracker list. Logs a check dated today (unless the
// status is "awaiting", which just clears the color without a history entry).
export async function setToxStatus(formData: FormData) {
  const tenantId = await getCurrentTenantId();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim() || null;
  const patient = await prisma.toxPatient.findFirst({ where: { id, tenantId } });
  if (!patient) throw new Error("Patient not found.");

  if ((TOX_CHECK_STATUSES as readonly string[]).includes(status)) {
    // Save the check (with the optional note) to their history.
    await logCheck(tenantId, id, status, note, new Date());
  } else {
    await prisma.toxPatient.update({ where: { id }, data: { status: "awaiting" } });
  }
  revalidateTox(id);
}

// Full results check from the patient detail page: pick a date, status, note.
export async function addToxCheck(formData: FormData) {
  const tenantId = await getCurrentTenantId();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "").trim();
  if (!(TOX_CHECK_STATUSES as readonly string[]).includes(status))
    throw new Error("Pick a result for the check.");
  const patient = await prisma.toxPatient.findFirst({ where: { id, tenantId } });
  if (!patient) throw new Error("Patient not found.");
  const dateRaw = String(formData.get("checkDate") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim() || null;
  await logCheck(tenantId, id, status, note, dateRaw ? fromDateInput(dateRaw) : new Date());
  revalidateTox(id);
}

// Edit the standing patient info (contact, club, 2-week booking, notes).
export async function updateToxPatient(formData: FormData) {
  const tenantId = await getCurrentTenantId();
  const id = String(formData.get("id") ?? "");
  const patient = await prisma.toxPatient.findFirst({ where: { id, tenantId } });
  if (!patient) throw new Error("Patient not found.");
  const str = (k: string) => String(formData.get(k) ?? "").trim() || null;
  const twoWeekDateRaw = String(formData.get("twoWeekDate") ?? "").trim();
  const lastVisitRaw = String(formData.get("lastVisitDate") ?? "").trim();
  await prisma.toxPatient.update({
    where: { id },
    data: {
      name: String(formData.get("name") ?? patient.name).trim() || patient.name,
      phone: str("phone"),
      initialTreatment: str("initialTreatment"),
      isClubMember: formData.get("isClubMember") != null,
      twoWeekBooked: formData.get("twoWeekBooked") != null,
      twoWeekDate: twoWeekDateRaw ? fromDateInput(twoWeekDateRaw) : null,
      lastVisitDate: lastVisitRaw ? fromDateInput(lastVisitRaw) : null,
      notes: str("notes"),
    },
  });
  revalidateTox(id);
}

// --- Reactivation -----------------------------------------------------------
// Create a reactivation follow-up task for a lapsed patient, if one isn't
// already open. The task lands in Today's Tasks like every other follow-up.
async function ensureReactivationTask(tenantId: string, toxPatientId: string) {
  const open = await prisma.task.findFirst({
    where: {
      tenantId,
      toxPatientId,
      workflowStep: REACTIVATION_STEP,
      status: { notIn: ["Completed", "Cancelled"] },
    },
  });
  if (open) return false;
  await prisma.task.create({
    data: {
      tenantId,
      toxPatientId,
      stepNumber: 1,
      workflowStep: REACTIVATION_STEP,
      assignedTo: "Front Desk",
      priority: "Medium",
      anchor: "Last Visit",
      delayDays: 0,
      dueDate: todayStart(),
      automationTemplate: REACTIVATION_STEP,
      status: "Pending",
    },
  });
  return true;
}

export async function startReactivation(formData: FormData) {
  const tenantId = await getCurrentTenantId();
  const id = String(formData.get("id") ?? "");
  const patient = await prisma.toxPatient.findFirst({ where: { id, tenantId } });
  if (!patient) throw new Error("Patient not found.");
  await ensureReactivationTask(tenantId, id);
  revalidatePath("/tasks");
  revalidateTox(id);
}

// Bulk: create reactivation tasks for everyone currently lapsed (no open task).
export async function startReactivationForAllDue() {
  const tenantId = await getCurrentTenantId();
  const cutoff = monthsAgo(REACTIVATE_MONTHS);
  const due = await prisma.toxPatient.findMany({
    where: { tenantId, lastVisitDate: { not: null, lt: cutoff } },
    select: { id: true },
  });
  let created = 0;
  for (const p of due) if (await ensureReactivationTask(tenantId, p.id)) created++;
  revalidatePath("/tasks");
  revalidatePath("/tox");
  redirect(`/tox?filter=reactivate&reactivated=${created}`);
}

export async function deleteToxCheck(formData: FormData) {
  const tenantId = await getCurrentTenantId();
  const checkId = String(formData.get("checkId") ?? "");
  const patientId = String(formData.get("id") ?? "");
  const check = await prisma.toxCheck.findFirst({ where: { id: checkId, tenantId } });
  if (!check) return;
  await prisma.toxCheck.delete({ where: { id: checkId } });
  // Recompute current status from the most recent remaining check.
  const latest = await prisma.toxCheck.findFirst({
    where: { tenantId, toxPatientId: check.toxPatientId },
    orderBy: [{ checkDate: "desc" }, { createdAt: "desc" }],
  });
  await prisma.toxPatient.update({
    where: { id: check.toxPatientId },
    data: {
      status: latest ? latest.status : "awaiting",
      lastCheckDate: latest ? latest.checkDate : null,
    },
  });
  revalidateTox(patientId);
}

// --- Linking a tracker patient to their main patient record -----------------
// When linked, treatments logged in Patient Workflow (or synced from Mindbody)
// keep the reactivation clock current automatically.
async function syncLastVisitFromRecords(tenantId: string, toxId: string, patientId: string) {
  const latest = await prisma.workflowRecord.findFirst({
    where: { tenantId, patientId },
    orderBy: { eventDate: "desc" },
    select: { eventDate: true },
  });
  if (!latest) return;
  const tox = await prisma.toxPatient.findUnique({ where: { id: toxId } });
  if (!tox) return;
  if (!tox.lastVisitDate || tox.lastVisitDate < latest.eventDate) {
    await prisma.toxPatient.update({
      where: { id: toxId },
      data: { lastVisitDate: latest.eventDate },
    });
  }
}

export async function linkToxToPatient(formData: FormData) {
  const tenantId = await getCurrentTenantId();
  const id = String(formData.get("id") ?? "");
  const patientId = String(formData.get("patientId") ?? "").trim();
  const tox = await prisma.toxPatient.findFirst({ where: { id, tenantId } });
  if (!tox) throw new Error("Patient not found.");
  if (!patientId) throw new Error("Choose a patient record to link.");
  const patient = await prisma.patient.findFirst({ where: { id: patientId, tenantId } });
  if (!patient) throw new Error("Patient record not found.");
  // Clear any existing link to this patient (the relation is one-to-one).
  await prisma.toxPatient.updateMany({
    where: { tenantId, patientId, NOT: { id } },
    data: { patientId: null },
  });
  await prisma.toxPatient.update({ where: { id }, data: { patientId } });
  await syncLastVisitFromRecords(tenantId, id, patientId);
  revalidateTox(id);
}

export async function createAndLinkPatient(formData: FormData) {
  const tenantId = await getCurrentTenantId();
  const id = String(formData.get("id") ?? "");
  const tox = await prisma.toxPatient.findFirst({ where: { id, tenantId } });
  if (!tox) throw new Error("Patient not found.");
  if (tox.patientId) {
    revalidateTox(id);
    return;
  }
  const patient = await prisma.patient.create({
    data: { tenantId, name: tox.name, phone: tox.phone },
  });
  await prisma.toxPatient.update({ where: { id }, data: { patientId: patient.id } });
  revalidateTox(id);
}

export async function unlinkToxPatient(formData: FormData) {
  const tenantId = await getCurrentTenantId();
  const id = String(formData.get("id") ?? "");
  const tox = await prisma.toxPatient.findFirst({ where: { id, tenantId } });
  if (!tox) throw new Error("Patient not found.");
  await prisma.toxPatient.update({ where: { id }, data: { patientId: null } });
  revalidateTox(id);
}

export async function deleteToxPatient(formData: FormData) {
  const tenantId = await getCurrentTenantId();
  const id = String(formData.get("id") ?? "");
  const patient = await prisma.toxPatient.findFirst({ where: { id, tenantId } });
  if (!patient) throw new Error("Patient not found.");
  await prisma.toxPatient.delete({ where: { id } });
  redirect("/tox");
}

// --- Spreadsheet import -----------------------------------------------------
// Accepts a CSV export of the Botox workbook. Columns (header row, any order):
//   Name, Contact, Status, Club, Two Week Booked, Two Week Date, Comments
// Status values map via normalizeToxStatus (Happy / Not Happy / Tough / blank).
// Real patient data enters here — never committed to the repo — so PHI stays in
// your database only.
function parseCsv(text: string): string[][] {
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

const truthy = (s: string) => ["yes", "y", "true", "1", "x", "booked"].includes(s.trim().toLowerCase());

export async function importToxCsv(formData: FormData) {
  const tenantId = await getCurrentTenantId();
  const file = formData.get("file") as File | null;
  const replace = formData.get("replace") != null;
  if (!file || file.size === 0) redirect("/tox/import?error=nofile");

  const rows = parseCsv(await file.text());
  if (rows.length < 2) redirect("/tox/import?error=empty");

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const col = (...names: string[]) => {
    for (const n of names) {
      const i = header.findIndex((h) => h === n);
      if (i >= 0) return i;
    }
    return -1;
  };
  const iName = col("name", "patient name", "patient");
  const iPhone = col("contact", "contact #", "phone");
  const iStatus = col("status", "patient happy?", "happy", "color");
  const iClub = col("club", "member", "initial treatment");
  const iBooked = col("two week booked?", "two week booked", "booked");
  const iTwoWeek = col("two week date", "2 week date", "two-week date");
  // The last time the patient was seen — fills the tracker's date column and the
  // 6-month reactivation clock.
  const iLastVisit = col(
    "last visit", "last seen", "last appointment", "last appt",
    "last date", "last check", "date"
  );
  const iComments = col("comments", "comment", "notes");
  if (iName < 0) redirect("/tox/import?error=noname");

  const parseDate = (raw: string): Date | null => {
    const s = (raw ?? "").trim();
    if (!s) return null;
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  };

  if (replace) {
    await prisma.toxPatient.deleteMany({ where: { tenantId } });
  }

  let created = 0;
  let updated = 0;
  for (const r of rows.slice(1)) {
    const name = (r[iName] ?? "").trim();
    if (!name) continue;

    const hasStatus = iStatus >= 0;
    const status = hasStatus ? normalizeToxStatus(r[iStatus] ?? "") : undefined;
    const clubRaw = iClub >= 0 ? (r[iClub] ?? "") : "";
    const twoWeekDate = iTwoWeek >= 0 ? parseDate(r[iTwoWeek] ?? "") : null;
    const lastVisit = iLastVisit >= 0 ? parseDate(r[iLastVisit] ?? "") : null;
    const notes = iComments >= 0 ? (r[iComments] ?? "").trim() || null : null;

    // Merge into an existing patient (matched by name) unless we just wiped all.
    const existing = replace
      ? null
      : await prisma.toxPatient.findFirst({
          where: { tenantId, name: { equals: name, mode: "insensitive" } },
        });

    if (existing) {
      // Update only the fields the sheet actually provides — never blank out data.
      const data: Prisma.ToxPatientUpdateInput = {};
      if (hasStatus && status) data.status = status;
      if (iClub >= 0) {
        data.isClubMember = /club/i.test(clubRaw);
        if (clubRaw.trim()) data.initialTreatment = clubRaw.trim();
      }
      if (iBooked >= 0) data.twoWeekBooked = truthy(r[iBooked] ?? "");
      if (twoWeekDate) data.twoWeekDate = twoWeekDate;
      if (notes) data.notes = notes;
      if (lastVisit) {
        data.lastVisitDate = lastVisit;
        data.lastCheckDate = lastVisit;
      }
      if (Object.keys(data).length > 0) {
        await prisma.toxPatient.update({ where: { id: existing.id }, data });
        updated++;
      }
      continue;
    }

    // New patient. Prefer the explicit last-visit date; fall back to the two-week date.
    const seen = lastVisit ?? twoWeekDate;
    const patient = await prisma.toxPatient.create({
      data: {
        tenantId,
        name,
        phone: iPhone >= 0 ? (r[iPhone] ?? "").trim() || null : null,
        initialTreatment: iClub >= 0 ? clubRaw.trim() || null : null,
        isClubMember: /club/i.test(clubRaw),
        twoWeekBooked: iBooked >= 0 ? truthy(r[iBooked] ?? "") : false,
        twoWeekDate,
        notes,
        status: status ?? "awaiting",
        // Record a check date only when the sheet has a real date — never invent "today."
        lastCheckDate: seen && status && status !== "awaiting" ? seen : lastVisit,
        lastVisitDate: seen ?? null,
      },
    });
    // Seed a history entry only when we have a real dated check.
    if (status && status !== "awaiting" && seen) {
      await prisma.toxCheck.create({
        data: { tenantId, toxPatientId: patient.id, status, note: notes, checkDate: seen },
      });
    }
    created++;
  }
  revalidatePath("/tox");
  redirect(`/tox?imported=${created}&updated=${updated}`);
}
