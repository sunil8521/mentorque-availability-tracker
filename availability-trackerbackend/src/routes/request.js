import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import {
  createRequest,
  getMyRequests,
  cancelRequest
} from "../controllers/requestController.js";

const router = Router();

router.use(authenticate);

router.post("/", createRequest);
router.get("/me", getMyRequests);
router.patch("/:id/cancel", cancelRequest);

export default router;
