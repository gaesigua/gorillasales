-- Phase 4: offline visit capture. A visit saved on a phone carries the id the phone gave it,
-- so sending it twice (retry after a dropped connection) cannot create a duplicate.
ALTER TABLE "visit_logs" ADD COLUMN "clientRef" TEXT;
ALTER TABLE "visit_logs" ADD COLUMN "capturedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "visit_logs_organizationId_clientRef_key" ON "visit_logs"("organizationId", "clientRef");
