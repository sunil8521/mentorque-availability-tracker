import { Router } from "express";
import { register, login, me } from "../controllers/authController.js";
import { authenticate } from "../middleware/auth.js";
// DISABLED: Google OAuth routes (removed per assignment)
// import { googleOAuthRoutes } from "./googleAuth.js";

export const authRoutes = Router();

authRoutes.post("/register", register);
authRoutes.post("/login", login);
authRoutes.get("/me", authenticate, me);

// DISABLED: Google OAuth routes
// authRoutes.use(googleOAuthRoutes);
