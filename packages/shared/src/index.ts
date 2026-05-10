// Public API of the shared package.
export * from "./money";
export * from "./enums";
export * from "./errors";
export * from "./cloudinary";
export * from "./pricing";
export * from "./schemas/auth";
export * from "./schemas/product";
export * from "./schemas/cart";
export * from "./schemas/order";

// Web-only convenience (kept for backwards compat with existing page.tsx)
export const API_URL =
    process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";