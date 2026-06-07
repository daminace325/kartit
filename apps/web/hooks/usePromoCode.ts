"use client";

import { useState, useCallback, useRef } from "react";
import { type CartSummaryDTO } from "@repo/shared";
import { apiFetch, ApiClientError } from "@/services/apiClient";

interface UsePromoCodeOptions {
	initialCode?: string;
	/** Called with the API response after a successful apply/remove. */
	onSuccess?: (data: CartSummaryDTO, appliedCode: string) => void;
}

export function usePromoCode(options?: UsePromoCodeOptions) {
	const { initialCode = "", onSuccess } = options ?? {};

	const [promoCode, setPromoCode] = useState(initialCode);
	const [promoInput, setPromoInput] = useState(initialCode);
	const [applying, setApplying] = useState(false);
	const [promoError, setPromoError] = useState<string | null>(null);
	const generationRef = useRef(0);

	// Ref so applyPromo stays referentially stable even when onSuccess changes.
	const onSuccessRef = useRef(onSuccess);
	onSuccessRef.current = onSuccess;

	const applyPromo = useCallback(async (code: string) => {
		const trimmed = code.trim();
		const gen = ++generationRef.current;
		setApplying(true);
		setPromoError(null);

		try {
			const data = await apiFetch<CartSummaryDTO>("/cart/summary", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(trimmed ? { promotionCode: trimmed } : {}),
			});
			if (generationRef.current !== gen) return;

			const appliedCode = data.promotionCode ?? trimmed;
			setPromoCode(appliedCode);
			setPromoInput(data.promotionCode ?? (trimmed || ""));
			onSuccessRef.current?.(data, appliedCode);
		} catch (err) {
			if (generationRef.current !== gen) return;
			if (err instanceof ApiClientError) {
				setPromoError(err.message);
			} else {
				setPromoError(
					trimmed ? "Failed to apply promo code" : "Failed to remove promo code",
				);
			}
		} finally {
			if (generationRef.current === gen) setApplying(false);
		}
	}, []);

	const clearError = useCallback(() => setPromoError(null), []);

	return {
		promoCode,
		promoInput,
		setPromoInput,
		applying,
		promoError,
		clearError,
		applyPromo,
	};
}
