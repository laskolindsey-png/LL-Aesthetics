"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "./prisma";
import { getSessionUser } from "./currentUser";
import { getCurrentTenantId } from "./tenant";
import { hashPassword } from "./password";

// Every action here is owner-only.
async function requireOwner() {
  const user = await getSessionUser();
  if (!user || user.role !== "owner") redirect("/");
  return user!;
}

export async function createUser(formData: FormData) {
  await requireOwner();
  const tenantId = await getCurrentTenantId();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim() || null;
  const role = String(formData.get("role") ?? "staff") === "owner" ? "owner" : "staff";
  const password = String(formData.get("password") ?? "");

  if (!email || !email.includes("@")) redirect("/team?error=email");
  if (password.length < 8) redirect("/team?error=short");
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) redirect("/team?error=exists");

  await prisma.user.create({
    data: { tenantId, email, name, role, passwordHash: hashPassword(password) },
  });
  revalidatePath("/team");
  redirect("/team?ok=created");
}

export async function resetUserPassword(formData: FormData) {
  await requireOwner();
  const tenantId = await getCurrentTenantId();
  const id = String(formData.get("userId") ?? "");
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) redirect("/team?error=short");
  const u = await prisma.user.findFirst({ where: { id, tenantId } });
  if (!u) redirect("/team");
  await prisma.user.update({ where: { id }, data: { passwordHash: hashPassword(password) } });
  revalidatePath("/team");
  redirect("/team?ok=reset");
}

export async function setUserActive(formData: FormData) {
  const me = await requireOwner();
  const tenantId = await getCurrentTenantId();
  const id = String(formData.get("userId") ?? "");
  const active = String(formData.get("active") ?? "") === "true";
  if (id === me.userId) redirect("/team?error=self");
  const u = await prisma.user.findFirst({ where: { id, tenantId } });
  if (!u) redirect("/team");
  await prisma.user.update({ where: { id }, data: { active } });
  revalidatePath("/team");
}

export async function deleteUser(formData: FormData) {
  const me = await requireOwner();
  const tenantId = await getCurrentTenantId();
  const id = String(formData.get("userId") ?? "");
  if (id === me.userId) redirect("/team?error=self");
  const u = await prisma.user.findFirst({ where: { id, tenantId } });
  if (!u) redirect("/team");
  if (u.role === "owner") {
    const owners = await prisma.user.count({ where: { tenantId, role: "owner", active: true } });
    if (owners <= 1) redirect("/team?error=lastowner");
  }
  await prisma.user.delete({ where: { id } });
  revalidatePath("/team");
  redirect("/team?ok=deleted");
}
