import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, verifySlotOwnership, verifySemesterOwnership } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.errorResponse) return auth.errorResponse;
  const user = auth.user;

  try {
    const { searchParams } = new URL(req.url);
    const dateStr = searchParams.get("date"); // YYYY-MM-DD
    const courseId = searchParams.get("courseId");
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
            slots: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!activeSemester) {
      return NextResponse.json({ records: [] });
    }

    const allSlots = activeSemester.courses.flatMap((c) => c.slots);

    // If a specific date is requested, perform lazy absent defaulting for any passed slots on that date
    if (dateStr) {
      const targetDate = new Date(dateStr + "T00:00:00Z");
      const jsDay = targetDate.getDay();
      const isoDay = jsDay === 0 ? 7 : jsDay;

      // Find slots active on this date
      const applicableSlots = allSlots.filter((slot) => {
        if (slot.specificDate) {
          return new Date(slot.specificDate).toISOString().slice(0, 10) === dateStr;
        }
        return slot.recurring && slot.dayOfWeek === isoDay;
      });

      // Existing records for this date
      const existingRecords = await prisma.attendanceRecord.findMany({
        where: {
          classSlotId: { in: applicableSlots.map((s) => s.id) },
          date: targetDate,
        },
      });

      const existingSlotIds = new Set(existingRecords.map((r) => r.classSlotId));

      // Determine if date has passed or is today
      const now = new Date();
      const todayStr = now.toISOString().slice(0, 10);
      const isPastDate = dateStr < todayStr;

      // Check for first week & midterm week flags
      const semStart = new Date(activeSemester.startDate);
      const firstWeekEnd = new Date(semStart.getTime() + 7 * 24 * 60 * 60 * 1000);
      const isFirstWeek = targetDate >= semStart && targetDate < firstWeekEnd;

      let isMidtermWeek = false;
      if (activeSemester.midtermWeekStart && activeSemester.midtermWeekEnd) {
        isMidtermWeek =
          targetDate >= new Date(activeSemester.midtermWeekStart) &&
          targetDate <= new Date(activeSemester.midtermWeekEnd);
      }

      const countedInStats = !isFirstWeek && !isMidtermWeek;

      // If past date, lazily default any unrecorded slot to 'absent'
      if (isPastDate) {
        for (const slot of applicableSlots) {
          if (!existingSlotIds.has(slot.id)) {
            try {
              await prisma.attendanceRecord.create({
                data: {
                  classSlotId: slot.id,
                  date: targetDate,
                  status: "absent",
                  countedInStats,
                  isFirstWeek,
                  isMidtermWeek,
                  isBulkSkip: false,
                  source: "default",
                },
              });
            } catch (e) {
              // Ignore unique constraint race conditions
            }
          }
        }
      }
    }

    // Query records
    const whereClause: any = {};
    if (dateStr) {
      whereClause.date = new Date(dateStr + "T00:00:00Z");
    }
    if (courseId) {
      whereClause.classSlot = {
        courseId,
        course: { semester: { userId: user.id } },
      };
    } else {
      whereClause.classSlot = {
        course: { semesterId: activeSemester.id, semester: { userId: user.id } },
      };
    }

    const records = await prisma.attendanceRecord.findMany({
      where: whereClause,
      include: {
        classSlot: {
          include: {
            course: true,
          },
        },
      },
      orderBy: [{ date: "desc" }, { loggedAt: "desc" }],
    });

    return NextResponse.json({ records });
  } catch (error: any) {
    console.error("Error in attendance GET:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.errorResponse) return auth.errorResponse;
  const user = auth.user;

  try {
    const body = await req.json();
    const {
      classSlotId,
      date, // YYYY-MM-DD
      status, // "present" | "running_late" | "cancelled_holiday" | "absent" | "excused"
      source, // "phone" | "desktop" | "default"
      isBulkSkip, // boolean (for "Skip Today")
    } = body;

    if (!date) {
      return NextResponse.json({ error: "date is required" }, { status: 400 });
    }

    const targetDate = new Date(date + "T00:00:00Z");

    // Fetch active semester for this user
    const activeSemester = await prisma.semester.findFirst({
      where: { userId: user.id, purged: false },
      orderBy: { createdAt: "desc" },
    });

    if (!activeSemester) {
      return NextResponse.json({ error: "No active semester found for user" }, { status: 400 });
    }

    const semStart = new Date(activeSemester.startDate);
    const firstWeekEnd = new Date(semStart.getTime() + 7 * 24 * 60 * 60 * 1000);
    const isFirstWeek = targetDate >= semStart && targetDate < firstWeekEnd;

    let isMidtermWeek = false;
    if (activeSemester.midtermWeekStart && activeSemester.midtermWeekEnd) {
      isMidtermWeek =
        targetDate >= new Date(activeSemester.midtermWeekStart) &&
        targetDate <= new Date(activeSemester.midtermWeekEnd);
    }

    const countedInStats = !isFirstWeek && !isMidtermWeek;

    // Handle "Skip Today" (Bulk Skip) (§4.11)
    if (isBulkSkip && !classSlotId) {
      // Find all class slots that occur on this date for the user's active semester
      const jsDay = targetDate.getDay();
      const isoDay = jsDay === 0 ? 7 : jsDay;

      const daySlots = await prisma.classSlot.findMany({
        where: {
          course: { semesterId: activeSemester.id, semester: { userId: user.id } },
          OR: [
            { specificDate: targetDate },
            { recurring: true, dayOfWeek: isoDay },
          ],
        },
      });

      const updatedRecords = [];
      for (const slot of daySlots) {
        const record = await prisma.attendanceRecord.upsert({
          where: {
            classSlotId_date: {
              classSlotId: slot.id,
              date: targetDate,
            },
          },
          create: {
            classSlotId: slot.id,
            date: targetDate,
            status: "absent",
            countedInStats,
            isFirstWeek,
            isMidtermWeek,
            isBulkSkip: true,
            source: source || "desktop",
          },
          update: {
            status: "absent",
            isBulkSkip: true,
            source: source || "desktop",
            loggedAt: new Date(),
          },
        });
        updatedRecords.push(record);
      }

      return NextResponse.json({
        message: `Marked entire day as absent (${updatedRecords.length} classes)`,
        records: updatedRecords,
      });
    }

    if (!classSlotId || !status) {
      return NextResponse.json(
        { error: "classSlotId and status are required for single class logging" },
        { status: 400 }
      );
    }

    // Verify slot belongs to the authenticated user
    const slotOwnership = await verifySlotOwnership(classSlotId, user.id);
    if (!slotOwnership.authorized) {
      return slotOwnership.errorResponse;
    }

    const record = await prisma.attendanceRecord.upsert({
      where: {
        classSlotId_date: {
          classSlotId,
          date: targetDate,
        },
      },
      create: {
        classSlotId,
        date: targetDate,
        status,
        countedInStats,
        isFirstWeek,
        isMidtermWeek,
        isBulkSkip: false,
        source: source || "desktop",
      },
      update: {
        status,
        countedInStats,
        source: source || "desktop",
        loggedAt: new Date(),
      },
      include: {
        classSlot: { include: { course: true } },
      },
    });

    return NextResponse.json({ record });
  } catch (error: any) {
    console.error("Error in attendance POST:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.errorResponse) return auth.errorResponse;
  const user = auth.user;

  try {
    const body = await req.json();
    const { id, status } = body;

    if (!id || !status) {
      return NextResponse.json({ error: "id and status are required" }, { status: 400 });
    }

    // Verify record ownership
    const existing = await prisma.attendanceRecord.findUnique({
      where: { id },
      include: {
        classSlot: {
          include: {
            course: {
              include: {
                semester: true,
              },
            },
          },
        },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Attendance record not found" }, { status: 404 });
    }

    if (existing.classSlot.course.semester.userId !== user.id) {
      return NextResponse.json(
        { error: "Forbidden: You do not have access to this record" },
        { status: 403 }
      );
    }

    const record = await prisma.attendanceRecord.update({
      where: { id },
      data: {
        status,
        loggedAt: new Date(),
      },
      include: {
        classSlot: { include: { course: true } },
      },
    });

    return NextResponse.json({ record });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
