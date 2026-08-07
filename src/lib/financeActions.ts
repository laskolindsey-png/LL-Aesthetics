"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
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
function looksLikeHeaderRow(row: unknown[]): boolean {
  return row.some((c) => {
    const s = String(c ?? "").trim().toLowerCase();
    return s === "sale date" || s === "item total";
  });
}

async function rowsFromFile(file: File): Promise<unknown[][]> {
  const name = (file.name ?? "").toLowerCase();
  const buf = Buffer.from(await file.arrayBuffer());
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    const XLSX = await import("xlsx");
    const wb = XLSX.read(buf, { type: "buffer", cellDates: true });
    const readSheet = (n: string) =>
      XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[n], { header: 1, defval: "", raw: true });
    // Bigger exports add an "Index" tab up front and split data across sheets.
    // Prefer a sheet literally named "Sales"; else the one that has the header
    // row; else the first sheet.
    const byName = wb.SheetNames.find((n) => n.trim().toLowerCase() === "sales");
    if (byName) return readSheet(byName);
    for (const n of wb.SheetNames) {
      const rows = readSheet(n);
      if (rows.some((r) => looksLikeHeaderRow(r))) return rows;
    }
    return readSheet(wb.SheetNames[0]);
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

  // Some exports have title rows above the header — find the real header row.
  let headerIdx = rows.findIndex((r) => looksLikeHeaderRow(r));
  if (headerIdx < 0) headerIdx = 0;
  const dataRows = rows.slice(headerIdx + 1);
  const header = rows[headerIdx].map((h) => String(h ?? "").trim().toLowerCase());
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
    ? [...new Set(dataRows.map((r) => String(r[iSaleId] ?? "").trim()).filter(Boolean))]
    : [];
  if (saleIds.length) {
    await prisma.revenueEntry.deleteMany({ where: { tenantId, mindbodySaleId: { in: saleIds } } });
  }

  let imported = 0;
  let skipped = 0; // tips + fees (not practice revenue)
  for (const r of dataRows) {
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

// --- Payroll import ---------------------------------------------------------
// Accepts a Gusto-style payroll export (CSV or Excel) and books one Payroll
// expense per pay date = gross earnings + employer taxes (the real employer
// cost; employee taxes are withheld from gross, not additional). De-duped by
// pay date so re-uploading an overlapping range replaces rather than doubles.
export async function importPayrollCsv(formData: FormData) {
  await requireOwner();
  const tenantId = await getCurrentTenantId();
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) redirect("/finances/expenses?error=nofile");

  const rows = await rowsFromFile(file);
  const hi = rows.findIndex((r) =>
    r.some((c) => String(c ?? "").trim().toLowerCase() === "payroll pay date")
  );
  if (hi < 0) redirect("/finances/expenses?error=payroll");
  const header = rows[hi].map((h) => String(h ?? "").trim().toLowerCase());
  const col = (n: string) => header.indexOf(n);
  const iPay = col("payroll");
  const iEmp = col("employee");
  const iDate = col("payroll pay date");
  const iGross = col("gross earnings");
  const iErTax = col("total employer taxes");
  if (iDate < 0 || iGross < 0) redirect("/finances/expenses?error=payroll");

  const num = (v: unknown) =>
    typeof v === "number" ? v : Number(String(v ?? "").replace(/[^0-9.\-]/g, "")) || 0;

  // Aggregate the per-employee rows (skip subtotal/grand-total rows) by pay date.
  const agg = new Map<string, { amount: number; count: number; label: string }>();
  for (const r of rows.slice(hi + 1)) {
    const emp = iEmp >= 0 ? String(r[iEmp] ?? "").trim() : "x";
    const pay = iPay >= 0 ? String(r[iPay] ?? "") : "";
    if (!emp || /totals/i.test(pay)) continue;
    const d = String(r[iDate] ?? "").trim();
    if (!d) continue;
    const cost = num(r[iGross]) + (iErTax >= 0 ? num(r[iErTax]) : 0);
    const cur = agg.get(d) ?? { amount: 0, count: 0, label: pay.split(",")[0].trim() };
    cur.amount += cost;
    cur.count += 1;
    agg.set(d, cur);
  }

  const keys = [...agg.keys()].map((d) => `payroll:${d}`);
  if (keys.length) {
    await prisma.expenseEntry.deleteMany({ where: { tenantId, importKey: { in: keys } } });
  }

  let imported = 0;
  for (const [d, v] of agg) {
    const date = new Date(d);
    if (isNaN(date.getTime()) || v.amount <= 0) continue;
    await prisma.expenseEntry.create({
      data: {
        tenantId,
        date,
        vendor: "Payroll",
        category: "Payroll",
        subcategory: "Wages",
        description: `Payroll ${v.label} · ${v.count} staff (incl. employer taxes)`.trim(),
        amount: Math.round(v.amount * 100) / 100,
        recurring: false,
        importKey: `payroll:${d}`,
      },
    });
    imported++;
  }
  revalidateFinance();
  redirect(`/finances/expenses?imported=${imported}`);
}

