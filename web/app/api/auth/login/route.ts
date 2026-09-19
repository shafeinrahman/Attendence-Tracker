import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signJwtToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { password } = body;
    const rawId = body.studentId ?? body.username ?? body.email;

    if (!rawId || !password) {
      return NextResponse.json(
        { error: "Student ID and password are required" },
        { status: 400 }
      );
    }

    const normalizedStudentId = String(rawId).trim();

    const user = await prisma.user.findUnique({
      where: { studentId: normalizedStudentId },
    });

    if (!user || !user.passwordHash) {
      return NextResponse.json(
        { error: "Invalid Student ID or password" },
        { status: 401 }
      );
    }

    const isValid = await bcrypt.compare(String(password), user.passwordHash);
    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid Student ID or password" },
        { status: 401 }
      );
    }

    const token = await signJwtToken({ id: user.id, studentId: user.studentId });

    const response = NextResponse.json(
      {
        message: "Login successful",
        token,
        user: {
          id: user.id,
          studentId: user.studentId,
        },
      },
      { status: 200 }
    );

    response.cookies.set("attendance_jwt", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60,
      path: "/",
    });

    return response;
  } catch (error: any) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to log in" },
      { status: 500 }
    );
  }
}
