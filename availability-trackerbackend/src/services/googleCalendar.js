import { DateTime } from "luxon";
import { google } from "googleapis";
import { v4 as uuidv4 } from "uuid";

/**
 * Create a Google Calendar event with Google Meet using env GOOGLE_REFRESH_TOKEN.
 * Returns { eventId, meetLink } or { eventId: null, meetLink: null } if token missing / API fails.
 */
export async function createCalendarEventWithMeet({ title, startTime, endTime, attendeeEmails = [], timezone = "UTC" }) {
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  if (!refreshToken) {
    console.warn("[googleCalendar] GOOGLE_REFRESH_TOKEN not set; Meet link will not be generated.");
    return { eventId: null, meetLink: null };
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  const calendar = google.calendar({ version: "v3", auth: oauth2Client });

  const startDate = new Date(startTime);
  const endDate = new Date(endTime);
  const startDateTime = DateTime.fromJSDate(startDate).setZone(timezone).toFormat("yyyy-MM-dd'T'HH:mm:ss");
  const endDateTime = DateTime.fromJSDate(endDate).setZone(timezone).toFormat("yyyy-MM-dd'T'HH:mm:ss");

  const requestBody = {
    summary: title,
    start: { dateTime: startDateTime, timeZone: timezone },
    end: { dateTime: endDateTime, timeZone: timezone },
    attendees: attendeeEmails.filter(Boolean).map((e) => ({ email: e.trim() })),
    conferenceData: {
      createRequest: {
        requestId: uuidv4(),
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    },
  };

  const { data } = await calendar.events.insert({
    calendarId: "primary",
    conferenceDataVersion: 1,
    requestBody,
    sendUpdates: "all",
  });

  const meetLink =
    data.hangoutLink ??
    data.conferenceData?.entryPoints?.[0]?.uri ??
    data.conferenceData?.entryPoints?.find((e) => e.entryPointType === "video")?.uri ??
    null;
  return { eventId: data.id ?? null, meetLink };
}
