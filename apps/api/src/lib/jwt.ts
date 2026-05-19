import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../config/env";
import type { UserRole } from "@repo/shared";

type JwtPayload = {
    sub: string; // user id
    role: UserRole;
    tv: number; // tokenVersion
};

export function signToken(payload: JwtPayload): string {
    return jwt.sign(payload, env.JWT_SECRET, {
        expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"],
        algorithm: "HS256",
    });
}

export function verifyToken(token: string): JwtPayload {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    if (typeof decoded === "string") throw new Error("Invalid token");
    return decoded as JwtPayload;
}
