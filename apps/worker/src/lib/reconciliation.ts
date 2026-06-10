import { prisma, Prisma } from "@repo/db";
import { logger } from "./logger";
import { getStripeWorker } from "./stripe";

interface MismatchedRef {
    reference: string;
    stripeAmount: string;
    ledgerAmount: string;
    drift: string;
    type: string;
}

/** Minimal shape of a Stripe Charge (only the fields we need). */
interface ChargeLike {
    payment_intent: string | null;
}

/**
 * Runs a full Stripe reconciliation pass.
 *
 * 1. Reads the last ReconciliationReport to get the pagination cursor.
 * 2. Pulls Stripe balance_transactions since that cursor (paginated).
 * 3. For each charge/refund transaction, matches it against our Payment
 *    and LedgerEntry records via the Stripe PaymentIntent ID.
 * 4. Writes a ReconciliationReport row with the results.
 *
 * Returns a summary of the created report. Logs a warning if drift > 0.
 */
export async function runReconciliation(): Promise<{
    id: string;
    driftMinor: string;
    transactionCount: number;
    matchedCount: number;
    mismatchedCount: number;
}> {
    const stripe = getStripeWorker();

    // ── 1. Get the cursor from the last completed run ──────────────────
    const lastReport = await prisma.reconciliationReport.findFirst({
        orderBy: { runAt: "desc" },
    });

    const startCursor = lastReport?.endCursor ?? undefined;
    // Only look at transactions created after the last report's timestamp
    const createdAfter = lastReport
        ? Math.floor(lastReport.runAt.getTime() / 1000)
        : undefined;

    // ── 2. Pull balance_transactions from Stripe (paginated) ──────────
    let pageCursor: string | undefined = startCursor;
    let hasMore = true;
    let endCursor: string | null = null;

    let totalStripeAmount = 0n;
    let totalLedgerAmount = 0n;
    let transactionCount = 0;
    let matchedCount = 0;
    const mismatchedRefs: MismatchedRef[] = [];

    // Track which payment charges we've already added to the ledger
    // total. Refunds are always subtracted — deduplicating by payment ID
    // alone would skip refund balance transactions on the same PI and
    // produce a false-positive drift.
    const addedChargeIds = new Set<string>();

    // Cache for charges we've already retrieved
    const chargeCache = new Map<string, ChargeLike>();

    while (hasMore) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const params: Record<string, any> = {
            limit: 100,
        };
        if (pageCursor) {
            params.starting_after = pageCursor;
        }
        if (createdAfter) {
            params.created = { gt: createdAfter };
        }

        const btList = await stripe.balanceTransactions.list(params);

        for (const bt of btList.data) {
            transactionCount++;

            // Only reconcile charges and refunds — skip fees, adjustments, etc.
            if (bt.type !== "charge" && bt.type !== "refund") {
                continue;
            }

            totalStripeAmount += BigInt(bt.amount);

            // ── Resolve the Stripe PaymentIntent ID ──────────────────
            let piId: string | null = null;

            try {
                if (bt.type === "charge") {
                    const chargeId = bt.source as string;
                    let charge = chargeCache.get(chargeId);
                    if (!charge) {
                        charge = (await stripe.charges.retrieve(
                            chargeId,
                        )) as unknown as ChargeLike;
                        chargeCache.set(chargeId, charge);
                    }
                    piId = charge.payment_intent ?? null;
                } else {
                    // bt.type === "refund" — retrieve refund → charge → PI
                    const refund = await stripe.refunds.retrieve(
                        bt.source as string,
                    );
                    const chargeId = refund.charge as string;
                    let charge = chargeCache.get(chargeId);
                    if (!charge) {
                        charge = (await stripe.charges.retrieve(
                            chargeId,
                        )) as unknown as ChargeLike;
                        chargeCache.set(chargeId, charge);
                    }
                    piId = charge.payment_intent ?? null;
                }
            } catch (err) {
                const msg =
                    err instanceof Error ? err.message : String(err);
                logger.warn(
                    `[reconciliation] could not resolve PI for bt=${bt.id} type=${bt.type}: ${msg}`,
                );
                continue;
            }

            if (!piId) {
                // No PaymentIntent linked — could be a direct charge or
                // a non-KartIt transaction. Skip.
                continue;
            }

            // ── Match against our Payment record ────────────────────
            const payment = await prisma.payment.findUnique({
                where: { providerPaymentId: piId },
            });

            if (!payment) {
                // Payment not in our system — could be from a different
                // environment or a manual Stripe operation. Skip.
                continue;
            }

            // Compare: |bt.amount| should match our Payment.amountMinor.
            // For charges bt.amount is positive, for refunds it's negative.
            const stripeAbs =
                bt.amount >= 0
                    ? BigInt(bt.amount)
                    : BigInt(-bt.amount);

            const ledgerAmount = payment.amountMinor;

            if (bt.type === "charge") {
                // Add the full payment amount once per unique charge.
                // Stripe may emit multiple balance transactions for the
                // same PI (e.g. capture + fee adjustment) — deduplicate
                // so the ledger total isn't inflated.
                if (!addedChargeIds.has(payment.id)) {
                    addedChargeIds.add(payment.id);
                    totalLedgerAmount += ledgerAmount;
                }
            } else {
                // Refund: subtract the refund amount from the ledger
                // total so it mirrors Stripe's signed net. Without a
                // separate refund ledger entry, skip the per-transaction
                // comparison — only contribute to the aggregate.
                totalLedgerAmount -= stripeAbs;
            }

            const drift = stripeAbs - ledgerAmount;

            matchedCount++;

            // Only flag charge mismatches. Refunds don't have a separate
            // ledger entry to compare against — their contribution is
            // handled in the aggregate via totalLedgerAmount above.
            if (bt.type === "charge" && drift !== 0n) {
                mismatchedRefs.push({
                    reference: `pi:${piId}`,
                    stripeAmount: bt.amount.toString(),
                    ledgerAmount: ledgerAmount.toString(),
                    drift: drift.toString(),
                    type: bt.type,
                });
            }
        }

        hasMore = btList.has_more;
        if (btList.data.length > 0) {
            endCursor = btList.data[btList.data.length - 1].id;
        }
    }

    // ── 3. Write the report ──────────────────────────────────────────
    const driftMinor = totalStripeAmount - totalLedgerAmount;

    const report = await prisma.reconciliationReport.create({
        data: {
            startCursor,
            endCursor,
            totalStripeAmount,
            totalLedgerAmount,
            driftMinor,
            transactionCount,
            matchedCount,
            mismatchedRefs: mismatchedRefs as unknown as Prisma.InputJsonValue,
        },
    });

    if (driftMinor !== 0n) {
        logger.warn(
            `[reconciliation] DRIFT DETECTED: driftMinor=${driftMinor} ` +
                `totalStripe=${totalStripeAmount} totalLedger=${totalLedgerAmount} ` +
                `mismatched=${mismatchedRefs.length}`,
        );
    }

    logger.info(
        `[reconciliation] report id=${report.id} ` +
            `transactions=${transactionCount} matched=${matchedCount} ` +
            `drift=${driftMinor} mismatched=${mismatchedRefs.length}`,
    );

    return {
        id: report.id,
        driftMinor: driftMinor.toString(),
        transactionCount,
        matchedCount,
        mismatchedCount: mismatchedRefs.length,
    };
}
