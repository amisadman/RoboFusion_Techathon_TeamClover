import { Request, Response, NextFunction } from "express";
import { ZodSchema, ZodError } from "zod";

export function validateBody(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error: any) {
      if (error instanceof ZodError) {
        const firstIssue = error.issues[0];
        return res.status(400).json({
          accepted: false,
          error: "invalid_payload",
          detail: `${firstIssue.path.join(".")}: ${firstIssue.message}`,
          field: firstIssue.path.join(".") || "body",
        });
      }
      return res.status(400).json({
        accepted: false,
        error: "invalid_payload",
        detail: "Malformed payload",
        field: "body",
      });
    }
  };
}
