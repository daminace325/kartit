import { RequestHandler } from "express";
import { authService } from "./auth.service";
import { setAuthCookie, clearAuthCookie } from "../../lib/cookies";
import { AppError } from "../../lib/errors";

export const signup: RequestHandler = async (req, res) => {
    const { user, token } = await authService.signup(req.body);
    setAuthCookie(res, token);
    res.status(201).json({ user });
};

export const signin: RequestHandler = async (req, res) => {
    const { user, token } = await authService.signin(req.body);
    setAuthCookie(res, token);
    res.json({ user });
};

export const signout: RequestHandler = async (req, res) => {
    clearAuthCookie(res);
    res.status(204).end();
};

export const me: RequestHandler = async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const user = await authService.me(req.user.id);
    res.json({ user });
};

export const changePassword: RequestHandler = async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const { user, token } = await authService.changePassword(req.user.id, req.body);
    setAuthCookie(res, token);
    res.json({ user });
};

export const signOutAll: RequestHandler = async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    await authService.signOutAll(req.user.id);
    clearAuthCookie(res);
    res.status(204).end();
};

export const updateProfile: RequestHandler = async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const user = await authService.updateProfile(req.user.id, req.body);
    res.json({ user });
};
