"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "./prisma";
import { getCurrentTenantId } from "./tenant";
import { STARTER_FAQS, STARTER_POLICIES, STARTER_AFTERCARE } from "./knowledgeStarters";

export async function createKnowledgeEntry(formData: FormData) {
  const tenantId = await getCurrentTenantId();
  const category = String(formData.get("category") ?? "FAQ").trim();
  const title = String(formData.get("title") ?? "").trim();
  if (!title) throw new Error("A title/question is required.");
  await prisma.knowledgeEntry.create({
    data: { tenantId, category, title, content: String(formData.get("content") ?? "") },
  });
  revalidatePath("/knowledge");
}

export async function updateKnowledgeEntry(formData: FormData) {
  const tenantId = await getCurrentTenantId();
  const id = String(formData.get("id") ?? "");
  const e = await prisma.knowledgeEntry.findFirst({ where: { id, tenantId } });
  if (!e) throw new Error("Entry not found.");
  await prisma.knowledgeEntry.update({
    where: { id },
    data: {
      title: String(formData.get("title") ?? e.title).trim() || e.title,
      content: String(formData.get("content") ?? ""),
    },
  });
  revalidatePath("/knowledge");
}

export async function deleteKnowledgeEntry(formData: FormData) {
  const tenantId = await getCurrentTenantId();
  const id = String(formData.get("id") ?? "");
  const e = await prisma.knowledgeEntry.findFirst({ where: { id, tenantId } });
  if (!e) return;
  await prisma.knowledgeEntry.delete({ where: { id } });
  revalidatePath("/knowledge");
}

// Create the starter skeleton: a Service entry per real service (from Settings),
// plus common FAQ / Policy / Aftercare titles — all blank, for the practice to
// fill with their own answers. Skips any that already exist.
export async function fillStarterKnowledge() {
  const tenantId = await getCurrentTenantId();

  const services = await prisma.setting.findMany({
    where: { tenantId, type: "Service", active: true },
    orderBy: { sortOrder: "asc" },
  });

  const wanted: { category: string; title: string }[] = [
    ...services.map((s) => ({ category: "Service", title: s.value })),
    ...STARTER_FAQS.map((t) => ({ category: "FAQ", title: t })),
    ...STARTER_POLICIES.map((t) => ({ category: "Policy", title: t })),
    ...STARTER_AFTERCARE.map((t) => ({ category: "Aftercare", title: t })),
  ];

  const existing = await prisma.knowledgeEntry.findMany({
    where: { tenantId },
    select: { category: true, title: true },
  });
  const have = new Set(existing.map((e) => `${e.category}::${e.title.toLowerCase()}`));

  let i = 0;
  for (const w of wanted) {
    if (have.has(`${w.category}::${w.title.toLowerCase()}`)) continue;
    await prisma.knowledgeEntry.create({
      data: { tenantId, category: w.category, title: w.title, content: "", sortOrder: i++ },
    });
  }
  revalidatePath("/knowledge");
}
