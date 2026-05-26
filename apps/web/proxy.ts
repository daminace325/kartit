import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const COOKIE_NAME = process.env.COOKIE_NAME ?? "ecomm_auth";

const PROTECTED_PREFIXES = [
    "/account",
    "/cart",
    "/checkout",
    "/orders",
    "/profile",
    "/admin",
];

export function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;

    const isProtected = PROTECTED_PREFIXES.some(
        (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    );
    if (!isProtected) return NextResponse.next();

    const hasAuthCookie = request.cookies.has(COOKIE_NAME);
    if (!hasAuthCookie) {
        const signinUrl = new URL("/signin", request.url);
        signinUrl.searchParams.set("next", pathname);
        return NextResponse.redirect(signinUrl);
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
    ],
};
