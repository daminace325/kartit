import type { NextConfig } from "next";

const API_URL =
    process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

const nextConfig: NextConfig = {
    // Standalone output for Docker: produces a self-contained server.js +
    // minimal node_modules so the production image stays small.
    output: "standalone",

    // Workspace packages ship TypeScript sources alongside built dist/.
    // Telling Next to transpile them means hot-reload works in dev when
    // editing packages/*/src/* and we don't need a watch-mode tsc for them.
    transpilePackages: ["@repo/shared", "@repo/db"],

    // Proxy /api/* in the browser to the Express API. This keeps everything
    // same-origin from the browser’s perspective, so the API’s httpOnly
    // auth cookie (set on responses) lands on the web origin and is then
    // automatically attached to subsequent /api/* requests AND visible to
    // server components via next/headers cookies().
    async rewrites() {
        return [
            {
                source: "/api/:path*",
                destination: `${API_URL}/:path*`,
            },
        ];
    },
};

export default nextConfig;
