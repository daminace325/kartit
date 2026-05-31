import { Worker } from "bullmq";
import { REDIS_URL } from "../lib/redis";

/**
 * Processes order-lifecycle events from the "order-events" queue.
 *
 * Event types handled:
 *   OrderCreated  → fan-out to email.send-order-confirmation
 *   OrderPaid     → fan-out to email.send-receipt + ledger.write-entries
 *   OrderCancelled → log (future: release reservations, notify)
 *   OrderRefunded → fan-out to ledger.write-entries + email.send-refund
 *   OrderPaymentFailed → log
 */
const worker = new Worker(
    "order-events",
    async (job) => {
        const { eventType, aggregateId, payload } = job.data;

        switch (eventType) {
            case "OrderCreated":
                console.log(
                    `[order-events] OrderCreated order=${aggregateId} orderNumber=${payload?.orderNumber}`,
                );
                // P2.15: dispatch email.send-order-confirmation
                // P2.4:  dispatch ledger.write-entries (revenue recognition)
                break;

            case "OrderPaid":
                console.log(
                    `[order-events] OrderPaid order=${aggregateId} total=${payload?.totalMinor}`,
                );
                // P2.15: dispatch email.send-receipt
                // P2.4:  dispatch ledger.write-entries
                break;

            case "OrderCancelled":
                console.log(
                    `[order-events] OrderCancelled order=${aggregateId}`,
                );
                // P2.7: release reservation
                break;

            case "OrderRefunded":
                console.log(
                    `[order-events] OrderRefunded order=${aggregateId}`,
                );
                // P2.4:  dispatch ledger.write-entries
                // P2.15: dispatch email.send-refund
                break;

            case "OrderPaymentFailed":
                console.log(
                    `[order-events] OrderPaymentFailed order=${aggregateId}`,
                );
                break;

            default:
                console.log(
                    `[order-events] unhandled eventType=${eventType} order=${aggregateId}`,
                );
        }
    },
    {
        connection: { url: REDIS_URL },
        concurrency: 5,
        removeOnComplete: { age: 24 * 3600 },
        removeOnFail: { age: 7 * 24 * 3600 },
    },
);

worker.on("failed", (job, err) => {
    console.error(
        `[order-events] job failed id=${job?.id} eventType=${job?.data?.eventType} err=${err.message}`,
    );
});

worker.on("error", (err) => {
    console.error(`[order-events] worker error: ${err.message}`);
});

export { worker as orderEventsWorker };
