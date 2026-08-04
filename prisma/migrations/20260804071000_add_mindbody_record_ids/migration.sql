-- AlterTable
ALTER TABLE "Patient"
ADD COLUMN "mindbodyClientId" TEXT;

-- AlterTable
ALTER TABLE "WorkflowRecord"
ADD COLUMN "mindbodyAppointmentId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowRecord_tenantId_mindbodyAppointmentId_key"
ON "WorkflowRecord"("tenantId", "mindbodyAppointmentId");
