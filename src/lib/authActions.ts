"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "./prisma";
import { hashPassword, verifyPassword } from "./password";
import { signSession, verifySession, SESSION_COOKIE } from "./session";

const WEEK = 60 * 60 * 24 * 7;

export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const nextPath = String(formData.get("next") ?? "/") || "/";
  const safeNext = nextPath.startsWith("/") ? nextPath : "/";

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.active || !verifyPassword(password, user.passwordHash)) {
    redirect(`/login?error=1&next=${encodeURIComponent(safeNext)}`);
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  const token = await signSession({
    userId: user.id,
    email: user.email,
    role: user.role,
    name: user.name ?? undefined,
  });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: WEEK,
  });
  redirect(safeNext);
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}

export async function changePassword(formData: FormData) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;
  if (!session) redirect("/login");

  const current = String(formData.get("currentPassword") ?? "");
  const next = String(formData.get("newPassword") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");

  const user = await prisma.user.findUnique({ where: { id: session!.userId } });
  if (!user || !verifyPassword(current, user.passwordHash)) {
    redirect("/account?error=current");
  }
  if (next.length < 8) redirect("/account?error=short");
  if (next !== confirm) redirect("/account?error=match");

  await prisma.user.update({
    where: { id: user!.id },
    data: { passwordHash: hashPassword(next) },
  });
  redirect("/account?ok=1");
}
