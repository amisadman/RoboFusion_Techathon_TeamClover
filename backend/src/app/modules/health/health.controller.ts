import { Request, Response } from "express";
import { prisma } from "../../config/prisma.js";
import { sendResponse } from "../../utils/sendResponse.js";

export async function getHealth(_req: Request, res: Response) {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return sendResponse(res, 200, true, "Health check status", {
      status: "ok",
      database: "connected",
      time: new Date().toISOString(),
    });
  } catch (error: any) {
    return sendResponse(res, 500, false, "Health check failed", {
      status: "error",
      database: "disconnected",
      time: new Date().toISOString(),
    });
  }
}
