import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (!auth.authenticated) return auth.errorResponse!;

  try {
    const activeSemester = await prisma.semester.findFirst({
      where: { purged: false },
      include: {
        courses: {
          include: {
            slots: true,
          },
        },
        geofence: true,
        holidays: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ semester: activeSemester });
  } catch (error: any) {
    console.error("Error fetching active semester:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch semester" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (!auth.authenticated) return auth.errorResponse!;

  try {
    const body = await req.json();
    const { name, startDate, endDate, midtermWeekStart, midtermWeekEnd, geofence } = body;

    if (!name || !startDate || !endDate) {
      return NextResponse.json(
        { error: "name, startDate, and endDate are required" },
        { status: 400 }
      );
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    const purgeAt = new Date(end.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Only one active semester at a time: check if an active semester exists
    const existingActive = await prisma.semester.findFirst({
      where: { purged: false },
    });

    if (existingActive) {
      return NextResponse.json(
        { error: "An active semester already exists. Complete, purge, or archive it before creating a new one." },
        { status: 400 }
      );
    }

    const semester = await prisma.semester.create({
      data: {
        name,
        startDate: start,
        endDate: end,
        midtermWeekStart: midtermWeekStart ? new Date(midtermWeekStart) : null,
        midtermWeekEnd: midtermWeekEnd ? new Date(midtermWeekEnd) : null,
        purgeAt,
        purged: false,
        ...(geofence && {
          geofence: {
            create: {
              latitude: geofence.latitude,
              longitude: geofence.longitude,
              radiusMeters: geofence.radiusMeters || 300.0,
            },
          },
        }),
      },
      include: {
        geofence: true,
      },
    });

    return NextResponse.json({ semester }, { status: 201 });
  } catch (error: any) {
    console.error("Error creating semester:", error);
    return NextResponse.json({ error: error.message || "Failed to create semester" }, { status: 500 });
  }
}
