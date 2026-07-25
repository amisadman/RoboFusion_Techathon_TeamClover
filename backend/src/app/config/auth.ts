import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./prisma.js";

const isProd = process.env.NODE_ENV === "production";

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),

  // Vercel frontend origin. Without this, cross-origin requests from the
  // dashboard get rejected before they reach your route handlers.
  trustedOrigins: [process.env.FRONTEND_URL || "http://localhost:3000"],

  emailAndPassword: { enabled: true },

  // role drives requireAdmin() in auth.middleware.ts — see contract.md.
  user: {
    additionalFields: {
      role: { type: "string", input: false, defaultValue: "staff" },
    },
  },

  // sameSite:"none" is only valid with secure:true, and secure cookies
  // require HTTPS — which localhost isn't. Only apply this in prod, or
  // local login will silently fail.
  advanced: isProd
    ? { defaultCookieAttributes: { sameSite: "none", secure: true } }
    : {},
});
