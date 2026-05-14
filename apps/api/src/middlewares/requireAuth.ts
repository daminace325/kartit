import { RequestHandler } from "express";
import { prisma } from "@repo/db";
import { ErrorCode, UserRole } from "@repo/shared";
import { env } from "../config/env";
import { verifyToken } from "../lib/jwt";
import { AppError } from "../lib/errors";
import { clearAuthCookie } from "../lib/cookies";
import { userCache } from "../lib/cache";

declare global {
    namespace Express {
        interface Request {
            user?: { id: string; role: UserRole };
        }
    }
}

const CACHE_TTL_MS = 60_000;

export const requireAuth: RequestHandler = async (req, res, next) => {
    const token = req.cookies?.[env.COOKIE_NAME];
    if (!token) return next(AppError.unauthorized());

    let payload: { sub: string; role: UserRole; tv: number };
    try {
        payload = verifyToken(token);
    } catch {
        clearAuthCookie(res);
        return next(AppError.unauthorized("INVALID_TOKEN", "Invalid or expired token"));
    }

    try {
        const cached = userCache.get(payload.sub);
        if (cached && cached.tokenVersion === payload.tv) {
            req.user = { id: cached.id, role: cached.role as UserRole };
            return next();
        }

        const user = await prisma.user.findUnique({
            where: { id: payload.sub },
            select: { id: true, role: true, tokenVersion: true },
        });
        if (!user) {
            userCache.del(payload.sub);
            clearAuthCookie(res);
            return next(
                AppError.unauthorized(ErrorCode.SESSION_INVALID, "Session is no longer valid"),
            );
        }
        if (payload.tv !== user.tokenVersion) {
            userCache.del(payload.sub);
            clearAuthCookie(res);
            return next(
                AppError.unauthorized(ErrorCode.SESSION_INVALID, "Session has been invalidated"),
            );
        }
        userCache.set(payload.sub, {
            id: user.id,
            role: user.role,
            tokenVersion: user.tokenVersion,
        }, CACHE_TTL_MS);
        req.user = { id: user.id, role: user.role as UserRole };
        next();
    } catch (err) {
        next(err);
    }
};

export const requireAdmin: RequestHandler = (req, res, next) => {
    if (!req.user) return next(AppError.unauthorized());
    if (req.user.role !== UserRole.ADMIN) return next(AppError.forbidden());
    next();
};
