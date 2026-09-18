import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, verifySemesterOwnership } from "@/lib/auth";

interface CommitSlotPayload {
  courseCode: string;
  courseName?: string;
  roomCode: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  category: "theory" | "lab" | "unclassified";
  thresholdPct: number;
  categorySource?: "inferred" | "manual";
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.errorResponse) return auth.errorResponse;
  const user = auth.user;

  try {
    const body = await req.json();
    const { semesterId, slots } = body as {
      semesterId?: string;
      slots: CommitSlotPayload[];
    };

    if (!Array.isArray(slots) || slots.length === 0) {
      return NextResponse.json({ error: "slots array is required" }, { status: 400 });
    }

    let targetSemesterId = semesterId;
    if (!targetSemesterId) {
      const active = await prisma.semester.findFirst({
        where: { userId: user.id, purged: false },
        orderBy: { createdAt: "desc" },
      });
      if (!active) {
        return NextResponse.json(
          { error: "No active semester found for user. Please create a semester first." },
          { status: 400 }
        );
      }
      targetSemesterId = active.id;
    } else {
      const ownership = await verifySemesterOwnership(targetSemesterId, user.id);
      if (!ownership.authorized) return ownership.errorResponse;
    }

    // Process courses for this user's semester
    const courseMap = new Map<string, any>();
    const existingCourses = await prisma.course.findMany({
      where: { semesterId: targetSemesterId, semester: { userId: user.id } },
      include: {
        slots: {
          include: {
            _count: {
              select: { attendanceRecords: true },
            },
          },
        },
      },
    });

    for (const c of existingCourses) {
      courseMap.set(c.code.toUpperCase(), c);
    }

    // Group incoming slots by courseCode
    const courseGroups = new Map<string, CommitSlotPayload[]>();
    for (const slot of slots) {
      const code = slot.courseCode.toUpperCase();
      if (!courseGroups.has(code)) {
        courseGroups.set(code, []);
      }
      courseGroups.get(code)!.push(slot);
    }

    const savedCourses = [];
    const savedSlots = [];

    for (const [courseCode, groupSlots] of Array.from(courseGroups.entries())) {
      const firstSlot = groupSlots[0];
      let course = courseMap.get(courseCode);

      if (!course) {
        // Create new course in user's semester
        course = await prisma.course.create({
          data: {
            semesterId: targetSemesterId,
            code: courseCode,
            name: firstSlot.courseName || courseCode,
            category: firstSlot.category,
            categorySource: firstSlot.categorySource || "inferred",
            thresholdPct: firstSlot.thresholdPct,
          },
          include: { slots: true },
        });
      } else {
        // Update if existing course is not manually locked, or if incoming is explicit manual override
        if (
          course.categorySource !== "manual" ||
          firstSlot.categorySource === "manual"
        ) {
          course = await prisma.course.update({
            where: { id: course.id },
            data: {
              category: firstSlot.category,
              categorySource: firstSlot.categorySource || course.categorySource,
              thresholdPct: firstSlot.thresholdPct,
            },
            include: { slots: true },
          });
        }
      }
      savedCourses.push(course);

      // Diff-merge slots for this course
      const existingSlots = course.slots || [];

      for (const slotData of groupSlots) {
        // Look for match by dayOfWeek and startTime
        const matchedSlot = existingSlots.find(
          (s: any) =>
            s.dayOfWeek === slotData.dayOfWeek && s.startTime === slotData.startTime
        );

        if (matchedSlot) {
          // Update roomCode, endTime without deleting slot (preserving attendance records!)
          const updated = await prisma.classSlot.update({
            where: { id: matchedSlot.id },
            data: {
              roomCode: slotData.roomCode,
              endTime: slotData.endTime,
            },
          });
          savedSlots.push(updated);
        } else {
          // Create new slot
          const created = await prisma.classSlot.create({
            data: {
              courseId: course.id,
              dayOfWeek: slotData.dayOfWeek,
              startTime: slotData.startTime,
              endTime: slotData.endTime,
              roomCode: slotData.roomCode,
              recurring: true,
              sessionMode: "in_person",
            },
          });
          savedSlots.push(created);
        }
      }
    }

    return NextResponse.json({
      success: true,
      committedCourses: savedCourses.length,
      committedSlots: savedSlots.length,
    });
  } catch (error: any) {
    console.error("Error in routine/commit:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
