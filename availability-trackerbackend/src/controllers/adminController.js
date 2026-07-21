import bcrypt from "bcryptjs";
import { DateTime } from "luxon";
import { prisma } from "../lib/prisma.js";
import { getWeekStart } from "../utils/time.js";
import { loadWeeklyAvailability, isAvailableBetween } from "../services/availabilityWeek.js";
import { v4 as uuidv4 } from "uuid";
import { isPastTime } from "../utils/time.js";
import { createCalendarEventWithMeet } from "../services/googleCalendar.js";
import { ChatGoogle } from "@langchain/google";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { z } from "zod";

export async function listUsers(req, res, next) {
  try {
    const users = await prisma.user.findMany({
      where: { role: "USER" },
      select: {
        id: true,
        name: true,
        email: true,
        timezone: true,
        description: true,
        tags: true,
        createdAt: true,
        requests: {
          where: { status: "PENDING" },
          orderBy: { createdAt: "desc" },
          take: 1
        },
        meetingsAsUser: {
          where: { endTime: { gt: new Date() } },
          select: { id: true, startTime: true, endTime: true, status: true, title: true, callType: true, cancelledBy: true, cancelledAt: true, mentor: { select: { name: true } } }
        },
        availabilityAsUser: {
          where: { startTime: { gt: new Date() } },
          take: 1,
          select: { id: true }
        }
      },
      orderBy: { name: "asc" },
    });

    const now = Date.now();
    const mappedUsers = await Promise.all(users.map(async u => {
      let hasFutureAvailability = false;
      if (u.requests.length > 0) {
        const owner = { userId: u.id, mentorId: null, role: "USER" };
        const avail = await loadWeeklyAvailability(owner, undefined, "week");
        outer: for (const date in avail.availability) {
          for (const slot of avail.availability[date]) {
            if (new Date(slot.startTime).getTime() > now) {
              hasFutureAvailability = true;
              break outer;
            }
          }
        }
      }

      return {
        ...u,
        requirementType: u.requests.length > 0 ? u.requests[0].requirementType : null,
        requirementDesc: u.requests.length > 0 ? u.requests[0].requirementDesc : null,
        activeRequestId: u.requests.length > 0 ? u.requests[0].id : null,
        hasFutureAvailability,
        requests: undefined,
        availabilityAsUser: undefined
      };
    }));

    res.json(mappedUsers);
  } catch (e) {
    next(e);
  }
}

export async function listMentors(req, res, next) {
  try {
    const mentors = await prisma.user.findMany({
      where: { role: "MENTOR" },
      select: { id: true, name: true, email: true, timezone: true, description: true, tags: true, createdAt: true },
      orderBy: { name: "asc" },
    });
    res.json(mentors);
  } catch (e) {
    next(e);
  }
}

export async function createUser(req, res, next) {
  try {
    const { name, email, password, role } = req.body;
    if (!email?.trim() || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }
    if (!role || !["USER", "MENTOR"].includes(role)) {
      return res.status(400).json({ error: "Role must be USER or MENTOR" });
    }
    const existing = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });
    if (existing) {
      return res.status(409).json({ error: "Email already registered" });
    }
    const displayName = name?.trim() || email.trim().split("@")[0] || "User";
    const hashed = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        id: uuidv4(),
        name: displayName,
        email: email.trim().toLowerCase(),
        password: hashed,
        role,
        timezone: "UTC",
      },
      select: { id: true, name: true, email: true, role: true, timezone: true, createdAt: true },
    });
    res.status(201).json(user);
  } catch (e) {
    next(e);
  }
}

export async function getAvailabilityForUser(req, res, next) {
  try {
    const { userId } = req.params;
    const { weekStart } = req.query;

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const owner =
      user.role === "MENTOR"
        ? { userId: null, mentorId: userId, role: "MENTOR" }
        : { userId, mentorId: null, role: "USER" };

    const weekStartDate = weekStart ? new Date(weekStart) : getWeekStart(new Date());
    weekStartDate.setUTCHours(0, 0, 0, 0);

    const result = await loadWeeklyAvailability(owner, weekStartDate);
    res.json(result);
  } catch (e) {
    next(e);
  }
}

