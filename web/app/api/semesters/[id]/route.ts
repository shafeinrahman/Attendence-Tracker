import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = authenticateRequest(req);
  if (!auth.authenticated) return auth.errorResponse!;

  try {
    const { id } = await params;
    const semester = await prisma.semester.findUnique({
      where: { id },
      include: {
        courses: {
          include: {
            slots: true,
          },
        },
        geofence: true,
        holidays: true,
      },
    });

    if (!semester) {
      return NextResponse.json({ error: "Semester not found" }, { status: 404 });
    }

    return NextResponse.json({ semester });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = authenticateRequest(req);
  if (!auth.authenticated) return auth.errorResponse!;

  try {
    const { id } = await params;
    const existing = await prisma.semester.findUnique({
      where: { id },
      include: {
        courses: {
          include: {
            slots: true,
          },
        },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Semester not found" }, { status: 404 });
    }

    if (existing.purged) {
      return NextResponse.json(
        { error: "Cannot modify a semester that has already been purged." },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { name, startDate, endDate, midtermWeekStart, midtermWeekEnd, geofence } = body;

    const dataToUpdate: any = {};
    if (name) dataToUpdate.name = name;
    if (startDate) dataToUpdate.startDate = new Date(startDate);

    // Extending / updating end date: automatically recompute purgeAt = endDate + 7 days
    if (endDate) {
      const newEnd = new Date(endDate);
      dataToUpdate.endDate = newEnd;
      dataToUpdate.purgeAt = new Date(newEnd.getTime() + 7 * 24 * 60 * 60 * 1000);
    }

    const midtermChanged = midtermWeekStart !== undefined || midtermWeekEnd !== undefined;
    if (midtermWeekStart !== undefined) {
      dataToUpdate.midtermWeekStart = midtermWeekStart ? new Date(midtermWeekStart) : null;
    }
    if (midtermWeekEnd !== undefined) {
      dataToUpdate.midtermWeekEnd = midtermWeekEnd ? new Date(midtermWeekEnd) : null;
    }

    const updated = await prisma.semester.update({
      where: { id },
      data: dataToUpdate,
      include: {
        geofence: true,
      },
    });

    // Update Geofence if provided
    if (geofence) {
      await prisma.campusGeofence.upsert({
        where: { semesterId: id },
        create: {
          semesterId: id,
          latitude: geofence.latitude,
          longitude: geofence.longitude,
          radiusMeters: geofence.radiusMeters || 300.0,
        },
        update: {
          latitude: geofence.latitude,
          longitude: geofence.longitude,
          radiusMeters: geofence.radiusMeters || 300.0,
        },
      });
    }

    // Retroactive update for midterm week: §4.1
    if (midtermChanged) {
      const slotIds = existing.courses.flatMap((c) => c.slots.map((s) => s.id));
      if (slotIds.length > 0) {
        const mStart = updated.midtermWeekStart;
        const mEnd = updated.midtermWeekEnd;

        if (mStart && mEnd) {
          // 1. Records falling in the midterm range -> isMidtermWeek = true, countedInStats = false
          await prisma.attendanceRecord.updateMany({
            where: {
              classSlotId: { in: slotIds },
              date: {
                gte: mStart,
                lte: mEnd,
              },
            },
            data: {
              isMidtermWeek: true,
              countedInStats: false,
            },
          });

          // 2. Records falling OUTSIDE the new midterm range that were previously flagged
          await prisma.attendanceRecord.updateMany({
            where: {
              classSlotId: { in: slotIds },
              isMidtermWeek: true,
              OR: [{ date: { lt: mStart } }, { date: { gt: mEnd } }],
            },
            data: {
              isMidtermWeek: false,
              countedInStats: true, // will be corrected if isFirstWeek
            },
          });
        } else {
          // Midterm week cleared
          await prisma.attendanceRecord.updateMany({
            where: {
              classSlotId: { in: slotIds },
              isMidtermWeek: true,
            },
            data: {
              isMidtermWeek: false,
              countedInStats: true,
            },
          });
        }

        // Ensure any first-week records remain countedInStats = false
        await prisma.attendanceRecord.updateMany({
          where: {
            classSlotId: { in: slotIds },
            isFirstWeek: true,
          },
          data: {
            countedInStats: false,
          },
        });
      }
    }

    const finalSemester = await prisma.semester.findUnique({
      where: { id },
      include: {
        courses: { include: { slots: true } },
        geofence: true,
        holidays: true,
      },
    });

    return NextResponse.json({ semester: finalSemester });
  } catch (error: any) {
    console.error("Error updating semester:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = authenticateRequest(req);
  if (!auth.authenticated) return auth.errorResponse!;

  try {
    const { id } = await params;
    await prisma.semester.delete({
      where: { id },
    });
    return NextResponse.json({ message: "Semester deleted successfully" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
