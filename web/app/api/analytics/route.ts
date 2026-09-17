import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/auth";
import { calculateCourseStats, CourseAttendanceStats } from "@/lib/attendance-calculator";

export async function GET(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (!auth.authenticated) return auth.errorResponse!;

  try {
    const activeSemester = await prisma.semester.findFirst({
      where: { purged: false },
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
    const todayStr = today.toISOString().slice(0, 10);
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
        // Iterate days from tomorrow (or today's remaining) to semester end
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
