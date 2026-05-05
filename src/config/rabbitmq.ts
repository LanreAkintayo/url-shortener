import amqp, { Channel, ChannelModel } from "amqplib";
import dotenv from "dotenv";

dotenv.config();

let connection: ChannelModel | null = null;
let channel: Channel | null = null;
let connectionPromise: Promise<Channel> | null = null;
const AMPQP_URL =
  process.env.NODE_ENV === "production"
    ? process.env.AMQP_URL
    : process.env.AMQP_URL_LOCAL;
export const connectRabbitMQ = async () => {
  if (channel && connection) return channel;

  if (connectionPromise) return connectionPromise;

  connectionPromise = (async () => {
    try {
      connection = await amqp.connect(AMPQP_URL!);

      connection.on("error", (err) => {
        console.error("RabbitMQ connection error:", err);
        connection = null;
        channel = null;
        connectionPromise = null;
      });

      connection.on("close", () => {
        console.warn("RabbitMQ connection closed. Reconnecting in 5s...");
        connection = null;
        channel = null;
        connectionPromise = null;
        // Safely catch the retry attempt so it doesn't crash Node
        setTimeout(() => {
          connectRabbitMQ().catch((err) =>
            console.error("Reconnection attempt failed:", err),
          );
        }, 5000);
      });
      channel = await connection.createChannel();
      await channel.assertQueue("analytics_queue", { durable: true });

      console.log("Connected to RabbitMQ");
      return channel;
    } catch (error) {
      // If channel setup fails after connection succeded, close the half-open connection cleanly before resetting.

      if (connection) {
        await connection.close().catch(() => {});
        connection = null;
      }
      connectionPromise = null;
      console.error("Error connecting to RabbitMQ:", error);
      throw error;
    }
  })();

  return connectionPromise;
};
