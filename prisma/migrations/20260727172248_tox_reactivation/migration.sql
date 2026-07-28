-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "toxPatientId" TEXT;

-- AlterTable
ALTER TABLE "ToxPatient" ADD COLUMN     "lastVisitDate" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "ToxPatient_tenantId_lastVisitDate_idx" ON "ToxPatient"("tenantId", "lastVisitDate");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_toxPatientId_fkey" FOREIGN KEY ("toxPatientId") REFERENCES "ToxPatient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
