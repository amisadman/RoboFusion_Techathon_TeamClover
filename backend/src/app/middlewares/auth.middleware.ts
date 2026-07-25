import { Request, Response, NextFunction } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../config/auth.js";
import { prisma } from "../config/prisma.js";

export async function requireSession(req: Request, res: Response, next: NextFunction) {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (!session || !session.user) {
      return res.status(401).json({ error: "unauthorized", detail: "Valid session required" });
    }

    // Fetch full user to ensure role is populated
    const dbUser = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    req.user = (dbUser || session.user) as any;
    req.session = session.session as any;

    next();
  } catch (error) {
    console.error("Auth session error:", error);
    return res.status(401).json({ error: "unauthorized", detail: "Session validation failed" });
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ error: "forbidden", detail: "Admin role required" });
  }
  next();
}
