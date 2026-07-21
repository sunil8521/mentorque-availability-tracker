import { prisma } from "../lib/prisma.js";

export async function listMeetings(req, res, next) {
  try {
    const { adminId, from, to } = req.query;
    const where = {};
    if (adminId) where.adminId = adminId;
    if (from) where.startTime = { ...where.startTime, gte: new Date(from) };
    if (to) where.endTime = { ...where.endTime, lte: new Date(to) };

    if (req.userRole !== "ADMIN") {
      where.OR = [
        { bookedUserId: req.userId },
        { bookedMentorId: req.userId }
      ];
    }

    const meetings = await prisma.meeting.findMany({
      where,
      include: { participants: true, user: true, mentor: true },
      orderBy: { startTime: "asc" },
    });
    res.json(meetings);
  } catch (e) {
    next(e);
  }
}

export const deleteMeeting = async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.meeting.delete({
      where: { id },
    });

    res.status(200).json({
      success: true,
      message: "Meeting deleted successfully",
    });
  } catch (error) {
    console.error("Delete meeting error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete meeting",
    });
  }
};

// simple: cancel a meeting (user or admin can cancel)
export async function cancelMeeting(req, res, next) {
  try {
    const { id } = req.params;
    const meeting = await prisma.meeting.findUnique({ where: { id } });

    if (!meeting) {
      return res.status(404).json({ error: "Meeting not found" });
    }

    // only allow cancel if user is a participant or admin
    const isParticipant =
      req.userId === meeting.bookedUserId ||
      req.userId === meeting.bookedMentorId ||
      req.userId === meeting.adminId;

    if (req.userRole !== "ADMIN" && !isParticipant) {
      return res.status(403).json({ error: "Not authorized to cancel this meeting" });
    }

    // only allow cancel if meeting is in the future
    if (new Date(meeting.startTime) <= new Date()) {
      return res.status(400).json({ error: "Cannot cancel a meeting that has already started" });
    }

    const updated = await prisma.meeting.update({
      where: { id },
      data: {
        status: "CANCELLED",
        cancelledBy: req.userId,
        cancelledAt: new Date(),
      },
      include: { user: true, mentor: true },
    });

    if (updated.requestId) {
      await prisma.mentoringRequest.update({
        where: { id: updated.requestId },
        data: { status: "PENDING" },
      }).catch(err => console.error("Failed to transition request back to PENDING:", err));
    }

    res.json(updated);
  } catch (e) {
    next(e);
  }
}
