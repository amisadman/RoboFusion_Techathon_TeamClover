import { Request, Response } from "express";
import { prisma } from "../../config/prisma.js";

export async function getHealth(_req: Request, res: Response) {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: "ok",
      database: "connected",
      time: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      database: "disconnected",
      time: new Date().toISOString(),
    });
  }
}
