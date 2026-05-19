import {
    PostgreSqlContainer,
    type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const DB_URL_FILE = path.resolve(__dirname, ".test-db-url");

let container: StartedPostgreSqlContainer;

export async function setup() {
    container = await new PostgreSqlContainer("postgres:16-alpine")
        .withDatabase("ecomm_test")
        .withUsername("test")
        .withPassword("test")
        .start();

    const url = `postgresql://test:test@${container.getHost()}:${container.getPort()}/ecomm_test`;

    // Persist for worker setup.ts
    fs.writeFileSync(DB_URL_FILE, url, "utf-8");

    // Run migrations on the test DB
    const dbRoot = path.resolve(__dirname, "../../../packages/db");
    execSync(`npx prisma migrate deploy`, {
        cwd: dbRoot,
        env: { ...process.env, DATABASE_URL: url },
        stdio: "pipe",
    });
}

export async function teardown() {
    await container?.stop();
    try {
        fs.unlinkSync(DB_URL_FILE);
    } catch {
        // Ignore
    }
}
