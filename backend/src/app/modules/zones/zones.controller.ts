import { Request, Response } from "express";
import { getAllZonesState, applyAdminOverride, getZoneApiKey, createZone } from "./zones.service.js";
import { sendResponse } from "../../utils/sendResponse.js";

export async function handleGetZones(_req: Request, res: Response) {
  try {
    const zones = await getAllZonesState();
    return sendResponse(res, 200, true, "Zones retrieved successfully", zones);
  } catch (error: any) {
    return sendResponse(res, 500, false, "Failed to retrieve zones", { error: error.message });
  }
}

export async function handleCreateZone(req: Request, res: Response) {
  try {
    const zone = await createZone(req.body);
    return sendResponse(res, 201, true, "Zone created successfully", zone);
  } catch (error: any) {
    return sendResponse(res, 400, false, error.message || "Failed to create zone", { error: "create_failed" });
  }
}

export async function handleGetZoneApiKey(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const keyData = await getZoneApiKey(id);
    return sendResponse(res, 200, true, "Zone API key retrieved successfully", keyData);
  } catch (error: any) {
    return sendResponse(res, 404, false, error.message || "Zone API key not found", { error: "not_found" });
  }
}

export async function handleZoneOverride(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { state } = req.body;
    const adminUserId = req.user?.id || "admin";

    const result = await applyAdminOverride(id, state, adminUserId);
    return sendResponse(res, 200, true, "Zone override applied successfully", result);
  } catch (error: any) {
    return sendResponse(res, 400, false, error.message || "Zone override failed", { error: "override_failed" });
  }
}
