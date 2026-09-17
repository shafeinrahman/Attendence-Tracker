import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (!auth.authenticated) return auth.errorResponse!;

  try {
    const { searchParams } = new URL(req.url);
    const semesterId = searchParams.get("semesterId");

    const courses = await prisma.course.findMany({
      where: semesterId ? { semesterId } : { semester: { purged: false } },
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
  const auth = authenticateRequest(req);
  if (!auth.authenticated) return auth.errorResponse!;

  try {
    const body = await req.json();
    const { semesterId, code, name, category, thresholdPct } = body;

    if (!code || !name) {
      return NextResponse.json({ error: "code and name are required" }, { status: 400 });
    }

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
