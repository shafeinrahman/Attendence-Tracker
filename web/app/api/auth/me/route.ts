import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.errorResponse) {
    return auth.errorResponse;
  }

  const user = await prisma.user.findUnique({
    where: { id: auth.user.id },
    select: {
      id: true,
      studentId: true,
      createdAt: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ user });
}
