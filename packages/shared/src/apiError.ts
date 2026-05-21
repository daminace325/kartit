import type { ErrorCode } from "./errorCodes";

export type ApiError = {
    code: ErrorCode | string;
    message: string;
    details?: unknown;
};
