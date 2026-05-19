import fs from "node:fs";
import path from "node:path";

// Set DATABASE_URL before any test module loads @repo/db
const urlFile = path.resolve(__dirname, ".test-db-url");
const url = fs.readFileSync(urlFile, "utf-8").trim();
process.env.DATABASE_URL = url;
process.env.NODE_ENV = "test";
