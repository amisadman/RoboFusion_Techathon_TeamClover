import { Request, Response } from "express";
import { processReading, getPriorityQueue } from "./readings.service.js";
import { sendResponse } from "../../utils/sendResponse.js";

export async function handlePostReading(req: Request, res: Response) {
  try {
    // The X-Zone-Key only proves the caller holds SOME valid zone's key --
    // without this check, a key copy-pasted onto the wrong device would
    // silently authenticate as (and be able to mutate) a different zone's
    // data. req.zoneId is set by validateZoneKey (zoneAuth.middleware.ts).
    if (req.body.zone_id !== req.zoneId) {
      console.warn(
        `⚠️ [ZoneAuth Reject] X-Zone-Key belongs to '${req.zoneId}' but payload claims zone_id '${req.body.zone_id}'`
      );
      return sendResponse(res, 401, false, "X-Zone-Key does not match zone_id", {
        accepted: false,
        error: "unauthorized",
        field: "zone_id",
        detail: "X-Zone-Key does not match zone_id",
      });
    }

    const result = await processReading(req.body);
    console.log(`✅ [Readings Success] Ingested seq ${result.server_seq_ack} for zone '${req.body.zone_id}', state: ${result.state}, riskScore: ${result.risk_score}`);
    return sendResponse(res, 200, true, "Reading ingested successfully", result);
  } catch (error: any) {
    console.error("❌ [Readings Error] Error processing reading:", error);
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
