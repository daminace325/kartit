import { env } from "./config/env";
import { createApp } from "./app";
import { logger } from "./lib/logger";

const app = createApp();

const server = app.listen(env.PORT, () => {
	logger.info(`API running on http://localhost:${env.PORT}`);
});

const shutdown = (signal: string) => {
	logger.info(`\n${signal} received, shutting down...`);
	server.close(() => process.exit(0));
	// Hard-exit safety net if connections refuse to close in time.
	setTimeout(() => process.exit(1), 10_000).unref();
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

// Surface async failures that would otherwise silently kill the process.
process.on("unhandledRejection", (reason) => {
	logger.error("[unhandledRejection]", reason);
});
process.on("uncaughtException", (err) => {
	logger.error("[uncaughtException]", err);
	// After an uncaught exception the process is in an undefined state.
	// Let the orchestrator (Render) restart us.
	shutdown("uncaughtException");
});
