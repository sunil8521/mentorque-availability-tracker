import { Router } from "express";
import { googleAuthInit, googleAuthCallback, googleAuthDisconnect } from "../controllers/googleAuthController.js";
import { authenticate, requireRole } from "../middleware/auth.js";

export const googleOAuthRoutes = Router();

// Init: must be called with JWT (Authorization: Bearer <token>). Returns { url }; frontend redirects user to url.
googleOAuthRoutes.get("/google", authenticate, requireRole("ADMIN"), googleAuthInit);
// Callback: no auth; Google redirects here. Saves refresh_token to User.googleRefreshToken.
googleOAuthRoutes.get("/google/callback", googleAuthCallback);
googleOAuthRoutes.post("/google/disconnect", authenticate, requireRole("ADMIN"), googleAuthDisconnect);
