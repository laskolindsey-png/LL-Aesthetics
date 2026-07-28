import { prisma } from "./prisma";

/**
 * For Phase 1 there is a single tenant (LL Aesthetics). This is the one place
 * that assumption lives — when we add authentication and multi-tenant licensing
 * (Phase 3), this resolves the tenant from the logged-in user instead.
 */
export async function getCurrentTenant() {
  const tenant = await prisma.tenant.findFirst({ orderBy: { createdAt: "asc" } });
  if (!tenant) {
    throw new Error(
      "No tenant found. Run `npm run setup` to initialize the database."
    );
  }
  return tenant;
}

export async function getCurrentTenantId() {
  return (await getCurrentTenant()).id;
}
