import { Worker } from "bullmq";
import { logger } from "../lib/logger";
import { REDIS_URL } from "../lib/redis";

/**
 * Processes email-sending jobs from the "emails" queue.
 *
 * Event types handled:
 *   email.send-receipt
 *   email.send-order-confirmation
 *   email.send-refund
 *   email.send-shipped
 *
 * P2.15 will wire Resend (or Postmark) + React Email templates here.
 * For now we log the email intent so the pipeline is validated end-to-end.
 */
const worker = new Worker(
    "emails",
    async (job) => {
        const { eventType, aggregateId, payload } = job.data;

        logger.info(
            `[emails] eventType=${eventType} aggregateType=Order aggregateId=${aggregateId}`,
        );

        switch (eventType) {
            case "email.send-order-confirmation":
                logger.info(
                    `[emails] → send order confirmation to ${payload?.email} for order ${payload?.orderNumber}`,
                );
                break;

            case "email.send-receipt":
                logger.info(
                    `[emails] → send payment receipt to ${payload?.email} for order ${payload?.orderNumber}`,
                );
                break;

            case "email.send-refund":
                logger.info(
                    `[emails] → send refund notice to ${payload?.email} for order ${payload?.orderNumber}`,
                );
                break;

            case "email.send-shipped":
                logger.info(
                    `[emails] → send shipping notice to ${payload?.email} for order ${payload?.orderNumber}`,
                );
                break;

            default:
                logger.info(
                    `[emails] unhandled eventType=${eventType}`,
                );
        }
    },
    {
        connection: { url: REDIS_URL },
        concurrency: 10,
        removeOnComplete: { age: 24 * 3600 },
        removeOnFail: { age: 7 * 24 * 3600 },
    },
);

worker.on("failed", (job, err) => {
    logger.error(
        `[emails] job failed id=${job?.id} eventType=${job?.data?.eventType} err=${err.message}`,
    );
});

worker.on("error", (err) => {
    logger.error(`[emails] worker error: ${err.message}`);
});

export { worker as emailsWorker };
