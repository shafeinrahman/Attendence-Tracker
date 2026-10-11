import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, verifySemesterOwnership } from "@/lib/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if (auth.errorResponse) return auth.errorResponse;
  const user = auth.user;

  try {
    const { id } = await params;
    const ownership = await verifySemesterOwnership(id, user.id);
    if (!ownership.authorized) {
      return ownership.errorResponse;
    }

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

    return NextResponse.json({ semester });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if (auth.errorResponse) return auth.errorResponse;
  const user = auth.user;

  try {
    const { id } = await params;
    const ownership = await verifySemesterOwnership(id, user.id);
    if (!ownership.authorized) {
      return ownership.errorResponse;
    }

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
    const { name, startDate, endDate, midtermWeekStart, midtermWeekEnd, countFirstWeek, geofence } = body;

    const dataToUpdate: any = {};
    if (name) dataToUpdate.name = name;
    if (startDate) dataToUpdate.startDate = new Date(startDate);
    if (countFirstWeek !== undefined) dataToUpdate.countFirstWeek = Boolean(countFirstWeek);

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

    const firstWeekChanged = countFirstWeek !== undefined || startDate !== undefined;

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

    // Retroactive update for flags (midterm week, first week): §4.1
    if (midtermChanged || firstWeekChanged) {
      const slotIds = existing.courses.flatMap((c) => c.slots.map((s) => s.id));
      if (slotIds.length > 0) {
        const semStart = new Date(updated.startDate);
        const firstWeekEnd = new Date(semStart.getTime() + 7 * 24 * 60 * 60 * 1000);
        const mStart = updated.midtermWeekStart;
        const mEnd = updated.midtermWeekEnd;

        // 1. Reconcile isFirstWeek flags
        await prisma.attendanceRecord.updateMany({
          where: {
            classSlotId: { in: slotIds },
            date: {
              gte: semStart,
              lt: firstWeekEnd,
            },
          },
          data: {
            isFirstWeek: true,
          },
        });

        await prisma.attendanceRecord.updateMany({
          where: {
            classSlotId: { in: slotIds },
            isFirstWeek: true,
            OR: [{ date: { lt: semStart } }, { date: { gte: firstWeekEnd } }],
          },
          data: {
            isFirstWeek: false,
          },
        });

        // 2. Reconcile isMidtermWeek flags
        if (mStart && mEnd) {
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

          await prisma.attendanceRecord.updateMany({
            where: {
              classSlotId: { in: slotIds },
              isMidtermWeek: true,
              OR: [{ date: { lt: mStart } }, { date: { gt: mEnd } }],
            },
            data: {
              isMidtermWeek: false,
            },
          });
        } else {
          await prisma.attendanceRecord.updateMany({
            where: {
              classSlotId: { in: slotIds },
              isMidtermWeek: true,
            },
            data: {
              isMidtermWeek: false,
            },
          });
        }

        // 3. Reconcile countedInStats based on flags and countFirstWeek setting
        // Midterm week records are always excluded
        await prisma.attendanceRecord.updateMany({
          where: {
            classSlotId: { in: slotIds },
            isMidtermWeek: true,
          },
          data: {
            countedInStats: false,
          },
        });

        // First week records (not in midterm week) follow the countFirstWeek setting
        await prisma.attendanceRecord.updateMany({
          where: {
            classSlotId: { in: slotIds },
            isFirstWeek: true,
            isMidtermWeek: false,
          },
          data: {
            countedInStats: updated.countFirstWeek,
          },
        });

        // Normal semester records are counted in stats
        await prisma.attendanceRecord.updateMany({
          where: {
            classSlotId: { in: slotIds },
            isFirstWeek: false,
            isMidtermWeek: false,
          },
          data: {
            countedInStats: true,
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
  const auth = await requireAuth(req);
  if (auth.errorResponse) return auth.errorResponse;
  const user = auth.user;

  try {
    const { id } = await params;
    const ownership = await verifySemesterOwnership(id, user.id);
    if (!ownership.authorized) {
      return ownership.errorResponse;
    }

    await prisma.semester.delete({
      where: { id },
    });
    return NextResponse.json({ message: "Semester deleted successfully" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
