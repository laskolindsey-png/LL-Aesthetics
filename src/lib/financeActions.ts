"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "./prisma";
import { getCurrentTenantId } from "./tenant";
import { getSessionUser } from "./currentUser";
import { fromDateInput } from "./dates";
import { classifyMindbodyItem, mindbodyKindToCategory } from "./finance";

async function requireOwner() {
  const me = await getSessionUser();
  if (!me || me.role !== "owner") throw new Error("Owner access required.");
}

function revalidateFinance() {
  revalidatePath("/finances");
  revalidatePath("/finances/revenue");
  revalidatePath("/finances/expenses");
  revalidatePath("/finances/vendors");
}

export async function createRevenue(formData: FormData) {
  await requireOwner();
  const tenantId = await getCurrentTenantId();
  const startRaw = String(formData.get("periodStart") ?? "").trim();
  const endRaw = String(formData.get("periodEnd") ?? "").trim();
  const amount = Number(String(formData.get("amount") ?? "").replace(/[^0-9.]/g, ""));
  if (!startRaw) throw new Error("Period date is required.");
  if (!amount) throw new Error("Amount is required.");
  await prisma.revenueEntry.create({
    data: {
      tenantId,
      periodStart: fromDateInput(startRaw),
      periodEnd: endRaw ? fromDateInput(endRaw) : null,
      category: String(formData.get("category") ?? "Service Revenue").trim() || "Service Revenue",
      description: String(formData.get("description") ?? "").trim() || null,
      amount,
      source: String(formData.get("source") ?? "").trim() || null,
    },
  });
  revalidateFinance();
}

export async function deleteRevenue(formData: FormData) {
  await requireOwner();
  const tenantId = await getCurrentTenantId();
  const id = String(formData.get("id") ?? "");
  const r = await prisma.revenueEntry.findFirst({ where: { id, tenantId } });
  if (r) await prisma.revenueEntry.delete({ where: { id } });
  revalidateFinance();
}

export async function createExpense(formData: FormData) {
  await requireOwner();
  const tenantId = await getCurrentTenantId();
  const dateRaw = String(formData.get("date") ?? "").trim();
  const amount = Number(String(formData.get("amount") ?? "").replace(/[^0-9.]/g, ""));
  if (!dateRaw) throw new Error("Date is required.");
  if (!amount) throw new Error("Amount is required.");
  await prisma.expenseEntry.create({
    data: {
      tenantId,
      date: fromDateInput(dateRaw),
      vendor: String(formData.get("vendor") ?? "").trim() || null,
      description: String(formData.get("description") ?? "").trim() || null,
      category: String(formData.get("category") ?? "Operating").trim() || "Operating",
      subcategory: String(formData.get("subcategory") ?? "").trim() || null,
      amount,
      recurring: formData.get("recurring") != null,
    },
  });
  revalidateFinance();
}

export async function editExpense(formData: FormData) {
  await requireOwner();
  const tenantId = await getCurrentTenantId();
  const id = String(formData.get("id") ?? "");
  const existing = await prisma.expenseEntry.findFirst({ where: { id, tenantId } });
  if (!existing) throw new Error("Expense not found.");
  const dateRaw = String(formData.get("date") ?? "").trim();
  const amount = Number(String(formData.get("amount") ?? "").replace(/[^0-9.]/g, ""));
  if (!dateRaw) throw new Error("Date is required.");
  if (!amount) throw new Error("Amount is required.");
  await prisma.expenseEntry.update({
    where: { id },
    data: {
      date: fromDateInput(dateRaw),
      vendor: String(formData.get("vendor") ?? "").trim() || null,
      description: String(formData.get("description") ?? "").trim() || null,
      category: String(formData.get("category") ?? "Operating").trim() || "Operating",
      subcategory: String(formData.get("subcategory") ?? "").trim() || null,
      amount,
      recurring: formData.get("recurring") != null,
    },
  });
  revalidateFinance();
  redirect("/finances/expenses");
}

export async function deleteExpense(formData: FormData) {
  await requireOwner();
  const tenantId = await getCurrentTenantId();
  const id = String(formData.get("id") ?? "");
  const e = await prisma.expenseEntry.findFirst({ where: { id, tenantId } });
  if (e) await prisma.expenseEntry.delete({ where: { id } });
  revalidateFinance();
}

// --- Mindbody Sales report import -------------------------------------------
// Accepts a CSV export of a Mindbody Sales report and turns each line into a
// revenue entry. Memberships are skipped (the dashboard counts them via active
// memberships). Re-importing rows that carry a Sale ID replaces the prior import
// of that sale, so the same report can be uploaded twice without doubling.
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

// Read an uploaded Sales report into rows — supports Excel (.xlsx/.xls, what
// "Export to Excel" produces) and CSV.
async function rowsFromFile(file: File): Promise<unknown[][]> {
  const name = (file.name ?? "").toLowerCase();
  const buf = Buffer.from(await file.arrayBuffer());
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    const XLSX = await import("xlsx");
    const wb = XLSX.read(buf, { type: "buffer", cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    return XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "", raw: true });
  }
  return parseCsv(buf.toString("utf8"));
}

