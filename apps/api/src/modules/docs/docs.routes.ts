import { Router, type RequestHandler } from "express";
import swaggerUi from "swagger-ui-express";
import { openApiDoc } from "../../lib/openapi";
import { env } from "../../config/env";
import { requireAdmin } from "../../middlewares/requireAuth";

export const docsRouter = Router();

const noop: RequestHandler = (req, res, next) => next();

// Serve the raw OpenAPI JSON spec
docsRouter.get("/docs.json", (req, res) => {
    res.json(openApiDoc);
});

// Swagger UI — gated behind requireAdmin in production
docsRouter.use(
    "/",
    env.isProd ? requireAdmin : noop,
    swaggerUi.serve,
    swaggerUi.setup(openApiDoc, {
        customSiteTitle: "KartIt API Docs",
        customCss: ".swagger-ui .topbar { display: none }",
    }),
);
