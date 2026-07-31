-- CreateTable
CREATE TABLE "PlanDocument" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "planId" TEXT,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'application/pdf',
    "sizeBytes" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT DEFAULT 'Aura Scan',
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlanDocument_tenantId_patientId_idx" ON "PlanDocument"("tenantId", "patientId");

-- AddForeignKey
ALTER TABLE "PlanDocument" ADD CONSTRAINT "PlanDocument_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanDocument" ADD CONSTRAINT "PlanDocument_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

