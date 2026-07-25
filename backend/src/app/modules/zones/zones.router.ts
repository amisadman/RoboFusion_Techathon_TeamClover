import { Router } from "express";
import { handleGetZones, handleZoneOverride } from "./zones.controller.js";
import { requireSession, requireAdmin } from "../../middlewares/auth.middleware.js";

const router = Router();

router.get("/zones", requireSession, handleGetZones);
router.post("/zones/:id/override", requireSession, requireAdmin, handleZoneOverride);

export default router;
