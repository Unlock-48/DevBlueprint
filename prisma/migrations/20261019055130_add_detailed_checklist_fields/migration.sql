-- AlterTable
ALTER TABLE "ChecklistItem" ADD COLUMN     "details" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "phase" TEXT NOT NULL DEFAULT 'ทั่วไป',
ADD COLUMN     "priority" TEXT NOT NULL DEFAULT 'MEDIUM';
