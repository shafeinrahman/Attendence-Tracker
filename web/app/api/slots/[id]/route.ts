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
    const { startTime, endTime, roomCode, sessionMode, dayOfWeek, specificDate } = body;

    const dataToUpdate: any = {};
    if (startTime !== undefined) dataToUpdate.startTime = startTime;
    if (endTime !== undefined) dataToUpdate.endTime = endTime;
    if (roomCode !== undefined) dataToUpdate.roomCode = roomCode;
    if (sessionMode !== undefined) dataToUpdate.sessionMode = sessionMode;
    if (dayOfWeek !== undefined) dataToUpdate.dayOfWeek = dayOfWeek;
    if (specificDate !== undefined) {
      dataToUpdate.specificDate = specificDate ? new Date(specificDate) : null;
    }

    const slot = await prisma.classSlot.update({
      where: { id },
      data: dataToUpdate,
      include: { course: true },
    });

    return NextResponse.json({ slot });
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
    await prisma.classSlot.delete({
      where: { id },
    });
    return NextResponse.json({ message: "Class slot deleted successfully" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
