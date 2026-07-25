import { z } from "zod";

export const incidentQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  zone_id: z.string().optional(),
  status: z.enum(["OPEN", "ACKED", "RESOLVED"]).optional(),
});
