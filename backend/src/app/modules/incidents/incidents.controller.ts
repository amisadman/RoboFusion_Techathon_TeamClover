import { Request, Response } from "express";
import { getHistoricalIncidents, acknowledgeIncident } from "./incidents.service.js";

export async function handleGetIncidents(req: Request, res: Response) {
  try {
    const { from, to, zone_id, status } = req.query;

    const incidents = await getHistoricalIncidents({
      from: from as string,
      to: to as string,
      zoneId: zone_id as string,
      status: status as string,
    });

    return res.json(incidents);
  } catch (error: any) {
    return res.status(500).json({ error: "server_error", detail: error.message });
  }
}

export async function handleAckIncident(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const userId = req.user?.id || "staff";

    const result = await acknowledgeIncident(id, userId);

    if (!result.success) {
      return res.status(result.statusCode).json({
        error: result.error,
        detail: result.detail,
      });
    }

    return res.json(result);
  } catch (error: any) {
    return res.status(500).json({ error: "server_error", detail: error.message });
  }
}
