import type { CookieOptions, Response } from "express";
import { env } from "../config/env";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

const baseOptions: CookieOptions = {
    httpOnly: true,
    sameSite: env.COOKIE_SAMESITE,
    secure: env.COOKIE_SECURE,
    path: "/",
};

export function setAuthCookie(res: Response, token: string) {
    res.cookie(env.COOKIE_NAME, token, {
        ...baseOptions,
        maxAge: SEVEN_DAYS_MS,
    });
}

export function clearAuthCookie(res: Response) {
    res.clearCookie(env.COOKIE_NAME, baseOptions);
}
