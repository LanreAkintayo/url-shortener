import { Request, Response, NextFunction } from "express";

interface AppError extends Error {
  statusCode: number;
}

export const errorHandler = (
  error: AppError,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const statusCode = error.statusCode || 500;
  const message = error.message || "Internal Server Error";

  if (process.env.NODE_ENV !== "production") {
    console.error(`[Error] ${req.method} ${req.originalUrl} - ${message}`);
    console.error(error.stack);
  } else {
    console.error(`[Error] ${req.method} ${req.originalUrl} - ${message}`);
  }

    res.status(statusCode).json({
        status: "error",
        message,
        ...(process.env.NODE_ENV !== "production" && { stack: error.stack }),
    })
};
