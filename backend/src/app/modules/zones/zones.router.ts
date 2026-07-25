import { Router } from "express";
import { handleGetZones, handleZoneOverride } from "./zones.controller.js";
import { requireSession, requireAdmin } from "../../middlewares/auth.middleware.js";
import { validateBody } from "../../middlewares/validateRequest.middleware.js";
import { zoneOverrideSchema } from "./zones.validation.js";

const router = Router();

router.get("/zones", requireSession, handleGetZones);
router.post(
  "/zones/:id/override",
  requireSession,
  requireAdmin,
  validateBody(zoneOverrideSchema),
  handleZoneOverride
);

export default router;
