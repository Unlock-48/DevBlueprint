-- CreateEnum
CREATE TYPE "AnalysisStatus" AS ENUM ('PROCESSING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "AnalysisRun" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "status" "AnalysisStatus" NOT NULL DEFAULT 'PROCESSING',
    "resultJson" JSONB,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "AnalysisRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnalysisRun_projectId_startedAt_idx" ON "AnalysisRun"("projectId", "startedAt");

-- CreateIndex
CREATE INDEX "AnalysisRun_status_idx" ON "AnalysisRun"("status");

-- AddForeignKey
ALTER TABLE "AnalysisRun" ADD CONSTRAINT "AnalysisRun_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisRun" ADD CONSTRAINT "AnalysisRun_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
