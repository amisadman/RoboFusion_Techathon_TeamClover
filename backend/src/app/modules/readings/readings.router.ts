import { Router } from "express";
import { handlePostReading, handleGetPriority } from "./readings.controller.js";
import { validateZoneKey } from "../../middlewares/zoneAuth.middleware.js";
import { validateBody } from "../../middlewares/validateRequest.middleware.js";
import { requireSession } from "../../middlewares/auth.middleware.js";
import { readingPayloadSchema } from "./readings.validation.js";

const router = Router();

router.post(
  "/readings",
  validateZoneKey,
  validateBody(readingPayloadSchema),
  handlePostReading
);
router.get("/priority", requireSession, handleGetPriority);

export default router;
