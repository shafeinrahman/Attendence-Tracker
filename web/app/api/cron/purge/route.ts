import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyApiToken, extractTokenFromRequest } from "@/lib/auth";

export async function GET(req: NextRequest) {
  // Support either auth token or Vercel Cron header (CRON_SECRET)
  const token = extractTokenFromRequest(req);
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  const isCronAuthorized =
    verifyApiToken(token) ||
    (cronSecret && authHeader === `Bearer ${cronSecret}`);

  if (!isCronAuthorized) {
    return NextResponse.json({ error: "Unauthorized cron execution" }, { status: 401 });
  }

  try {
    const now = new Date();

    // Semesters where purgeAt <= now and not yet purged
    const dueSemesters = await prisma.semester.findMany({
      where: {
        purgeAt: { lte: now },
        purged: false,
      },
    });

    const purgedIds: string[] = [];

    for (const semester of dueSemesters) {
      // 1. Delete associated data
      await prisma.holiday.deleteMany({ where: { semesterId: semester.id } });
      await prisma.campusGeofence.deleteMany({ where: { semesterId: semester.id } });

      const courses = await prisma.course.findMany({
        where: { semesterId: semester.id },
        select: { id: true },
      });
      const courseIds = courses.map((c) => c.id);

      if (courseIds.length > 0) {
        const slots = await prisma.classSlot.findMany({
          where: { courseId: { in: courseIds } },
          select: { id: true },
        });
        const slotIds = slots.map((s) => s.id);

        if (slotIds.length > 0) {
          await prisma.attendanceRecord.deleteMany({
            where: { classSlotId: { in: slotIds } },
          });
          await prisma.classSlot.deleteMany({
            where: { id: { in: slotIds } },
          });
        }
        await prisma.course.deleteMany({
          where: { id: { in: courseIds } },
        });
      }

      await prisma.semester.update({
        where: { id: semester.id },
        data: { purged: true },
      });

      purgedIds.push(semester.id);
    }

    return NextResponse.json({
      success: true,
      purgedCount: purgedIds.length,
      purgedIds,
      checkedAt: now.toISOString(),
    });
  } catch (error: any) {
    console.error("Error running purge cron:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
