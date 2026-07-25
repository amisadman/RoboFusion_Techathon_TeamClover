import { Request, Response } from "express";
import { getAllZonesState, applyAdminOverride } from "./zones.service.js";

export async function handleGetZones(_req: Request, res: Response) {
  try {
    const zones = await getAllZonesState();
    return res.json(zones);
  } catch (error: any) {
    return res.status(500).json({ error: "server_error", detail: error.message });
  }
}

export async function handleZoneOverride(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { state } = req.body; // "CRITICAL" | "SAFE"
    const adminUserId = req.user?.id || "admin";

    if (!["CRITICAL", "SAFE"].includes(state)) {
      return res.status(400).json({ error: "invalid_state", detail: "State must be CRITICAL or SAFE" });
    }

    const result = await applyAdminOverride(id, state, adminUserId);
    return res.json(result);
  } catch (error: any) {
    return res.status(400).json({ error: "override_failed", detail: error.message });
  }
}
