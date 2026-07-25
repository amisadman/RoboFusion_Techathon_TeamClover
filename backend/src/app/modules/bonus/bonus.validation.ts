import { z } from "zod";

export const nlReportSchema = z.object({
  text: z.string().min(3, "Text report must be at least 3 characters long"),
});
