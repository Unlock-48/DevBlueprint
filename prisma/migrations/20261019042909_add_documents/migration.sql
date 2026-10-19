-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('UPLOADED', 'PARSED', 'FAILED');

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "contentText" TEXT NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'UPLOADED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Document_projectId_createdAt_idx" ON "Document"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "Document_projectId_status_idx" ON "Document"("projectId", "status");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
