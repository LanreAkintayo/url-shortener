import { NextFunction, Request, Response } from "express";
import { nanoid } from "nanoid";
import * as urlService from "../services/url.service";
import { CreateUrlInput } from "../types/url.types";
import { connectRabbitMQ } from "../config/rabbitmq";
import { getShardId } from "../config/db";
import { logger } from "../utils/logger";

export const shortenUrl = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const body = req.body as CreateUrlInput;

    const longUrl = body.longUrl;

    const newUrl = await urlService.createShortUrl(longUrl);

    const baseUrl =
      process.env.NODE_ENV === "production"
        ? process.env.SHORTENER_URL
        : process.env.BASE_URL || "http://localhost:8080";
        
    const fullShortUrl = `${baseUrl}/${newUrl.shortCode}`;

    logger.info(
      { shortUrl: fullShortUrl, action: "shorten_url", service: "api" },
      "URL shortened successfully",
    );

    res.status(201).json({
      status: "success",
      message: "URL shortened successfully",
      data: {
        id: newUrl.id,
        longUrl: newUrl.longUrl,
        shortUrl: fullShortUrl,
        createdAt: newUrl.createdAt,
      },
    });
  } catch (error) {
    logger.error(
      { err: error, action: "shorten_url", service: "api" },
      "Failed to shorten URL",
    );
    next(error);
  }
};

export const redirectUrl = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { shortCode } = req.params;

    logger.debug(
      { shortCode, service: "api" },
      "Short code received for redirection",
    );

    const urlRecord = await urlService.getUrlByShortCode(shortCode);

    if (!urlRecord?.longUrl) {
      logger.warn(
        { shortCode, action: "redirect_not_found", service: "api" },
        "URL not found",
      );

      res.status(404).json({
        status: "error",
        message: "URL not found",
      });
      return;
    }

    const analyticsPayload = {
      shortCode,
      ipAddress: req.ip || "0.0.0.0",
      userAgent: req.headers["user-agent"] || "Unknown",
      referrer: req.headers["referer"] || req.headers["referrer"] || "direct",
      timestamp: new Date().toISOString(),
    };

    try {
      const targetShardId = getShardId(shortCode as unknown as string);
      const queueName = `analytics_queue_${targetShardId}`;
      const channel = await connectRabbitMQ();

      await channel.assertQueue(queueName, { durable: true });

      channel.sendToQueue(
        queueName,
        Buffer.from(JSON.stringify(analyticsPayload)),
        { persistent: true },
      );
    } catch (mqError) {
      logger.error(
        { err: mqError, shortCode, service: "api" },
        "Failed to send analytics data to RabbitMQ",
      );
    }

    res.redirect(urlRecord.longUrl);
  } catch (error) {
    logger.error(
      { err: error, shortCode: req.params.shortCode, service: "api" },
      "Fatal error during redirection",
    );
    next(error);
  }
};

export const updateUrl = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { shortCode } = req.params;
    const { longUrl } = req.body as CreateUrlInput;

    const updatedUrl = await urlService.updateOriginalUrl(shortCode, longUrl);

    logger.info(
      { shortCode, action: "update_url", service: "api" },
      "URL updated successfully",
    );

    return res.status(200).json({
      status: "success",
      message: "URL updated successfully",
      data: {
        id: updatedUrl.id,
        longUrl: updatedUrl.longUrl,
        shortCode: updatedUrl.shortCode,
        createdAt: updatedUrl.createdAt,
      },
    });
  } catch (error) {
    logger.error(
      {
        err: error,
        shortCode: req.params.shortCode,
        action: "update_url",
        service: "api",
      },
      "Failed to update URL",
    );
    next(error);
  }
};

export const removeUrl = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { shortCode } = req.params;

    await urlService.deleteUrl(shortCode);

    logger.info(
      { shortCode, action: "remove_url", service: "api" },
      "URL removed successfully"
    );

    return res.status(200).json({
      status: "success",
      message: "URL removed successfully",
    });
  } catch (error) {
    logger.error(
      {
        err: error,
        shortCode: req.params.shortCode,
        action: "remove_url",
        service: "api",
      },
      "Failed to remove URL",
    );
    next(error);
  }
};