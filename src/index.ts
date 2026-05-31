import app from "./app";
import { connectRedis } from "./config/redis";
import { startAnalyticsWorker } from "./workers/analytics.worker";
import { startKGSWorker } from "./workers/kgs.worker";
import { logger } from "./utils/logger";

const port = process.env.PORT || 3000;

const startServer = async () => {
  try {
    await connectRedis();

    // Conditionally start background workers in the main process for monolithic deployments..
    if (process.env.RUN_AS_MONOLITH === "true") {
      await startKGSWorker();
      await startAnalyticsWorker();
    }

    const server = app.listen(port, () => {
      logger.info({ service: "server", port }, "Server is running");
    });

    const gracefulShutdown = (signal: string) => {
      logger.info({ service: "server", signal }, "Shutdown signal received. Closing HTTP server");
      
      server.close(() => {
        logger.info({ service: "server" }, "HTTP server closed cleanly");
        process.exit(0);
      });
    };

    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));

  } catch (error) {
    logger.fatal({ err: error, service: "server" }, "Fatal error starting the server");
    process.exit(1);
  }
};

startServer();