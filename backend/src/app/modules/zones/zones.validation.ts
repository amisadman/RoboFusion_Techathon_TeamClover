import { z } from "zod";

export const zoneOverrideSchema = z.object({
  state: z.enum(["CRITICAL", "SAFE"], {
    errorMap: () => ({ message: "State must be either CRITICAL or SAFE" }),
  }),
});

export const createZoneSchema = z.object({
  id: z.string().min(1, "Zone ID is required"),
  name: z.string().min(1, "Zone name is required"),
  hazardProfile: z.string().min(1, "Hazard profile is required"),
  apiKey: z.string().optional(),
});
