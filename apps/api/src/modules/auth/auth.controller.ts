import type { RequestHandler } from "express";
import { authService } from "./auth.service";
import { setAuthCookie, clearAuthCookie } from "../../lib/cookies";
import { AppError } from "../../lib/errors";
import { asyncHandler } from "../../lib/asyncHandler";

function userIdOrThrow(req: Parameters<RequestHandler>[0]): string {
    const id = req.user?.id;
    if (!id) throw AppError.unauthorized();
    return id;
}

export const signup = asyncHandler(async (req, res) => {
    const { user, token } = await authService.signup(req.body);
    setAuthCookie(res, token);
    res.status(201).json({ user });
});

export const signin = asyncHandler(async (req, res) => {
    const { user, token } = await authService.signin(req.body);
    setAuthCookie(res, token);
    res.json({ user });
});

export const signout = asyncHandler(async (_req, res) => {
    clearAuthCookie(res);
    res.status(204).end();
});

export const me = asyncHandler(async (req, res) => {
    const user = await authService.me(userIdOrThrow(req));
    res.json({ user });
});

export const changePassword = asyncHandler(async (req, res) => {
    const { user, token } = await authService.changePassword(userIdOrThrow(req), req.body);
    setAuthCookie(res, token);
    res.json({ user });
});

export const signOutAll = asyncHandler(async (req, res) => {
    await authService.signOutAll(userIdOrThrow(req));
    clearAuthCookie(res);
    res.status(204).end();
});

export const updateProfile = asyncHandler(async (req, res) => {
    const user = await authService.updateProfile(userIdOrThrow(req), req.body);
    res.json({ user });
});
