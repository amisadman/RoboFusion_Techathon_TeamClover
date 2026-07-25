import "dotenv/config";
import { startServer } from "./app/server.js";

startServer().catch((err) => {
  console.error("Fatal server initialization error:", err);
  process.exit(1);
});
