/**
 * One-shot script that enqueues a reconciliation.daily job.
 *
 * Run by a nightly cron (e.g. Render Cron Job, or any scheduler):
 *   npm run job:reconcile
 *
 * The reconciliation worker picks it up and runs a full Stripe reconciliation
 * pass (P2.5).
 */
import { logger } from "../lib/logger";
import { reconciliationQueue } from "../queues/reconciliation";

async function main(): Promise<void> {
    logger.info("[trigger-reconciliation] enqueuing reconciliation.daily job...");

    const job = await reconciliationQueue.add("reconciliation.daily", {
        aggregateType: "System",
        aggregateId: `daily-${new Date().toISOString().slice(0, 10)}`,
        eventType: "reconciliation.daily",
        payload: {},
    });

    logger.info(`[trigger-reconciliation] enqueued job id=${job.id}`);

    await reconciliationQueue.close();
    process.exit(0);
}

main().catch((err) => {
    logger.error("[trigger-reconciliation] fatal:", err);
    process.exit(1);
});
