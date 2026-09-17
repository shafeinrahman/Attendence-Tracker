import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (!auth.authenticated) return auth.errorResponse!;

  try {
    const { searchParams } = new URL(req.url);
    const courseId = searchParams.get("courseId");
    const dateStr = searchParams.get("date"); // e.g. "2026-09-17"

    let slots;
    if (courseId) {
      slots = await prisma.classSlot.findMany({
        where: { courseId },
        include: { course: true },
        orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
      });
    } else {
      slots = await prisma.classSlot.findMany({
        where: {
          course: {
            semester: { purged: false },
          },
        },
        include: { course: true },
        orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
      });
    }

    if (dateStr) {
      const targetDate = new Date(dateStr);
      // JS getDay(): 0 is Sunday, 1 is Monday... convert to 1 (Mon) - 7 (Sun)
      const jsDay = targetDate.getDay();
      const isoDay = jsDay === 0 ? 7 : jsDay;

      // Filter slots for targetDate: recurring slots on that dayOfWeek, or specificDate slots on that date
      slots = slots.filter((slot) => {
        if (slot.specificDate) {
          const sDate = new Date(slot.specificDate);
          return sDate.toISOString().slice(0, 10) === targetDate.toISOString().slice(0, 10);
        }
        return slot.recurring && slot.dayOfWeek === isoDay;
      });
    }

    return NextResponse.json({ slots });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (!auth.authenticated) return auth.errorResponse!;

  try {
    const body = await req.json();
    const {
      courseId,
      dayOfWeek,
      startTime,
      endTime,
      roomCode,
      recurring,
      specificDate,
      sessionMode,
      makeupForRecordId,
    } = body;

    if (!courseId || !startTime || !endTime) {
      return NextResponse.json(
        { error: "courseId, startTime, and endTime are required" },
        { status: 400 }
      );
    }

    let calculatedDayOfWeek = dayOfWeek;
    let sDate = specificDate ? new Date(specificDate) : null;
    if (sDate && !calculatedDayOfWeek) {
      const jsDay = sDate.getDay();
      calculatedDayOfWeek = jsDay === 0 ? 7 : jsDay;
    }

    const slot = await prisma.classSlot.create({
      data: {
        courseId,
        dayOfWeek: calculatedDayOfWeek || 1,
        startTime,
        endTime,
        roomCode: roomCode || (sessionMode === "online" ? "ONLINE" : "TBD"),
        recurring: recurring !== undefined ? recurring : !sDate,
        specificDate: sDate,
        sessionMode: sessionMode || "in_person",
        makeupForRecordId: makeupForRecordId || null,
      },
      include: {
        course: true,
        makeupForRecord: true,
      },
    });

    return NextResponse.json({ slot }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
