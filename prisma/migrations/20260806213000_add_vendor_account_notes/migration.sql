-- Account number + free-text notes/login hints on vendors (owner-only).
ALTER TABLE "Vendor" ADD COLUMN "accountNumber" TEXT;
ALTER TABLE "Vendor" ADD COLUMN "notes" TEXT;
