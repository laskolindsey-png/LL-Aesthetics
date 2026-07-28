-- CreateTable
CREATE TABLE "ToxPatient" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "initialTreatment" TEXT,
    "isClubMember" BOOLEAN NOT NULL DEFAULT false,
    "twoWeekBooked" BOOLEAN NOT NULL DEFAULT false,
    "twoWeekDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'awaiting',
    "notes" TEXT,
    "lastCheckDate" TIMESTAMP(3),
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ToxPatient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ToxCheck" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "toxPatientId" TEXT NOT NULL,
    "checkDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ToxCheck_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ToxPatient_tenantId_status_idx" ON "ToxPatient"("tenantId", "status");

-- CreateIndex
CREATE INDEX "ToxCheck_tenantId_toxPatientId_idx" ON "ToxCheck"("tenantId", "toxPatientId");

-- AddForeignKey
ALTER TABLE "ToxPatient" ADD CONSTRAINT "ToxPatient_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToxCheck" ADD CONSTRAINT "ToxCheck_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToxCheck" ADD CONSTRAINT "ToxCheck_toxPatientId_fkey" FOREIGN KEY ("toxPatientId") REFERENCES "ToxPatient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
