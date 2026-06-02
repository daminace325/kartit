import { prisma } from "@repo/db";
import { webhooksRetryQueue } from "../../lib/queue";
import { AppError } from "../../lib/errors";
import { logger } from "../../lib/logger";

export const webhooksService = {
    /**
     * Manually retry a stuck webhook event. Enqueues a retry job to the
     * webhooks-retry queue and bumps the attempts counter so the worker
     * knows this is a fresh attempt, not a stale entry.
     */
    async retry(id: string): Promise<{ webhookEventId: string }> {
        const event = await prisma.webhookEvent.findUnique({
            where: { id },
            select: { id: true, processedAt: true, type: true },
        });

        if (!event) {
            throw AppError.notFound("NOT_FOUND", "Webhook event not found");
        }

        if (event.processedAt) {
            throw AppError.conflict(
                "ALREADY_PROCESSED",
                "Webhook event has already been processed",
            );
        }

        // Clear stale error state and enqueue for immediate retry.
        await prisma.webhookEvent.update({
            where: { id },
            data: {
                lastError: null,
                nextAttemptAt: new Date(),
            },
        });

        await webhooksRetryQueue.add(
            "webhook.retry",
            { webhookEventId: id },
        );

        logger.info(
            `[webhooks] manual retry enqueued for event ${id} (type=${event.type})`,
        );

        return { webhookEventId: id };
    },
};
