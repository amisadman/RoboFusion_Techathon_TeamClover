import { Request, Response, NextFunction } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../config/auth.js";
import { prisma } from "../config/prisma.js";
import { sendResponse } from "../utils/sendResponse.js";

export async function requireSession(req: Request, res: Response, next: NextFunction) {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (!session || !session.user) {
      return sendResponse(res, 401, false, "Valid session required", {
        error: "unauthorized",
        field: "authorization",
      });
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    req.user = (dbUser || session.user) as any;
    req.session = session.session as any;

    next();
  } catch (error: any) {
    console.error("Auth session error:", error);
    return sendResponse(res, 401, false, "Session validation failed", {
      error: "unauthorized",
      detail: error.message,
    });
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== "admin") {
    return sendResponse(res, 403, false, "Admin role required", {
      error: "forbidden",
      field: "role",
    });
  }
  next();
}
