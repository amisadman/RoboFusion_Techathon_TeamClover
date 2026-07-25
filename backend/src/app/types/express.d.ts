import { User, Session } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      user?: User & { role: string };
      session?: Session;
    }
  }
}
