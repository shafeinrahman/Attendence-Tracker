import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (!auth.authenticated) return auth.errorResponse!;

  try {
    const { searchParams } = new URL(req.url);
    const semesterId = searchParams.get("semesterId");

    const holidays = await prisma.holiday.findMany({
      where: semesterId ? { semesterId } : { semester: { purged: false } },
      orderBy: { date: "asc" },
    });

    return NextResponse.json({ holidays });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (!auth.authenticated) return auth.errorResponse!;

  try {
    const body = await req.json();
    const { date, label, semesterId } = body;

    if (!date) {
      return NextResponse.json({ error: "date is required" }, { status: 400 });
    }

    const holidayDate = new Date(date + "T00:00:00Z");

    let targetSemesterId = semesterId;
    if (!targetSemesterId) {
      const active = await prisma.semester.findFirst({
        where: { purged: false },
        orderBy: { createdAt: "desc" },
      });
      if (!active) {
        return NextResponse.json({ error: "No active semester found" }, { status: 400 });
      }
      targetSemesterId = active.id;
    }

    const holiday = await prisma.holiday.upsert({
      where: {
        semesterId_date: {
          semesterId: targetSemesterId,
          date: holidayDate,
        },
      },
      create: {
        semesterId: targetSemesterId,
        date: holidayDate,
        label: label || "Holiday",
      },
      update: {
        label: label || "Holiday",
      },
    });

    // Proactive & Retroactive handling (§4.10):
    // 1. Find all slots occurring on this date
    const jsDay = holidayDate.getDay();
    const isoDay = jsDay === 0 ? 7 : jsDay;

    const slots = await prisma.classSlot.findMany({
      where: {
        course: { semesterId: targetSemesterId },
        OR: [
          { specificDate: holidayDate },
          { recurring: true, dayOfWeek: isoDay },
        ],
      },
    });

    // 2. Proactively create/upsert records with status="cancelled_holiday"
    // Also retroactively flips any existing "absent" records on this date
    for (const slot of slots) {
      await prisma.attendanceRecord.upsert({
        where: {
          classSlotId_date: {
            classSlotId: slot.id,
            date: holidayDate,
          },
        },
        create: {
          classSlotId: slot.id,
          date: holidayDate,
          status: "cancelled_holiday",
          countedInStats: false,
          isFirstWeek: false,
          isMidtermWeek: false,
          source: "default",
        },
        update: {
          status: "cancelled_holiday",
          countedInStats: false,
          loggedAt: new Date(),
        },
      });
    }

    return NextResponse.json({ holiday, affectedSlots: slots.length }, { status: 201 });
  } catch (error: any) {
    console.error("Error creating holiday:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (!auth.authenticated) return auth.errorResponse!;

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Holiday id is required" }, { status: 400 });
    }

    await prisma.holiday.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Holiday deleted successfully" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
