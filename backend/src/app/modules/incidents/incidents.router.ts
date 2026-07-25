import { Router } from "express";
import { handleGetIncidents, handleGetIncidentById, handleAckIncident } from "./incidents.controller.js";
import { requireSession } from "../../middlewares/auth.middleware.js";

const router = Router();

router.get("/incidents", requireSession, handleGetIncidents);
router.get("/incidents/:id", requireSession, handleGetIncidentById);
router.post("/incidents/:id/ack", requireSession, handleAckIncident);

export default router;
