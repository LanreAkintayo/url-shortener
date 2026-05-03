import { Request, Response, NextFunction } from "express";
import { ZodError, ZodType } from "zod";

export const validate =
  (schema: ZodType) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });

      return next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errorMessages = error.issues.map((issue) => ({
          field: issue.path[1] || "root",
          message: issue.message,
        }));

        return res.status(400).json({
          status: "error",
          message: "Validation failed",
          errors: errorMessages,
        });
      }

      return next(error);
    }
  };
