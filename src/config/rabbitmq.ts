import amqp, { Channel, ChannelModel } from "amqplib";
import dotenv from "dotenv";
import { logger } from "../utils/logger";

dotenv.config();

let connection: ChannelModel | null = null;
let channel: Channel | null = null;
let connectionPromise: Promise<Channel> | null = null;

const AMQP_URL =
  process.env.NODE_ENV === "production"
    ? process.env.AMQP_URL
    : process.env.AMQP_URL_LOCAL;

/**
 * Establishes a singleton connection to RabbitMQ with automatic reconnection handling.
 */
export const connectRabbitMQ = async (): Promise<Channel> => {
  if (channel && connection) return channel;

  if (connectionPromise) return connectionPromise;

  connectionPromise = (async () => {
    try {
      connection = await amqp.connect(AMQP_URL!);

      connection.on("error", (err) => {
        logger.error({ err, service: "rabbitmq" }, "RabbitMQ connection error");
        connection = null;
        channel = null;
        connectionPromise = null;
      });

      connection.on("close", () => {
        logger.warn(
          { service: "rabbitmq", retryDelayMs: 5000 },
          "RabbitMQ connection closed. Reconnecting..."
        );
        connection = null;
        channel = null;
        connectionPromise = null;
        
        setTimeout(() => {
          connectRabbitMQ().catch((err) =>
            logger.error({ err, service: "rabbitmq" }, "Reconnection attempt failed")
          );
        }, 5000);
      });

      channel = await connection.createChannel();
      await channel.assertQueue("analytics_queue", { durable: true });

      logger.info({ service: "rabbitmq" }, "Connected to RabbitMQ");
      return channel;
    } catch (error) {
      if (connection) {
        await connection.close().catch(() => {});
        connection = null;
      }
      connectionPromise = null;
      
      logger.fatal({ err: error, service: "rabbitmq" }, "Error connecting to RabbitMQ");
      throw error;
    }
  })();

  return connectionPromise;
};