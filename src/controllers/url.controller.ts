import { NextFunction, Request, Response } from "express";
import { nanoid } from "nanoid";
import * as urlService from "../services/url.service";
import { CreateUrlInput } from "../types/url.types";
import { connectRabbitMQ } from "../config/rabbitmq";

export const shortenUrl = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    // The longUrl has been validated by zod
    const body = req.body as CreateUrlInput;

    const longUrl = body.longUrl;

    const newUrl = await urlService.createShortUrl(longUrl);

    const baseUrl =
      process.env.NODE_ENV === "production"
        ? process.env.SHORTENER_URL
        : process.env.BASE_URL || "http://localhost:3000";
    // const baseUrl = process.env.BASE_URL || "http://localhost:3000";
    const fullShortUrl = `${baseUrl}/${newUrl.shortCode}`;

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

    console.log("Short code received for redirection: ", shortCode);
    const urlRecord = await urlService.getUrlByShortCode(shortCode);

    if (!urlRecord?.longUrl) {
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

    // Push to RabbitMQ;
    try {
      const channel = await connectRabbitMQ();
      channel.sendToQueue(
        "analytics_queue",
        Buffer.from(JSON.stringify(analyticsPayload)),
        { persistent: true },
      );
    } catch (mqError) {
      console.error("Failed to send analytics data to RabbitMQ:", mqError);
    }

    res.redirect(urlRecord.longUrl);
  } catch (error) {
    console.log("An error happened: ", error);
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

    return res.status(200).json({
      status: "success",
      message: "URL removed successfully",
    });
  } catch (error) {
    next(error);
  }
};
