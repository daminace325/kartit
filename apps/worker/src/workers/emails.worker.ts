import { Worker } from "bullmq";
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

        console.log(
            `[emails] eventType=${eventType} aggregateType=Order aggregateId=${aggregateId}`,
        );

        switch (eventType) {
            case "email.send-order-confirmation":
                console.log(
                    `[emails] → send order confirmation to ${payload?.email} for order ${payload?.orderNumber}`,
                );
                break;

            case "email.send-receipt":
                console.log(
                    `[emails] → send payment receipt to ${payload?.email} for order ${payload?.orderNumber}`,
                );
                break;

            case "email.send-refund":
                console.log(
                    `[emails] → send refund notice to ${payload?.email} for order ${payload?.orderNumber}`,
                );
                break;

            case "email.send-shipped":
                console.log(
                    `[emails] → send shipping notice to ${payload?.email} for order ${payload?.orderNumber}`,
                );
                break;

            default:
                console.log(
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
    console.error(
        `[emails] job failed id=${job?.id} eventType=${job?.data?.eventType} err=${err.message}`,
    );
});

worker.on("error", (err) => {
    console.error(`[emails] worker error: ${err.message}`);
});

export { worker as emailsWorker };
