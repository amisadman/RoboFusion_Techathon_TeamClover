import { z } from "zod";

export const readingPayloadSchema = z.object({
  zone_id: z.string().min(1, "zone_id is required"),
  seq: z.number().int("seq must be an integer"),
  timestamp_ms: z.number().positive("timestamp_ms must be positive"),
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