function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

export async function getOverlappingSlots(req, res, next) {
  try {
    const { userId } = req.params;
    const { startTime, endTime } = req.query;
    if (!startTime || !endTime) {
      return res.status(400).json({ error: "startTime and endTime required" });
    }

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const owner =
      user.role === "MENTOR"
        ? { userId: null, mentorId: userId, role: "MENTOR" }
        : { userId, mentorId: null, role: "USER" };

    const available = await isAvailableBetween(owner, startTime, endTime);
    res.json(available ? [{ userId, startTime, endTime }] : []);
  } catch (e) {
    next(e);
  }
}

export async function scheduleMeeting(req, res, next) {
  try {
    const adminId = req.userId;
    const { title, startTime, endTime, date, timezone, participantEmails, bookedUserId, bookedMentorId, callType, what, description, requestId } = req.body;

    if (!title?.trim()) {
      return res.status(400).json({ error: "title is required" });
    }

    let start;
    let end;
    /** IANA timezone for Google Calendar (e.g. "Asia/Kolkata" or "UTC"). DB always stores UTC. */
    let requestTimezone = "UTC";

    if (date && timezone && typeof startTime === "string" && typeof endTime === "string" && /^\d{2}:\d{2}$/.test(startTime) && /^\d{2}:\d{2}$/.test(endTime)) {
      const startDt = DateTime.fromFormat(`${date} ${startTime}`, "dd-MM-yyyy HH:mm", { zone: timezone });
      const endDt = DateTime.fromFormat(`${date} ${endTime}`, "dd-MM-yyyy HH:mm", { zone: timezone });
      if (!startDt.isValid || !endDt.isValid) {
        return res.status(400).json({ error: "Invalid date or time. Use dd-MM-yyyy and HH:mm in the selected timezone." });
      }
      start = startDt.toJSDate();
      end = endDt.toJSDate();
      requestTimezone = timezone;
    } else if (startTime && endTime) {
      start = new Date(startTime);
      end = new Date(endTime);
    } else {
      return res.status(400).json({ error: "startTime and endTime are required (or date, startTime, endTime, timezone)." });
    }

    if (start >= end) {
      return res.status(400).json({ error: "endTime must be after startTime" });
    }
    if (isPastTime(start)) {
      return res.status(400).json({ error: "Cannot schedule meeting in the past" });
    }

    const emails = Array.isArray(participantEmails)
      ? participantEmails.map((e) => (typeof e === "string" ? e.trim() : "")).filter(Boolean)
      : [];

    // Create meeting in DB first (meetLink null if Google not connected or fails).
    const meeting = await prisma.meeting.create({
      data: {
        id: uuidv4(),
        adminId,
        title: title.trim(),
        startTime: start,
        endTime: end,
        bookedUserId: bookedUserId || null,
        bookedMentorId: bookedMentorId || null,
        callType: callType || null,
        requestId: requestId || null,
        what: what || null,
        description: description || null,
        meetLink: null,
        calendarEventId: null,
        googleEventId: null,
      },
    });

    if (bookedUserId) {
      await prisma.mentoringRequest.updateMany({
        where: { userId: bookedUserId, status: "PENDING" },
        data: { status: "SCHEDULED" }
      }).catch(err => console.error("Failed to update request status:", err));
    }

    if (emails.length > 0) {
      await prisma.meetingParticipant.createMany({
        data: emails.map((email) => ({
          id: uuidv4(),
          meetingId: meeting.id,
          email,
        })),
        skipDuplicates: true,
      });
    }

    // Create Google Calendar event + Meet link using GOOGLE_REFRESH_TOKEN from .env (do not break meeting creation if this fails).
    let meetLink = null;
    let googleEventId = null;
    try {
      const created = await createCalendarEventWithMeet({
        title: title.trim(),
        startTime: start,
        endTime: end,
        attendeeEmails: emails,
        timezone: requestTimezone,
      });
      meetLink = created.meetLink ?? null;
      googleEventId = created.eventId ?? null;
    } catch (err) {
      console.error("[scheduleMeeting] Google Calendar/Meet API failed. Meet link will be generated automatically.", err?.message || err);
    }

    if (!meetLink) {
      // Mock for testing when Google API is not configured
      const uuidPart = uuidv4().replace(/-/g, "");
      meetLink = `https://meet.google.com/${uuidPart.substring(0, 3)}-${uuidPart.substring(3, 7)}-${uuidPart.substring(7, 10)}`;
    }

    await prisma.meeting.update({
      where: { id: meeting.id },
      data: {
        meetLink,
        ...(googleEventId && { googleEventId, calendarEventId: googleEventId }),
      },
    });

    const withParticipants = await prisma.meeting.findUnique({
      where: { id: meeting.id },
      include: { participants: true },
    });

    res.status(201).json({ ...withParticipants, meetLink: withParticipants.meetLink ?? meetLink });
  } catch (e) {
    next(e);
  }
}

