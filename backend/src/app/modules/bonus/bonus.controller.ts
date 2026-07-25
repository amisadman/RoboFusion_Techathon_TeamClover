import { Request, Response } from "express";
import {
  calculateRiskTrend,
  predictRiskProbability,
  parseNaturalLanguageReport,
} from "./bonus.service.js";
import { sendResponse } from "../../utils/sendResponse.js";

export async function handleGetRiskTrend(req: Request, res: Response) {
  try {
    const { zone_id } = req.params;
    const trend = await calculateRiskTrend(zone_id);
    return sendResponse(res, 200, true, "Risk trend calculated successfully", trend);
  } catch (error: any) {
    return sendResponse(res, 500, false, "Failed to calculate risk trend", { error: error.message });
  }
}

export async function handleGetMLPrediction(req: Request, res: Response) {
  try {
    const { zone_id } = req.params;
    const prediction = await predictRiskProbability(zone_id);
    return sendResponse(res, 200, true, "ML risk prediction calculated successfully", prediction);
  } catch (error: any) {
    return sendResponse(res, 500, false, "Failed to calculate ML risk prediction", { error: error.message });
  }
}

export async function handleNLReport(req: Request, res: Response) {
  try {
    const { text } = req.body;
    const result = await parseNaturalLanguageReport(text);
    return sendResponse(res, 200, true, "Natural language report parsed successfully", result);
  } catch (error: any) {
    return sendResponse(res, 500, false, "Failed to parse natural language report", { error: error.message });
  }
}
