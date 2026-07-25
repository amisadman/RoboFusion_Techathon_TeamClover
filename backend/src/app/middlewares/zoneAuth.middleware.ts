import { Request, Response, NextFunction } from "express";
import { prisma } from "../config/prisma.js";
import { sendResponse } from "../utils/sendResponse.js";

const zoneKeyCache: Record<string, string> = {};

export async function validateZoneKey(req: Request, res: Response, next: NextFunction) {
  const zoneKey = req.headers["x-zone-key"] as string | undefined;

  if (!zoneKey) {
    console.warn(`⚠️ [ZoneAuth Reject] Missing X-Zone-Key header from IP ${req.ip}`);
    return sendResponse(res, 401, false, "Missing X-Zone-Key header", {
      accepted: false,
      error: "unauthorized",
      field: "x-zone-key",
    });
  }

  if (zoneKeyCache[zoneKey]) {
    req.zoneId = zoneKeyCache[zoneKey];
    return next();
  }

  const zone = await prisma.zone.findUnique({
    where: { apiKey: zoneKey },
  });

  if (!zone || zone.archived) {
    console.warn(`⚠️ [ZoneAuth Reject] Invalid/Archived X-Zone-Key '${zoneKey}' from IP ${req.ip}`);
    return sendResponse(res, 401, false, "Invalid or archived X-Zone-Key", {
      accepted: false,
      error: "unauthorized",
      field: "x-zone-key",
    });
  }

  console.log(`✅ [ZoneAuth Success] Zone '${zone.id}' authenticated via key '${zoneKey}'`);
  zoneKeyCache[zoneKey] = zone.id;
  req.zoneId = zone.id;
  next();
}

export function invalidateZoneKeyCache(apiKey?: string) {
  if (apiKey) delete zoneKeyCache[apiKey];
  else Object.keys(zoneKeyCache).forEach((k) => delete zoneKeyCache[k]);
}
