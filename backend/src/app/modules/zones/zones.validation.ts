import { z } from "zod";

export const zoneOverrideSchema = z.object({
  state: z.enum(["CRITICAL", "SAFE"], {
    errorMap: () => ({ message: "State must be either CRITICAL or SAFE" }),
  }),
});
