import { User, Session } from "../generated/prisma/client.js";

declare global {
  namespace Express {
    interface Request {
      user?: User & { role: string };
      session?: Session;
    }
  }
}
