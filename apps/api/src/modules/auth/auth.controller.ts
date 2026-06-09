import { authService } from "./auth.service";
import { setAuthCookie, clearAuthCookie } from "../../lib/cookies";
import { asyncHandler } from "../../lib/asyncHandler";
import { userIdOrThrow } from "../../lib/request";

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
