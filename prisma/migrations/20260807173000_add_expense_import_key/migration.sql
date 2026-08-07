-- Dedupe key for imported expenses (e.g. payroll runs keyed by pay date).
ALTER TABLE "ExpenseEntry" ADD COLUMN "importKey" TEXT;
CREATE INDEX "ExpenseEntry_tenantId_importKey_idx" ON "ExpenseEntry"("tenantId", "importKey");
