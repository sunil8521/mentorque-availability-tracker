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
