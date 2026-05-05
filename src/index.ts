import app from "./app";
import { connectRedis } from "./config/redis";
import { startAnalyticsWorker } from "./workers/analytics.worker";
import { startKGSWorker } from "./workers/kgs.worker";

const port = process.env.PORT || 3000;

const startServer = async () => {
  await connectRedis();
  console.log("Redis connected successfully.");

  await startKGSWorker();
  console.log("KGS Worker started successfully.");

  await startAnalyticsWorker();
  console.log("Analytics Worker started successfully.");

  // Start the Express server
  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });

  // Start the background worker for key generation. It is done this way because a dedicated bakcground worker server is not free on render but I'm aware of the multi-server issue, and other downsides of this approach
  await startKGSWorker();
  console.log("KGS Worker started successfully.");
};

startServer();
