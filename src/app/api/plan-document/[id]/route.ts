import { prisma } from "@/lib/prisma";
import { getCurrentTenantId } from "@/lib/tenant";
import { getSessionUser } from "@/lib/currentUser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Serve a stored plan document (e.g. the Aura scan PDF) for download. Tenant- and
// login-scoped — PHI, so only authenticated staff of the owning tenant.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const me = await getSessionUser();
  if (!me) return new Response("Unauthorized", { status: 401 });
  const tenantId = await getCurrentTenantId();
  const { id } = await params;

  const doc = await prisma.planDocument.findFirst({ where: { id, tenantId } });
  if (!doc) return new Response("Not found", { status: 404 });

  const safeName = doc.fileName.replace(/[^\w.\- ]+/g, "_");
  return new Response(new Uint8Array(doc.data), {
    headers: {
      "Content-Type": doc.mimeType || "application/pdf",
      "Content-Disposition": `attachment; filename="${safeName}"`,
      "Content-Length": String(doc.data.length),
      "Cache-Control": "private, no-store",
    },
  });
}
