import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signJwtToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { password } = body;
    const rawId = body.studentId ?? body.username ?? body.email;

    if (!rawId || typeof rawId !== "string" || rawId.trim().length === 0) {
      return NextResponse.json(
        { error: "A valid Student ID is required" },
        { status: 400 }
      );
    }

    if (!password || typeof password !== "string" || password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters long" },
        { status: 400 }
      );
    }

    const normalizedStudentId = rawId.trim();

    // Check if user already exists
    const existing = await prisma.user.findUnique({
      where: { studentId: normalizedStudentId },
    });

    if (existing) {
      return NextResponse.json(
        { error: "An account with this Student ID already exists" },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        studentId: normalizedStudentId,
        passwordHash,
      },
      select: {
        id: true,
        studentId: true,
        createdAt: true,
      },
    });

    const token = await signJwtToken({ id: user.id, studentId: user.studentId });

    const response = NextResponse.json(
      {
        message: "Account created successfully",
        token,
        user: {
          id: user.id,
          studentId: user.studentId,
        },
      },
      { status: 201 }
    );

    // Set cookie for browser sessions
    response.cookies.set("attendance_jwt", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: "/",
    });

    return response;
  } catch (error: any) {
    console.error("Signup error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create account" },
      { status: 500 }
    );
  }
}
