import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (!auth.authenticated) return auth.errorResponse!;

  try {
    const body = await req.json();
    const { records } = body; // Array of { classSlotId, date, status, source, loggedAt, isBulkSkip }

    if (!Array.isArray(records) || records.length === 0) {
      return NextResponse.json({ error: "records must be a non-empty array" }, { status: 400 });
    }

    const activeSemester = await prisma.semester.findFirst({
      where: { purged: false },
      orderBy: { createdAt: "desc" },
    });

    if (!activeSemester) {
      return NextResponse.json({ error: "No active semester found" }, { status: 400 });
    }

    const semStart = new Date(activeSemester.startDate);
    const firstWeekEnd = new Date(semStart.getTime() + 7 * 24 * 60 * 60 * 1000);

    const processedIds: string[] = [];

    for (const item of records) {
      const targetDate = new Date(item.date.slice(0, 10) + "T00:00:00Z");
      const isFirstWeek = targetDate >= semStart && targetDate < firstWeekEnd;

      let isMidtermWeek = false;
      if (activeSemester.midtermWeekStart && activeSemester.midtermWeekEnd) {
        isMidtermWeek =
          targetDate >= new Date(activeSemester.midtermWeekStart) &&
          targetDate <= new Date(activeSemester.midtermWeekEnd);
      }

      const countedInStats = !isFirstWeek && !isMidtermWeek;

      const record = await prisma.attendanceRecord.upsert({
        where: {
          classSlotId_date: {
            classSlotId: item.classSlotId,
            date: targetDate,
          },
        },
        create: {
          classSlotId: item.classSlotId,
          date: targetDate,
          status: item.status,
          countedInStats,
          isFirstWeek,
          isMidtermWeek,
          isBulkSkip: Boolean(item.isBulkSkip),
          source: item.source || "phone",
          loggedAt: item.loggedAt ? new Date(item.loggedAt) : new Date(),
        },
        update: {
          status: item.status,
          countedInStats,
          source: item.source || "phone",
          loggedAt: item.loggedAt ? new Date(item.loggedAt) : new Date(),
        },
      });

      processedIds.push(item.localSyncId || record.id);
    }

    return NextResponse.json({
      success: true,
      acknowledgedCount: processedIds.length,
      acknowledgedIds: processedIds,
    });
  } catch (error: any) {
    console.error("Error in sync/attendance POST:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
