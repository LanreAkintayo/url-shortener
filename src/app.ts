import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import swaggerUi from "swagger-ui-express";
import promBundle from "express-prom-bundle";
import { generateOpenAPIDocument } from "./config/swagger";
import { apiRouter, redirectRouter } from "./routes/url.routes";
import { registerUrlRoutes } from "./config/swagger.registry";

const app = express();

app.use(helmet());
app.use(morgan("dev"));
app.use(express.json());

registerUrlRoutes();

const metricsMiddleware = promBundle({
  includeMethod: true,
  includePath: true,
  includeStatusCode: true,
  includeUp: true,
  promClient: {
    collectDefaultMetrics: {},
  },
});

app.use(metricsMiddleware);

app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(generateOpenAPIDocument()),
);

app.use("/api", apiRouter);
app.use("/", redirectRouter);

export default app;