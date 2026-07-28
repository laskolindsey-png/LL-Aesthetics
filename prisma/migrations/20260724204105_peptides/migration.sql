-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "peptideOrderId" TEXT;

-- CreateTable
CREATE TABLE "PeptideOrder" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "patientName" TEXT NOT NULL,
    "dob" TEXT,
    "phone" TEXT,
    "shipTo" TEXT NOT NULL DEFAULT 'Patient',
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zip" TEXT,
    "product" TEXT NOT NULL,
    "dosing" TEXT,
    "amount" DOUBLE PRECISION,
    "orderType" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Requested',
    "trackingNumber" TEXT,
    "orderDate" TIMESTAMP(3),
    "shippedDate" TIMESTAMP(3),
    "provider" TEXT,
    "externalRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PeptideOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PeptideOrder_tenantId_status_idx" ON "PeptideOrder"("tenantId", "status");

-- AddForeignKey
ALTER TABLE "PeptideOrder" ADD CONSTRAINT "PeptideOrder_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_peptideOrderId_fkey" FOREIGN KEY ("peptideOrderId") REFERENCES "PeptideOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
