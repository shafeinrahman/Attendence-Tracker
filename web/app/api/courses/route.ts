import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, verifySemesterOwnership } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.errorResponse) return auth.errorResponse;
  const user = auth.user;

  try {
    const { searchParams } = new URL(req.url);
    const semesterId = searchParams.get("semesterId");

    if (semesterId) {
      const ownership = await verifySemesterOwnership(semesterId, user.id);
      if (!ownership.authorized) {
        return ownership.errorResponse;
      }
    }

    const courses = await prisma.course.findMany({
      where: semesterId
        ? { semesterId, semester: { userId: user.id } }
        : { semester: { userId: user.id, purged: false } },
      include: {
        slots: true,
      },
      orderBy: { code: "asc" },
    });

    return NextResponse.json({ courses });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.errorResponse) return auth.errorResponse;
  const user = auth.user;

  try {
    const body = await req.json();
    const { semesterId, code, name, category, thresholdPct } = body;

    if (!code || !name) {
      return NextResponse.json({ error: "code and name are required" }, { status: 400 });
    }

    let targetSemesterId = semesterId;
    if (!targetSemesterId) {
      const active = await prisma.semester.findFirst({
        where: { userId: user.id, purged: false },
        orderBy: { createdAt: "desc" },
      });
      if (!active) {
        return NextResponse.json({ error: "No active semester found" }, { status: 400 });
      }
      targetSemesterId = active.id;
    } else {
      const ownership = await verifySemesterOwnership(targetSemesterId, user.id);
      if (!ownership.authorized) {
        return ownership.errorResponse;
      }
    }

    const course = await prisma.course.create({
      data: {
        semesterId: targetSemesterId,
        code,
        name,
        category: category || "theory",
        categorySource: "manual",
        thresholdPct: thresholdPct ?? (category === "lab" ? 90.0 : 70.0),
      },
      include: {
        slots: true,
      },
    });

    return NextResponse.json({ course }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
