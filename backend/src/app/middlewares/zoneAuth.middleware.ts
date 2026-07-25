import { Request, Response, NextFunction } from "express";
import { prisma } from "../config/prisma.js";

// In-memory zone key cache to avoid DB lookup on every 500ms sensor post
const zoneKeyCache: Record<string, string> = {}; // key -> zoneId

export async function validateZoneKey(req: Request, res: Response, next: NextFunction) {
  const zoneKey = req.headers["x-zone-key"] as string | undefined;

  if (!zoneKey) {
    return res.status(401).json({
      accepted: false,
      error: "unauthorized",
      detail: "Missing X-Zone-Key header",
      field: "x-zone-key",
    });
  }

  // Check cache first
  if (zoneKeyCache[zoneKey]) {
    return next();
  }

  // Check database
  const zone = await prisma.zone.findUnique({
    where: { apiKey: zoneKey },
  });

  if (!zone || zone.archived) {
    return res.status(401).json({
      accepted: false,
      error: "unauthorized",
      detail: "Invalid or archived X-Zone-Key",
      field: "x-zone-key",
    });
  }

  // Cache valid key
  zoneKeyCache[zoneKey] = zone.id;
  next();
}

export function invalidateZoneKeyCache(apiKey?: string) {
  if (apiKey) delete zoneKeyCache[apiKey];
  else Object.keys(zoneKeyCache).forEach((k) => delete zoneKeyCache[k]);
}
