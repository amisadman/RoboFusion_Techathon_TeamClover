import { Router } from "express";
import { z } from "zod";
import { handlePostReading } from "./readings.controller.js";
import { validateZoneKey } from "../../middlewares/zoneAuth.middleware.js";
import { validateBody } from "../../middlewares/validateRequest.middleware.js";

const readingPayloadSchema = z.object({
  zone_id: z.string().min(1),
  seq: z.number().int(),
  timestamp_ms: z.number(),
  sensors: z.object({
    flame_raw: z.number().min(0, "flame_raw must be >= 0"),
    gas_raw: z.number().min(0, "gas_raw must be >= 0"),
    water_raw: z.number().min(0, "water_raw must be >= 0"),
    motion: z.boolean(),
  }),
  sensor_health: z.object({
    flame: z.enum(["ok", "disconnected"]),
    gas: z.enum(["ok", "disconnected"]),
    water: z.enum(["ok", "disconnected"]),
    motion: z.enum(["ok", "disconnected"]),
  }),
});

const router = Router();

router.post(
  "/readings",
  validateZoneKey,
  validateBody(readingPayloadSchema),
  handlePostReading
);

export default router;
