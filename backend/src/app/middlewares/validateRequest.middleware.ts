import { Request, Response, NextFunction } from "express";
import { ZodSchema, ZodError } from "zod";
import { sendResponse } from "../utils/sendResponse.js";

export function validateBody(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error: any) {
      if (error instanceof ZodError) {
        const firstIssue = error.issues[0];
        const fieldName = firstIssue.path.join(".") || "body";
        console.error(`⚠️ [Validation Reject] ${req.path} -> ${fieldName}: ${firstIssue.message}`);
        return sendResponse(res, 400, false, `${fieldName}: ${firstIssue.message}`, {
          accepted: false,
          error: "invalid_payload",
          field: fieldName,
        });
      }
      console.error(`⚠️ [Validation Reject] ${req.path} -> Malformed JSON payload`);
      return sendResponse(res, 400, false, "Malformed payload", {
        accepted: false,
        error: "invalid_payload",
        field: "body",
      });
    }
  };
}
