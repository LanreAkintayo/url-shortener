import { NextFunction, Request, Response } from "express";
import { nanoid } from "nanoid";
import { pool } from "../config/db";
import * as urlService from "../services/url.service";
import { CreateUrlInput } from "../types/url.types";

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

    const baseUrl = process.env.BASE_URL || "http://localhost:3000/api";
    const fullShortUrl = `${baseUrl}/${newUrl.short_code}`;

    res.status(201).json({
      status: "success",
      message: "URL shortened successfully",
      data: {
        id: newUrl.id,
        longUrl: newUrl.long_url,
        shortUrl: fullShortUrl,
        createdAt: newUrl.created_at,
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

    const urlRecord = await urlService.getUrlByShortCode(shortCode);

    if (!urlRecord) {
      res.status(404).json({
        status: "error",
        message: "URL not found",
      });
      return;
    }

    // This sends a 301 Permanent Redirect where the long_url gets stored in the browser cache.
    // res.redirect(301, urlRecord.long_url);

    console.log("About to redirect to: ", urlRecord.long_url);

    res.redirect(urlRecord.long_url);
  } catch (error) {
    console.log(
        "An error happened: ", error
    )
    next(error);
  }
};