export async function recommendMentors(req, res, next) {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        tags: true,
        requests: {
          where: { status: "PENDING" },
          take: 1,
          orderBy: { createdAt: "desc" }
        }
      },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const mentors = await prisma.user.findMany({
      where: { role: "MENTOR" },
      select: { id: true, name: true, tags: true, description: true },
    });

    if (mentors.length === 0) {
      return res.json({ recommendations: [], allMentors: [] });
    }

    const llm = new ChatGoogle({
      model: "gemini-2.5-flash",
      apiKey: process.env.GEMINI_API_KEY,
    });

    const recommendationsSchema = z.object({
      recommendations: z.array(
        z.object({
          mentorId: z.string().describe("The ID of the recommended mentor"),
          score: z.number().describe("Match score out of 100"),
          reason: z.array(z.string()).describe("List of short reasons for the recommendation (max 5 words per reason)"),
        })
      ).describe("List of recommended mentors ranked from highest score to lowest"),
    });

    const structuredLLM = llm.withStructuredOutput(recommendationsSchema);

    const prompt = ChatPromptTemplate.fromMessages([
      [
        "system",
        `You are an AI mentor recommendation engine.
Your task is to recommend the best mentors for a user.
Consider: Call Type, User Description, User Tags, Mentor Description, Mentor Tags.
Ranking priority:
- Resume Revamp: Big Tech, Hiring experience, Resume reviews.
- Mock Interview: Same technical domain, Interview experience.
- Job Market Guidance: Communication, Career guidance.
Return ONLY valid JSON matching the exact schema. Score should be a number from 0 to 100.
`,
      ],
      [
        "human",
        `User Details:
Call Type: {callType}
Description: {userDesc}
Tags: {userTags}

Available Mentors:
{mentorsList}
`,
      ],
    ]);

    const chain = prompt.pipe(structuredLLM);

    const mentorsListString = mentors
      .map(
        (m) =>
          `ID: ${m.id}\nName: ${m.name}\nTags: ${m.tags.join(", ")}\nDescription: ${m.description || "N/A"}\n---`
      )
      .join("\n");

    const activeReq = user.requests && user.requests.length > 0 ? user.requests[0] : null;

    const result = await chain.invoke({
      callType: activeReq?.requirementType || "General Mentoring",
      userDesc: activeReq?.requirementDesc || "No description provided",
      userTags: user.tags.join(", ") || "None",
      mentorsList: mentorsListString,
    });

    res.json({
      recommendations: result.recommendations,
      allMentors: mentors,
    });
  } catch (e) {
    next(e);
  }
}
