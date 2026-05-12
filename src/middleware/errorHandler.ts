import { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger";

export interface AppError extends Error {
  statusCode?: number;
}

/**
 * Global error handling middleware.
 * Intercepts unhandled exceptions, logs structured error data, and formats the client response.
 */
export const errorHandler = (
  error: AppError,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const statusCode = error.statusCode || 500;
  const message = error.message || "Internal Server Error";

  logger.error(
    {
      err: error,
      method: req.method,
      url: req.originalUrl,
      statusCode,
      service: "error_handler",
    },
    "Application error intercepted"
  );

  res.status(statusCode).json({
    status: "error",
    message,
    ...(process.env.NODE_ENV !== "production" && { stack: error.stack }),
  });
};