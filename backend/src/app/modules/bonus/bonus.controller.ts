import { Request, Response } from "express";
import {
  calculateRiskTrend,
  predictRiskProbability,
  parseNaturalLanguageReport,
} from "./bonus.service.js";

export async function handleGetRiskTrend(req: Request, res: Response) {
  try {
    const { zone_id } = req.params;
    const trend = await calculateRiskTrend(zone_id);
    return res.json(trend);
  } catch (error: any) {
    return res.status(500).json({ error: "server_error", detail: error.message });
  }
}

export async function handleGetMLPrediction(req: Request, res: Response) {
  try {
    const { zone_id } = req.params;
    const prediction = await predictRiskProbability(zone_id);
    return res.json(prediction);
  } catch (error: any) {
    return res.status(500).json({ error: "server_error", detail: error.message });
  }
}

export async function handleNLReport(req: Request, res: Response) {
  try {
    const { text } = req.body;
    if (!text || typeof text !== "string") {
      return res.status(400).json({ error: "invalid_input", detail: "Text field is required" });
    }
    const result = await parseNaturalLanguageReport(text);
    return res.json(result);
  } catch (error: any) {
    return res.status(500).json({ error: "server_error", detail: error.message });
  }
}
