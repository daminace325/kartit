import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
    test: {
        globals: true,
        environment: "node",
        globalSetup: ["./test/globalSetup.ts"],
        setupFiles: ["./test/setup.ts"],
        testTimeout: 30_000,
        hookTimeout: 30_000,
        fileParallelism: false,
        pool: "forks",
    },
    resolve: {
        alias: {
            "@repo/shared": path.resolve(__dirname, "../../packages/shared/src"),
            "@repo/db": path.resolve(__dirname, "../../packages/db/src"),
        },
    },
});
