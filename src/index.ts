import app from "./app";
import { connectRedis } from "./config/redis";

const port = process.env.PORT || 3000;

const startServer = async () => {
    await connectRedis();

    app.listen(port, () => {
        console.log(`Server is running on port ${port}`);
    });
};

startServer();