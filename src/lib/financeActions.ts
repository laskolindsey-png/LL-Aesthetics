"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "./prisma";
import { getCurrentTenantId } from "./tenant";
import { getSessionUser } from "./currentUser";
import { fromDateInput } from "./dates";

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

export async function deleteExpense(formData: FormData) {
  await requireOwner();
  const tenantId = await getCurrentTenantId();
  const id = String(formData.get("id") ?? "");
  const e = await prisma.expenseEntry.findFirst({ where: { id, tenantId } });
  if (e) await prisma.expenseEntry.delete({ where: { id } });
  revalidateFinance();
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
    },
  });
  revalidateFinance();
}

export async function deleteVendor(formData: FormData) {
  await requireOwner();
  const tenantId = await getCurrentTenantId();
  const id = String(formData.get("id") ?? "");
  const v = await prisma.vendor.findFirst({ where: { id, tenantId } });
  if (v) await prisma.vendor.delete({ where: { id } });
  revalidateFinance();
}
