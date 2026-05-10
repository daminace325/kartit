export class AppError extends Error {
    constructor(
        public status: number,
        public code: string,
        message: string,
        public details?: unknown,
    ) {
        super(message);
        this.name = "AppError";
    }

    static badRequest(code: string, message: string, details?: unknown) {
        return new AppError(400, code, message, details);
    }
    static unauthorized(code = "UNAUTHORIZED", message = "Unauthorized") {
        return new AppError(401, code, message);
    }
    static forbidden(code = "FORBIDDEN", message = "Forbidden") {
        return new AppError(403, code, message);
    }
    static notFound(code = "NOT_FOUND", message = "Not found") {
        return new AppError(404, code, message);
    }
    static conflict(code: string, message: string) {
        return new AppError(409, code, message);
    }
    static internal(code = "INTERNAL", message = "Internal server error") {
        return new AppError(500, code, message);
    }
}
