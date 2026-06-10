import { Worker } from "bullmq";
import { logger } from "../lib/logger";
import { REDIS_URL } from "../lib/redis";
import { runReconciliation } from "../lib/reconciliation";

/**
 * Processes reconciliation jobs from the "reconciliation" queue.
 *
 * Event types handled:
 *   reconciliation.daily   — nightly Stripe reconciliation (P2.5)
 *
 * P2.5: reconciliation.daily pulls Stripe balance_transactions since the
 * last run, joins against Payment/LedgerEntry by PaymentIntent id, detects
 * drift, and writes a ReconciliationReport row.
 */
const worker = new Worker(
    "reconciliation",
    async (job) => {
        const { eventType, aggregateId } = job.data;

        logger.info(
            `[reconciliation] eventType=${eventType} aggregateId=${aggregateId}`,
        );

        switch (eventType) {
            case "reconciliation.daily": {
                logger.info(
                    `[reconciliation] → running Stripe reconciliation`,
                );
                const result = await runReconciliation();
                logger.info(
                    `[reconciliation] → complete: ` +
                        `transactions=${result.transactionCount} ` +
                        `matched=${result.matchedCount} ` +
                        `drift=${result.driftMinor} ` +
                        `mismatched=${result.mismatchedCount}`,
                );
                break;
            }

            default:
                logger.info(
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
    logger.error(
        `[reconciliation] job failed id=${job?.id} eventType=${job?.data?.eventType} err=${err.message}`,
    );
});

worker.on("error", (err) => {
    logger.error(`[reconciliation] worker error: ${err.message}`);
});

export { worker as reconciliationWorker };
