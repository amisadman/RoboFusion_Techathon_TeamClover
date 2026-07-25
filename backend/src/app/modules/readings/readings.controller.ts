import { Request, Response } from "express";
import { processReading, getPriorityQueue } from "./readings.service.js";
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

export async function handleGetPriority(_req: Request, res: Response) {
  try {
    const priorityQueue = getPriorityQueue();
    return sendResponse(res, 200, true, "Priority queue retrieved successfully", { ranked: priorityQueue });
  } catch (error: any) {
    return sendResponse(res, 500, false, "Failed to retrieve priority queue", { error: error.message });
  }
}
