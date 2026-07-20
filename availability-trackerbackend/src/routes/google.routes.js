import { Router } from "express";
import { getAuthUrl, getOAuthClient, setCredentials } from "../utils/googleClient.js";

export const googleRouter = Router();

/**
 * GET /api/google/auth
 * Redirect to Google OAuth consent screen.
 */
googleRouter.get("/auth", (req, res) => {
  const url = getAuthUrl();
  res.redirect(url);
});

/**
 * GET /api/google/callback
 * Exchange code for tokens, store in memory, return success message.
 */
googleRouter.get("/callback", async (req, res) => {
  const { code } = req.query;
  if (!code) {
    return res.status(400).json({ success: false, message: "Missing code" });
  }
  try {
    const oauth2Client = getOAuthClient();
    const { tokens } = await oauth2Client.getToken(code);
    setCredentials(tokens);
    res.status(200).json({
      success: true,
      message: "Google account connected successfully",
    });
  } catch (error) {
    console.error("Google callback error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to exchange code for tokens",
    });
  }
});
