import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, verifySemesterOwnership } from "@/lib/auth";
import { calculateCourseStats, CourseAttendanceStats } from "@/lib/attendance-calculator";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.errorResponse) return auth.errorResponse;
  const user = auth.user;

  try {
    const { searchParams } = new URL(req.url);
    const semesterId = searchParams.get("semesterId");

    if (semesterId) {
      const ownership = await verifySemesterOwnership(semesterId, user.id);
      if (!ownership.authorized) return ownership.errorResponse;
    }

    const activeSemester = await prisma.semester.findFirst({
      where: semesterId
        ? { id: semesterId, userId: user.id }
        : { userId: user.id, purged: false },
      include: {
        courses: {
          include: {
            slots: {
              include: {
                attendanceRecords: true,
              },
            },
          },
        },
        holidays: true,
      },
      orderBy: { createdAt: "desc" },
    });

    if (!activeSemester) {
      return NextResponse.json({
        semester: null,
        courses: [],
        overall: { attended: 0, held: 0, percentage: 0 },
      });
    }

    const today = new Date();
    const semesterEnd = new Date(activeSemester.endDate);

    const holidayDateSet = new Set(
      activeSemester.holidays.map((h) => new Date(h.date).toISOString().slice(0, 10))
    );

    const coursesStats: CourseAttendanceStats[] = [];
    let totalAttended = 0;
    let totalHeld = 0;

    for (const course of activeSemester.courses) {
      // Collect all attendance records for this course
      const allRecords = course.slots.flatMap((s) => s.attendanceRecords);

      // Calculate remaining slots until semester end
      let remainingSlotsCount = 0;
      if (today < semesterEnd) {
        let cur = new Date(today);
        cur.setDate(cur.getDate() + 1);

        while (cur <= semesterEnd) {
          const curStr = cur.toISOString().slice(0, 10);
          if (!holidayDateSet.has(curStr)) {
            const jsDay = cur.getDay();
            const isoDay = jsDay === 0 ? 7 : jsDay;

            for (const slot of course.slots) {
              if (slot.specificDate) {
                if (new Date(slot.specificDate).toISOString().slice(0, 10) === curStr) {
                  remainingSlotsCount++;
                }
              } else if (slot.recurring && slot.dayOfWeek === isoDay) {
                remainingSlotsCount++;
              }
            }
          }
          cur.setDate(cur.getDate() + 1);
        }
      }

      const stats = calculateCourseStats({
        courseId: course.id,
        courseCode: course.code,
        courseName: course.name,
        category: course.category,
        thresholdPct: course.thresholdPct,
        records: allRecords,
        remainingSlots: remainingSlotsCount,
      });

      stats.roomCodes = Array.from(new Set(course.slots.map((s) => s.roomCode).filter(Boolean)));

      coursesStats.push(stats);
      totalAttended += stats.attended;
      totalHeld += stats.held;
    }

    const overallPercentage = totalHeld > 0 ? Number(((totalAttended / totalHeld) * 100).toFixed(2)) : 0;

    return NextResponse.json({
      semester: {
        id: activeSemester.id,
        name: activeSemester.name,
        startDate: activeSemester.startDate,
        endDate: activeSemester.endDate,
        midtermWeekStart: activeSemester.midtermWeekStart,
        midtermWeekEnd: activeSemester.midtermWeekEnd,
        purgeAt: activeSemester.purgeAt,
      },
      courses: coursesStats,
      overall: {
        attended: totalAttended,
        held: totalHeld,
        percentage: overallPercentage,
      },
    });
  } catch (error: any) {
    console.error("Error in analytics GET:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
