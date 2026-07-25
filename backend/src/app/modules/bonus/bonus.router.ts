import { Router } from "express";
import {
  handleGetRiskTrend,
  handleGetMLPrediction,
  handleNLReport,
} from "./bonus.controller.js";
import { requireSession } from "../../middlewares/auth.middleware.js";

const router = Router();

router.get("/bonus/trend/:zone_id", requireSession, handleGetRiskTrend);
router.get("/bonus/ml-predict/:zone_id", requireSession, handleGetMLPrediction);
router.post("/bonus/nl-report", requireSession, handleNLReport);

export default router;
