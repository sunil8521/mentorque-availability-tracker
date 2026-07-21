import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function createRequest(req, res) {
  try {
    const { requirementType, requirementDesc } = req.body;
    
    if (!requirementType) {
      return res.status(400).json({ error: "requirementType is required" });
    }

    const existing = await prisma.mentoringRequest.findFirst({
      where: { userId: req.userId, status: "PENDING" }
    });

    if (existing) {
      const updated = await prisma.mentoringRequest.update({
        where: { id: existing.id },
        data: { requirementType, requirementDesc }
      });
      return res.json(updated);
    }

    const request = await prisma.mentoringRequest.create({
      data: {
        userId: req.userId,
        requirementType,
        requirementDesc
      }
    });

    res.json(request);
  } catch (error) {
    console.error("Error creating request:", error);
    res.status(500).json({ error: "Failed to create mentoring request" });
  }
}

export async function getMyRequests(req, res) {
  try {
    const requests = await prisma.mentoringRequest.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: "desc" },
      include: {
        meetings: true
      }
    });

    res.json(requests);
  } catch (error) {
    console.error("Error fetching requests:", error);
    res.status(500).json({ error: "Failed to fetch mentoring requests" });
  }
}

export async function cancelRequest(req, res) {
  try {
    const { id } = req.params;

    const request = await prisma.mentoringRequest.findUnique({
      where: { id }
    });

    if (!request) {
      return res.status(404).json({ error: "Request not found" });
    }

    if (request.userId !== req.userId) {
      return res.status(403).json({ error: "Not authorized" });
    }

    const updated = await prisma.mentoringRequest.update({
      where: { id },
      data: { status: "CANCELLED" }
    });

    res.json(updated);
  } catch (error) {
    console.error("Error cancelling request:", error);
    res.status(500).json({ error: "Failed to cancel request" });
  }
}
