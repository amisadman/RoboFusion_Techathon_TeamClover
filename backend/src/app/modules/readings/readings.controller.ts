import { Request, Response } from "express";
import { processReading } from "./readings.service.js";

export async function handlePostReading(req: Request, res: Response) {
  try {
    const response = await processReading(req.body);
    return res.json(response);
  } catch (error: any) {
    console.error("Error processing reading:", error);
    return res.status(400).json({
      accepted: false,
      error: "server_error",
      detail: error.message || "Failed to process reading",
      field: "payload",
    });
  }
}
