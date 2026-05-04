import app from "./app";
import { connectRedis } from "./config/redis";
import { startKGSWorker } from "./workers/kgs.worker";

const port = process.env.PORT || 3000;

const startServer = async () => {
  await connectRedis();

  // Start the Express server
  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });

  // Start the background worker for key generation. It is done this way because a dedicated bakcground worker server is not free on render but I'm aware of the multi-server issue, and other downsides of this approach
  await startKGSWorker();
  console.log("KGS Worker started successfully.");
};

startServer();
