import { Router } from "express";
import {
  handleGetRiskTrend,
  handleGetMLPrediction,
  handleNLReport,
} from "./bonus.controller.js";
import { requireSession } from "../../middlewares/auth.middleware.js";
import { validateBody } from "../../middlewares/validateRequest.middleware.js";
import { nlReportSchema } from "./bonus.validation.js";

const router = Router();

router.get("/bonus/trend/:zone_id", requireSession, handleGetRiskTrend);
router.get("/bonus/ml-predict/:zone_id", requireSession, handleGetMLPrediction);
router.post("/bonus/nl-report", requireSession, validateBody(nlReportSchema), handleNLReport);

export default router;
