import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (!auth.authenticated) return auth.errorResponse!;

  try {
    const activeSemester = await prisma.semester.findFirst({
      where: { purged: false },
      include: {
        geofence: true,
        holidays: true,
        courses: {
          include: {
            slots: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!activeSemester) {
      return NextResponse.json({
        hasActiveSemester: false,
        semester: null,
        geofence: null,
        courses: [],
        slots: [],
        holidays: [],
        recentRecords: [],
      });
    }

    // Recent records (e.g. past 14 days and today)
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    const recentRecords = await prisma.attendanceRecord.findMany({
      where: {
        classSlot: { course: { semesterId: activeSemester.id } },
        date: { gte: twoWeeksAgo },
      },
      include: {
        classSlot: {
          include: { course: true },
        },
      },
      orderBy: { date: "desc" },
    });

    const courses = activeSemester.courses.map((c) => ({
      id: c.id,
      code: c.code,
      name: c.name,
      category: c.category,
      thresholdPct: c.thresholdPct,
    }));

    const slots = activeSemester.courses.flatMap((c) =>
      c.slots.map((s) => ({
        id: s.id,
        courseId: s.courseId,
        courseCode: c.code,
        courseName: c.name,
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime,
        endTime: s.endTime,
        roomCode: s.roomCode,
        recurring: s.recurring,
        specificDate: s.specificDate,
        sessionMode: s.sessionMode,
        makeupForRecordId: s.makeupForRecordId,
      }))
    );

    return NextResponse.json({
      hasActiveSemester: true,
      semester: {
        id: activeSemester.id,
        name: activeSemester.name,
        startDate: activeSemester.startDate,
        endDate: activeSemester.endDate,
        midtermWeekStart: activeSemester.midtermWeekStart,
        midtermWeekEnd: activeSemester.midtermWeekEnd,
        purgeAt: activeSemester.purgeAt,
      },
      geofence: activeSemester.geofence,
      courses,
      slots,
      holidays: activeSemester.holidays,
      recentRecords,
    });
  } catch (error: any) {
    console.error("Error in sync GET:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
