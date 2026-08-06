-- Track the originating Mindbody sale on revenue entries so webhook retries
-- can replace (not duplicate) a sale's revenue.
ALTER TABLE "RevenueEntry" ADD COLUMN "mindbodySaleId" TEXT;
CREATE INDEX "RevenueEntry_tenantId_mindbodySaleId_idx" ON "RevenueEntry"("tenantId", "mindbodySaleId");
