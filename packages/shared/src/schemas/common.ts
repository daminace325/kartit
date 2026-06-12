import { z } from "../lib/zod";

/** Reusable cursor query parameter — an opaque pagination token. */
export const cursorField = z.string().optional();

/** Reusable limit query parameter. `max` caps the page size (default 50). */
export const limitField = (max = 50) =>
    z.coerce.number().int().min(1).max(max).default(20);
