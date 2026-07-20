import { google } from "googleapis";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar",
];

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

/**
 * Get the URL to redirect the user to Google OAuth consent screen.
 * @returns {string} Authorization URL
 */
export function getAuthUrl() {
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
    state: "mentorque_dev",
  });
}

/**
 * Get the shared OAuth2 client (use after setCredentials in callback).
 * @returns {import("googleapis").auth.OAuth2Client}
 */
export function getOAuthClient() {
  return oauth2Client;
}

/**
 * Set credentials on the shared OAuth2 client (e.g. after exchanging code in callback).
 * @param {import("googleapis").Credentials} tokens
 */
export function setCredentials(tokens) {
  oauth2Client.setCredentials(tokens);
}
