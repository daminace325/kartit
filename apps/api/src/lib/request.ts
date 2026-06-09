import type { RequestHandler } from "express";
import { AppError } from "./errors";

export function userIdOrThrow(req: Parameters<RequestHandler>[0]): string {
    const id = req.user?.id;
    if (!id) throw AppError.unauthorized();
    return id;
}
