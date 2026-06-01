-- CreateTable
CREATE TABLE "ReconciliationReport" (
    "id" TEXT NOT NULL,
    "runAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startCursor" TEXT,
    "endCursor" TEXT,
    "totalStripeAmount" BIGINT NOT NULL,
    "totalLedgerAmount" BIGINT NOT NULL,
    "driftMinor" BIGINT NOT NULL,
    "transactionCount" INTEGER NOT NULL,
    "matchedCount" INTEGER NOT NULL,
    "mismatchedRefs" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReconciliationReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReconciliationReport_runAt_idx" ON "ReconciliationReport"("runAt");
