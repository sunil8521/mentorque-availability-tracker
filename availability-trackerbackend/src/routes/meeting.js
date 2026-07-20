import { Router } from "express";
import { listMeetings, deleteMeeting } from "../controllers/meetingController.js";
import { authenticate, requireRole } from "../middleware/auth.js";

export const meetingRoutes = Router();

meetingRoutes.use(authenticate);
meetingRoutes.get("/", listMeetings);
meetingRoutes.delete("/:id", requireRole("ADMIN"), deleteMeeting);
