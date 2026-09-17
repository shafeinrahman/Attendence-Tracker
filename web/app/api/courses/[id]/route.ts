import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = authenticateRequest(req);
  if (!auth.authenticated) return auth.errorResponse!;

  try {
    const { id } = await params;
    const body = await req.json();
    const { name, code, category, thresholdPct } = body;

    const dataToUpdate: any = {};
    if (name !== undefined) dataToUpdate.name = name;
    if (code !== undefined) dataToUpdate.code = code;
    if (category !== undefined) {
      dataToUpdate.category = category;
      dataToUpdate.categorySource = "manual"; // Manual override lock
      if (thresholdPct === undefined) {
        dataToUpdate.thresholdPct = category === "lab" ? 90.0 : 70.0;
      }
    }
    if (thresholdPct !== undefined) {
      dataToUpdate.thresholdPct = thresholdPct;
      dataToUpdate.categorySource = "manual";
    }

    const course = await prisma.course.update({
      where: { id },
      data: dataToUpdate,
      include: { slots: true },
    });

    return NextResponse.json({ course });
  } catch (error: any) {
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
    await prisma.course.delete({
      where: { id },
    });
    return NextResponse.json({ message: "Course deleted successfully" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
