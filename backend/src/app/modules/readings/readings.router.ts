import { Router } from "express";
import { handlePostReading } from "./readings.controller.js";
import { validateZoneKey } from "../../middlewares/zoneAuth.middleware.js";
import { validateBody } from "../../middlewares/validateRequest.middleware.js";
import { readingPayloadSchema } from "./readings.validation.js";

const router = Router();

router.post(
  "/readings",
  validateZoneKey,
  validateBody(readingPayloadSchema),
  handlePostReading
);

export default router;