// --- Bank statement import --------------------------------------------------
// Auto-categorize a merchant by its description. Unknown or maybe-personal
// merchants land in "Uncategorized" for a quick review (edit or delete).
function categorizeBankMerchant(descRaw: string): { category: string; subcategory: string | null } {
  const d = (descRaw ?? "").toLowerCase();
  const has = (...ks: string[]) => ks.some((k) => d.includes(k));
  // Injectables — your biggest product cost.
  if (has("evolus", "jeuveau", "allergan", "galderma", "botox", "dysport",
          "xeomin", "daxxify", "revance", "merz", "juvederm", "restylane",
          "revanesse", "prollenium", "rha", "belotero"))
    return { category: "Inventory", subcategory: "Injectables" };
  // Retail skincare brands you resell.
  if (has("skinbetter", "skin better", "is clinical", "isclinical", "skinmedica", "skin medica"))
    return { category: "Inventory", subcategory: "Skincare / Retail" };
  if (has("grayline", "graylinemed"))
    return { category: "Inventory", subcategory: "Consumables" };
  // Devices / equipment (lasers, scanners). Note: some Cynosure/Lutronic charges
  // are laser consumables — recategorize those to Inventory · Consumables.
  if (has("aura reality", "aurareality", "cynosure", "lutronic", "sciton", "candela"))
    return { category: "Equipment", subcategory: "Devices" };
  // GFE / telehealth software.
  if (has("docuspa", "doc u spa", "doc-u-spa", "spa kinect", "spakinect", "spa-kinect"))
    return { category: "Software", subcategory: "GFE / Telehealth" };
  // Software first, so "Amazon Digital" doesn't fall into the Amazon supplies bucket.
  if (has("amazon digital", "adobe", "canva", "apple", "google", "microsoft", "quicken", "zoom", "dropbox"))
    return { category: "Software", subcategory: "Subscriptions" };
  // Outside contractors / freelancers (Upwork = e.g. developer, designers).
  if (has("upwork", "fiverr"))
    return { category: "Operating", subcategory: "Professional Services" };
  // General shopping → its own "Supplies" bucket (kept separate from product Inventory).
  if (has("hobby lobby", "etsy"))
    return { category: "Supplies", subcategory: "Décor" };
  if (has("amazon", "sam's", "sams club", "walmart", "target", "costco"))
    return { category: "Supplies", subcategory: "General" };
  // Venmo/Cash App/Zelle are payment rails, not merchants — could be anything
  // (a contractor, a refund, personal). Flag so you can say what each was for.
  if (has("venmo", "cash app", "cashapp", "zelle"))
    return { category: "Uncategorized", subcategory: "Review — Venmo/transfer, what for?" };
  // Uncertain — likely personal; leave for review.
  if (has("nike", "tractor supply"))
    return { category: "Uncategorized", subcategory: "Review — maybe personal" };
  return { category: "Uncategorized", subcategory: null };
}

export async function importBankCsv(formData: FormData) {
  await requireOwner();
  const tenantId = await getCurrentTenantId();
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) redirect("/finances/expenses?error=nofile");

  const rows = await rowsFromFile(file);
  const hi = rows.findIndex((r) =>
    r.some((c) => String(c ?? "").trim().toLowerCase() === "post date")
  );
  if (hi < 0) redirect("/finances/expenses?error=bank");
  const header = rows[hi].map((h) => String(h ?? "").trim().toLowerCase());
  const col = (...names: string[]) => {
    for (const n of names) { const i = header.indexOf(n); if (i >= 0) return i; }
    return -1;
  };
  const iDate = col("post date", "date", "transaction date");
  const iDesc = col("description", "merchant", "name");
  const iDeb = col("debit", "amount", "withdrawal");
  if (iDate < 0 || iDesc < 0 || iDeb < 0) redirect("/finances/expenses?error=bank");

  const num = (v: unknown) =>
    typeof v === "number" ? v : Number(String(v ?? "").replace(/[^0-9.\-]/g, "")) || 0;

  // Build entries; key each by date|desc|amount|occurrence so re-importing the
  // same statement replaces rather than duplicates.
  const seen = new Map<string, number>();
  const toCreate: Prisma.ExpenseEntryCreateManyInput[] = [];
  let review = 0;
  for (const r of rows.slice(hi + 1)) {
    const debit = num(r[iDeb]);
    if (debit <= 0) continue; // credits/refunds/deposits aren't expenses
    const dstr = String(r[iDate] ?? "").trim();
    const date = new Date(dstr);
    if (isNaN(date.getTime())) continue;
    const desc = String(r[iDesc] ?? "").trim() || "Bank transaction";
    const base = `bank:${dstr}|${desc.toLowerCase()}|${debit}`;
    const occ = (seen.get(base) ?? 0) + 1;
    seen.set(base, occ);
    const { category, subcategory } = categorizeBankMerchant(desc);
    if (category === "Uncategorized") review++;
    toCreate.push({
      tenantId, date, vendor: desc, description: null,
      category, subcategory, amount: debit, recurring: false,
      importKey: `${base}|${occ}`,
    });
  }

  const keys = toCreate.map((t) => t.importKey!).filter(Boolean);
  if (keys.length) {
    await prisma.expenseEntry.deleteMany({ where: { tenantId, importKey: { in: keys } } });
  }
  if (toCreate.length) {
    await prisma.expenseEntry.createMany({ data: toCreate });
  }
  revalidateFinance();
  redirect(`/finances/expenses?bank=${toCreate.length}&review=${review}`);
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
