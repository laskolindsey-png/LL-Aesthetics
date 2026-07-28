-- AlterTable
ALTER TABLE "ToxPatient" ADD COLUMN     "patientId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "ToxPatient_patientId_key" ON "ToxPatient"("patientId");

-- AddForeignKey
ALTER TABLE "ToxPatient" ADD CONSTRAINT "ToxPatient_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

