import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, verifySemesterOwnership } from "@/lib/auth";
import { calculateCourseStats } from "@/lib/attendance-calculator";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.errorResponse) return auth.errorResponse;
  const user = auth.user;

  try {
    const { searchParams } = new URL(req.url);
    const format = searchParams.get("format") || "json"; // "json" | "csv"
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
        geofence: true,
        holidays: true,
        courses: {
          include: {
            slots: {
              include: {
                attendanceRecords: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!activeSemester) {
      return NextResponse.json({ error: "No active semester to export" }, { status: 404 });
    }

    const coursesData = activeSemester.courses.map((course) => {
      const records = course.slots.flatMap((s) => s.attendanceRecords);
      const stats = calculateCourseStats({
        courseId: course.id,
        courseCode: course.code,
        courseName: course.name,
        category: course.category,
        thresholdPct: course.thresholdPct,
        records,
        remainingSlots: 0,
      });

      return {
        code: course.code,
        name: course.name,
        category: course.category,
        threshold: `${course.thresholdPct}%`,
        attended: stats.attended,
        held: stats.held,
        percentage: `${stats.currentPercentage}%`,
        meetsThreshold: stats.meetsThreshold ? "Yes" : "No",
        records: records.map((r) => ({
          date: new Date(r.date).toISOString().slice(0, 10),
          status: r.status,
          countedInStats: r.countedInStats,
          source: r.source,
        })),
      };
    });

    if (format === "csv") {
      const rows: string[] = [];
      rows.push("CourseCode,CourseName,Category,Threshold,Date,Status,CountedInStats,Source");

      for (const c of coursesData) {
        if (c.records.length === 0) {
          rows.push(`"${c.code}","${c.name}","${c.category}","${c.threshold}","N/A","N/A","N/A","N/A"`);
        } else {
          for (const r of c.records) {
            rows.push(
              `"${c.code}","${c.name}","${c.category}","${c.threshold}","${r.date}","${r.status}","${r.countedInStats}","${r.source}"`
            );
          }
        }
      }

      const csvContent = rows.join("\n");
      return new NextResponse(csvContent, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="attendance-export-${activeSemester.name.replace(/\s+/g, "_")}.csv"`,
        },
      });
    }

    return NextResponse.json({
      semester: {
        id: activeSemester.id,
        name: activeSemester.name,
        startDate: activeSemester.startDate,
        endDate: activeSemester.endDate,
        purgeAt: activeSemester.purgeAt,
      },
      courses: coursesData,
      exportedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
