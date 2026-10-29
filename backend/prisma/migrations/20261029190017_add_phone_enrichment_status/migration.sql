-- AlterTable
ALTER TABLE "lead" ADD COLUMN "phoneEnrichedAt" DATETIME;
ALTER TABLE "lead" ADD COLUMN "phoneEnrichmentProvider" TEXT;
ALTER TABLE "lead" ADD COLUMN "phoneEnrichmentStatus" TEXT;
