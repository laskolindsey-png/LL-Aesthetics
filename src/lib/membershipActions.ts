"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "./prisma";
import { getCurrentTenantId } from "./tenant";
import { fromDateInput } from "./dates";

function revalidateMemberships() {
  revalidatePath("/memberships");
  revalidatePath("/");
}

export async function createMembership(formData: FormData) {
  const tenantId = await getCurrentTenantId();
  const memberName = String(formData.get("memberName") ?? "").trim();
  if (!memberName) throw new Error("Member name is required.");
  const str = (k: string) => String(formData.get(k) ?? "").trim() || null;
  const amountRaw = String(formData.get("monthlyAmount") ?? "").trim();
  const startRaw = String(formData.get("startDate") ?? "").trim();
  const renewRaw = String(formData.get("renewalDate") ?? "").trim();

  await prisma.membership.create({
    data: {
      tenantId,
      memberName,
      phone: str("phone"),
      tier: str("tier") ?? "Membership",
      monthlyAmount: amountRaw ? Number(amountRaw) || null : null,
      startDate: startRaw ? fromDateInput(startRaw) : new Date(),
      renewalDate: renewRaw ? fromDateInput(renewRaw) : null,
      notes: str("notes"),
      status: "Active",
    },
  });
  revalidateMemberships();
}

export async function updateMembership(formData: FormData) {
  const tenantId = await getCurrentTenantId();
  const id = String(formData.get("id") ?? "");
  const m = await prisma.membership.findFirst({ where: { id, tenantId } });
  if (!m) throw new Error("Membership not found.");
  const str = (k: string) => String(formData.get(k) ?? "").trim() || null;
  const amountRaw = String(formData.get("monthlyAmount") ?? "").trim();
  const renewRaw = String(formData.get("renewalDate") ?? "").trim();
  await prisma.membership.update({
    where: { id },
    data: {
      memberName: String(formData.get("memberName") ?? m.memberName).trim() || m.memberName,
      phone: str("phone"),
      tier: str("tier") ?? m.tier,
      monthlyAmount: amountRaw ? Number(amountRaw) || null : null,
      renewalDate: renewRaw ? fromDateInput(renewRaw) : null,
      notes: str("notes"),
    },
  });
  revalidateMemberships();
}

export async function setMembershipStatus(formData: FormData) {
  const tenantId = await getCurrentTenantId();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "").trim();
  const m = await prisma.membership.findFirst({ where: { id, tenantId } });
  if (!m) throw new Error("Membership not found.");
  await prisma.membership.update({ where: { id }, data: { status } });
  revalidateMemberships();
}

export async function deleteMembership(formData: FormData) {
  const tenantId = await getCurrentTenantId();
  const id = String(formData.get("id") ?? "");
  const m = await prisma.membership.findFirst({ where: { id, tenantId } });
  if (!m) throw new Error("Membership not found.");
  await prisma.membership.delete({ where: { id } });
  revalidateMemberships();
}

// --- Spreadsheet import -----------------------------------------------------
// Accepts a CSV of the member roster. Columns (header row, any order):
//   Member Name, Tier, Billing Day, Status, Monthly Amount, Phone, Note
// Status normalizes to Active | Paused | Cancelled. Billing day (1/15) is kept
// in notes. Member data is real people — never committed to the repo.
function parseMemberCsv(text: string): string[][] {
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

function normalizeMemberStatus(s: string): string {
  const v = s.trim().toLowerCase();
  if (!v) return "Active";
  if (v.includes("pause")) return "Paused";
  if (v.includes("cancel")) return "Cancelled";
  if (v.includes("active")) return "Active";
  return "Active";
}

export async function importMembershipsCsv(formData: FormData) {
  const tenantId = await getCurrentTenantId();
  const file = formData.get("file") as File | null;
  const replace = formData.get("replace") != null;
  if (!file || file.size === 0) redirect("/memberships/import?error=nofile");

  const rows = parseMemberCsv(await file.text());
  if (rows.length < 2) redirect("/memberships/import?error=empty");

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const col = (...names: string[]) => {
    for (const n of names) {
      const i = header.findIndex((h) => h === n);
      if (i >= 0) return i;
    }
    return -1;
  };
  const iName = col("member name", "name", "member");
  const iTier = col("tier", "plan", "level");
  const iDay = col("billing day", "billing", "day", "bill day");
  const iStatus = col("status");
  const iAmount = col("monthly amount", "amount", "monthly");
  const iPhone = col("phone", "contact", "contact #");
  const iSees = col("sees", "aesthetician", "provider", "sees (reese/kamryn/both)");
  const iNote = col("note", "notes", "comment", "comments");
  if (iName < 0) redirect("/memberships/import?error=noname");

  if (replace) await prisma.membership.deleteMany({ where: { tenantId } });

  let created = 0;
  for (const r of rows.slice(1)) {
    const name = (r[iName] ?? "").trim();
    if (!name) continue;
    const day = iDay >= 0 ? (r[iDay] ?? "").trim() : "";
    const sees = iSees >= 0 ? (r[iSees] ?? "").trim() : "";
    const noteParts: string[] = [];
    if (day) noteParts.push(`Bills on the ${day}`);
    if (sees) noteParts.push(`Sees: ${sees}`);
    if (iNote >= 0 && (r[iNote] ?? "").trim()) noteParts.push((r[iNote] ?? "").trim());
    const amountRaw = iAmount >= 0 ? (r[iAmount] ?? "").replace(/[^0-9.]/g, "") : "";
    await prisma.membership.create({
      data: {
        tenantId,
        memberName: name,
        tier: iTier >= 0 ? (r[iTier] ?? "").trim() || "Membership" : "Membership",
        status: iStatus >= 0 ? normalizeMemberStatus(r[iStatus] ?? "") : "Active",
        monthlyAmount: amountRaw ? Number(amountRaw) || null : null,
        phone: iPhone >= 0 ? (r[iPhone] ?? "").trim() || null : null,
        notes: noteParts.length ? noteParts.join(" · ") : null,
        startDate: new Date(),
      },
    });
    created++;
  }
  revalidateMemberships();
  redirect(`/memberships?imported=${created}`);
}
