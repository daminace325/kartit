import type { Queue } from "bullmq";
import { orderEventsQueue } from "./order-events";
import { emailsQueue } from "./emails";
import { reconciliationQueue } from "./reconciliation";
import { webhooksRetryQueue } from "./webhooks-retry";
import { inventorySweepQueue } from "./inventory-sweep";

/** All queues keyed by name for the outbox dispatcher. */
export const queues: Record<string, Queue> = {
    "order-events": orderEventsQueue,
    emails: emailsQueue,
    reconciliation: reconciliationQueue,
    "webhooks-retry": webhooksRetryQueue,
    "inventory-sweep": inventorySweepQueue,
};

/**
 * Maps an Outbox eventType to the BullMQ queue that should process it.
 * Default queue for order-lifecycle events is "order-events".
 */
export function getQueueForEvent(eventType: string): string {
    if (eventType.startsWith("email.")) return "emails";
    if (eventType.startsWith("reconciliation.")) return "reconciliation";
    if (eventType.startsWith("webhook.")) return "webhooks-retry";
    if (eventType.startsWith("inventory.")) return "inventory-sweep";
    return "order-events";
}
