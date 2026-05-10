import { env } from "./config/env";
import { createApp } from "./app";

const app = createApp();

const server = app.listen(env.PORT, () => {
	console.log(`API running on http://localhost:${env.PORT}`);
});

const shutdown = (signal: string) => {
	console.log(`\n${signal} received, shutting down...`);
	server.close(() => process.exit(0));
	// Hard-exit safety net if connections refuse to close in time.
	setTimeout(() => process.exit(1), 10_000).unref();
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

// Surface async failures that would otherwise silently kill the process.
process.on("unhandledRejection", (reason) => {
	console.error("[unhandledRejection]", reason);
});
process.on("uncaughtException", (err) => {
	console.error("[uncaughtException]", err);
	// After an uncaught exception the process is in an undefined state.
	// Let the orchestrator (Render) restart us.
	shutdown("uncaughtException");
});
