import fs from "node:fs";
import path from "node:path";

// Set env vars before any test module loads (env.ts validates at import time)
const urlFile = path.resolve(__dirname, ".test-db-url");
const url = fs.readFileSync(urlFile, "utf-8").trim();
process.env.DATABASE_URL = url;
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-jwt-secret-at-least-32-chars-long";
