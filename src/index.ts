import app from "./app";
import { connectRedis } from "./config/redis";
import { startAnalyticsWorker } from "./workers/analytics.worker";
import { startKGSWorker } from "./workers/kgs.worker";

const port = process.env.PORT || 3000;

const startServer = async () => {
  try {
    await connectRedis();
    console.log("Redis connected successfully.");

    // For local: false because we have docker-compose but for render: true
    if (process.env.RUN_AS_MONOLITH === "true") {
      await startKGSWorker();
      console.log("KGS Worker started successfully.");

      await startAnalyticsWorker();
      console.log("Analytics Worker started successfully.");
    }

    // Start the Express server
    const server = app.listen(port, () => {
      console.log(`Server is running on port ${port}`);
    });

    process.on("SIGTERM", () => {
      server.close(() => {
        console.log("Server closed");
        process.exit(0);
      });
    });
  } catch (error) {
    console.error("Error starting the server:", error);
    process.exit(1);
  }
};

startServer();
