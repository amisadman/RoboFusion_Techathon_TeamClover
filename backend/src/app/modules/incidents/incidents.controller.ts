import { Request, Response } from "express";
import { getHistoricalIncidents, acknowledgeIncident } from "./incidents.service.js";
import { sendResponse } from "../../utils/sendResponse.js";

export async function handleGetIncidents(req: Request, res: Response) {
  try {
    const { from, to, zone_id, status } = req.query;

    const incidents = await getHistoricalIncidents({
      from: from as string,
      to: to as string,
      zoneId: zone_id as string,
      status: status as string,
    });

    return sendResponse(res, 200, true, "Historical incidents retrieved successfully", incidents);
  } catch (error: any) {
    return sendResponse(res, 500, false, "Failed to retrieve historical incidents", { error: error.message });
  }
}

export async function handleAckIncident(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const userId = req.user?.id || "staff";

    const result = await acknowledgeIncident(id, userId);

    if (!result.success) {
      return sendResponse(res, result.statusCode, false, result.detail, {
        error: result.error,
      });
    }

    return sendResponse(res, 200, true, "Incident acknowledged successfully", result);
  } catch (error: any) {
    return sendResponse(res, 500, false, "Failed to acknowledge incident", { error: error.message });
  }
}
