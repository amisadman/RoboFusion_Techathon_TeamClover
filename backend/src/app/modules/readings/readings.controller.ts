import { Request, Response } from "express";
import { processReading } from "./readings.service.js";
import { sendResponse } from "../../utils/sendResponse.js";

export async function handlePostReading(req: Request, res: Response) {
  try {
    const result = await processReading(req.body);
    return sendResponse(res, 200, true, "Reading ingested successfully", result);
  } catch (error: any) {
    console.error("Error processing reading:", error);
    return sendResponse(res, 400, false, error.message || "Failed to process reading", {
      accepted: false,
      error: "server_error",
      field: "payload",
    });
  }
}
