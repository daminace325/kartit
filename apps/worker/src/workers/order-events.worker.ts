import { Worker } from "bullmq";
import { prisma } from "@repo/db";
import { REDIS_URL } from "../lib/redis";

/**
 * Processes order-lifecycle events from the "order-events" queue.
 *
 * Event types handled:
 *   OrderCreated  → log (future: email.send-order-confirmation)
 *   OrderPaid     → write double-entry ledger (CASH DEBIT + REVENUE CREDIT)
 *                    (future: email.send-receipt)
 *   OrderCancelled → log (future: release reservations, notify)
 *   OrderRefunded → write double-entry ledger (REFUNDS DEBIT + CASH CREDIT)
 *                    (future: email.send-refund)
 *   OrderPaymentFailed → log
 */

async function writeLedgerEntries(
    outboxId: string,
    orderId: string,
    providerPaymentId: string | undefined,
    entries: Array<{ account: string; direction: "DEBIT" | "CREDIT"; amountMinor: bigint; memo: string }>,
): Promise<void> {
    // Idempotency: skip if already recorded for this outbox event.
    const existing = await prisma.ledgerEntry.findFirst({
        where: { reference: `outbox:${outboxId}` },
    });
    if (existing) {
        console.log(
            `[order-events] ledger entries already exist for outbox=${outboxId}, skipping`,
        );
        return;
    }

    await prisma.$transaction(
        entries.map((e) =>
            prisma.ledgerEntry.create({
                data: {
                    account: e.account,
                    direction: e.direction,
                    amountMinor: e.amountMinor,
                    orderId,
                    reference: `outbox:${outboxId}`,
                    memo: `${e.memo} — pi=${providerPaymentId ?? "N/A"}`,
                },
            }),
        ),
    );

    console.log(
        `[order-events] wrote ${entries.length} ledger entries for outbox=${outboxId} order=${orderId}`,
    );
}

const worker = new Worker(
    "order-events",
    async (job) => {
        const { eventType, aggregateId, payload } = job.data;
        // The outbox row id is passed in the job data for idempotency.
        const outboxId = job.data.outboxId as string;

        switch (eventType) {
            case "OrderCreated":
                console.log(
                    `[order-events] OrderCreated order=${aggregateId} orderNumber=${payload?.orderNumber}`,
                );
                // P2.15: dispatch email.send-order-confirmation
                break;

            case "OrderPaid": {
                const totalMinor = BigInt(payload.totalMinor as string);
                const providerPaymentId = payload.providerPaymentId as string | undefined;
                console.log(
                    `[order-events] OrderPaid order=${aggregateId} total=${totalMinor}`,
                );
                // P2.4: double-entry — money came in → asset (CASH) goes up (DEBIT)
                await writeLedgerEntries(outboxId, aggregateId, providerPaymentId, [
                    { account: "CASH", direction: "DEBIT", amountMinor: totalMinor, memo: "Customer payment received" },
                    { account: "REVENUE", direction: "CREDIT", amountMinor: totalMinor, memo: "Order revenue recognized" },
                ]);
                // P2.15: dispatch email.send-receipt
                break;
            }

            case "OrderCancelled":
                console.log(
                    `[order-events] OrderCancelled order=${aggregateId}`,
                );
                // P2.7: release reservation
                break;

            case "OrderRefunded": {
                const totalMinor = BigInt(payload.totalMinor as string);
                const providerPaymentId = payload.providerPaymentId as string | undefined;
                console.log(
                    `[order-events] OrderRefunded order=${aggregateId} total=${totalMinor}`,
                );
                // P2.4: double-entry — money goes out → asset (CASH) goes down (CREDIT)
                await writeLedgerEntries(outboxId, aggregateId, providerPaymentId, [
                    { account: "REFUNDS", direction: "DEBIT", amountMinor: totalMinor, memo: "Refund issued to customer" },
                    { account: "CASH", direction: "CREDIT", amountMinor: totalMinor, memo: "Cash returned for refund" },
                ]);
                // P2.15: dispatch email.send-refund
                break;
            }

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