export async function importMindbodyRevenue(formData: FormData) {
  await requireOwner();
  const tenantId = await getCurrentTenantId();
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) redirect("/finances/revenue?error=nofile");

  const rows = await rowsFromFile(file);
  if (rows.length < 2) redirect("/finances/revenue?error=empty");

  const header = rows[0].map((h) => String(h ?? "").trim().toLowerCase());
  const col = (...names: string[]) => {
    for (const n of names) {
      const i = header.findIndex((h) => h === n);
      if (i >= 0) return i;
    }
    for (const n of names) {
      const i = header.findIndex((h) => h.includes(n));
      if (i >= 0) return i;
    }
    return -1;
  };
  const iDate = col("sale date", "date", "transaction date");
  const iAmount = col("item total", "total paid", "net sales", "amount", "total", "subtotal");
  const iItem = col("item name", "item", "service", "product", "description");
  const iClient = col("patient", "client", "customer");
  const iSaleId = col("sale id", "saleid", "transaction id", "receipt");
  if (iDate < 0 || iAmount < 0 || iItem < 0) redirect("/finances/revenue?error=cols");

  const parseAmount = (v: unknown): number => {
    if (typeof v === "number") return v;
    return Number(String(v ?? "").replace(/[^0-9.\-]/g, "")) || 0;
  };
  const parseDate = (v: unknown): Date | null => {
    if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
    const s = String(v ?? "").trim();
    if (!s) return null;
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  };

  // De-dupe against any prior import OR live capture of these sales, so the same
  // report can be re-uploaded and never doubles.
  const saleIds = iSaleId >= 0
    ? [...new Set(rows.slice(1).map((r) => String(r[iSaleId] ?? "").trim()).filter(Boolean))]
    : [];
  if (saleIds.length) {
    await prisma.revenueEntry.deleteMany({ where: { tenantId, mindbodySaleId: { in: saleIds } } });
  }

  let imported = 0;
  let skipped = 0; // tips + fees (not practice revenue)
  for (const r of rows.slice(1)) {
    const date = parseDate(r[iDate]);
    const amount = parseAmount(r[iAmount]);
    const name = String(r[iItem] ?? "").trim();
    if (!date || amount <= 0) continue; // $0 lines (e.g. members' zeroed services)
    const kind = classifyMindbodyItem(name);
    if (kind === "tip" || kind === "fee") { skipped++; continue; }
    const parts = [name, iClient >= 0 ? String(r[iClient] ?? "").trim() : ""].filter(Boolean);
    await prisma.revenueEntry.create({
      data: {
        tenantId,
        periodStart: date,
        category: mindbodyKindToCategory(kind),
        amount,
        description: parts.join(" · ") || null,
        source: "Mindbody (import)",
        mindbodySaleId: iSaleId >= 0 && String(r[iSaleId] ?? "").trim() ? String(r[iSaleId]).trim() : null,
      },
    });
    imported++;
  }
  revalidateFinance();
  redirect(`/finances/revenue?imported=${imported}&skipped=${skipped}`);
}

export async function createVendor(formData: FormData) {
  await requireOwner();
  const tenantId = await getCurrentTenantId();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Vendor name is required.");
  await prisma.vendor.create({
    data: {
      tenantId,
      name,
      defaultCategory: String(formData.get("defaultCategory") ?? "").trim() || null,
      defaultSubcategory: String(formData.get("defaultSubcategory") ?? "").trim() || null,
      accountNumber: String(formData.get("accountNumber") ?? "").trim() || null,
      notes: String(formData.get("notes") ?? "").trim() || null,
    },
  });
  revalidateFinance();
}

export async function editVendor(formData: FormData) {
  await requireOwner();
  const tenantId = await getCurrentTenantId();
  const id = String(formData.get("id") ?? "");
  const vendor = await prisma.vendor.findFirst({ where: { id, tenantId } });
  if (!vendor) throw new Error("Vendor not found.");
  await prisma.vendor.update({
    where: { id },
    data: {
      name: String(formData.get("name") ?? vendor.name).trim() || vendor.name,
      defaultCategory: String(formData.get("defaultCategory") ?? "").trim() || null,
      defaultSubcategory: String(formData.get("defaultSubcategory") ?? "").trim() || null,
      accountNumber: String(formData.get("accountNumber") ?? "").trim() || null,
      notes: String(formData.get("notes") ?? "").trim() || null,
    },
  });
  revalidateFinance();
  redirect("/finances/vendors");
}

export async function deleteVendor(formData: FormData) {
  await requireOwner();
  const tenantId = await getCurrentTenantId();
  const id = String(formData.get("id") ?? "");
  const v = await prisma.vendor.findFirst({ where: { id, tenantId } });
  if (v) await prisma.vendor.delete({ where: { id } });
  revalidateFinance();
}
