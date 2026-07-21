import { Router } from "express";
import { listMeetings, deleteMeeting, cancelMeeting } from "../controllers/meetingController.js";
import { authenticate, requireRole } from "../middleware/auth.js";

export const meetingRoutes = Router();

meetingRoutes.use(authenticate);
meetingRoutes.get("/", listMeetings);
meetingRoutes.patch("/:id/cancel", cancelMeeting);
meetingRoutes.delete("/:id", requireRole("ADMIN"), deleteMeeting);
