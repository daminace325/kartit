import { Worker } from "bullmq";
import { REDIS_URL } from "../lib/redis";

/**
 * Processes reconciliation jobs from the "reconciliation" queue.
 *
 * Event types handled:
 *   reconciliation.daily   — nightly Stripe reconciliation (P2.5)
 *   ledger.write-entries   — write double-entry ledger rows (P2.4)
 *
 * Both are scheduled in P2.4/P2.5; for now we log so the pipeline is wired.
 */
const worker = new Worker(
    "reconciliation",
    async (job) => {
        const { eventType, aggregateId, payload } = job.data;

        console.log(
            `[reconciliation] eventType=${eventType} aggregateId=${aggregateId}`,
        );

        switch (eventType) {
            case "reconciliation.daily":
                console.log(
                    `[reconciliation] → run daily Stripe reconciliation`,
                );
                // P2.5: pull Stripe balance_transactions, join against LedgerEntry
                break;

            case "ledger.write-entries":
                console.log(
                    `[reconciliation] → write ledger entries for order=${aggregateId} direction=${payload?.direction}`,
                );
                // P2.4: insert LedgerEntry rows (DEBIT/CREDIT pairs)
                break;

            default:
                console.log(
                    `[reconciliation] unhandled eventType=${eventType}`,
                );
        }
    },
    {
        connection: { url: REDIS_URL },
        concurrency: 2,
        removeOnComplete: { age: 7 * 24 * 3600 },
        removeOnFail: { age: 30 * 24 * 3600 },
    },
);

worker.on("failed", (job, err) => {
    console.error(
        `[reconciliation] job failed id=${job?.id} eventType=${job?.data?.eventType} err=${err.message}`,
    );
});

worker.on("error", (err) => {
    console.error(`[reconciliation] worker error: ${err.message}`);
});

export { worker as reconciliationWorker };
