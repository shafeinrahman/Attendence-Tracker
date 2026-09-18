import { NextRequest, NextResponse } from "next/server";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "./prisma";

const JWT_SECRET_STRING =
  process.env.AUTH_SECRET ||
  process.env.NEXTAUTH_SECRET ||
  "attendance-tracker-super-secret-jwt-key-2026";

export function getJwtSecret(): Uint8Array {
  return new TextEncoder().encode(JWT_SECRET_STRING);
}

export async function signJwtToken(
  payload: { id: string; email: string },
  expiresIn = "30d"
): Promise<string> {
  const secret = getJwtSecret();
  return new SignJWT({ id: payload.id, email: payload.email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secret);
}

export async function verifyJwtToken(
  token: string
): Promise<{ id: string; email: string } | null> {
  try {
    const secret = getJwtSecret();
    const { payload } = await jwtVerify(token, secret);
    if (payload && payload.id && payload.email) {
      return {
        id: payload.id as string,
        email: payload.email as string,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function extractTokenFromRequest(req: NextRequest): string | null {
  // Check Authorization header: "Bearer <token>"
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.substring(7).trim();
  }

  // Check x-api-token header
  const customHeader = req.headers.get("x-api-token");
  if (customHeader) {
    return customHeader.trim();
  }

  // Check cookie (mobile/web fallback)
  const cookie =
    req.cookies.get("attendance_jwt")?.value ||
    req.cookies.get("authjs.session-token")?.value ||
    req.cookies.get("__Secure-authjs.session-token")?.value;

  if (cookie) {
    return cookie.trim();
  }

  return null;
}

export async function getAuthenticatedUser(
  req: NextRequest
): Promise<{ id: string; email: string } | null> {
  // 1. Check Bearer or JWT header/cookie first (Mobile & API clients)
  const token = extractTokenFromRequest(req);
  if (token) {
    const verified = await verifyJwtToken(token);
    if (verified) {
      return verified;
    }
  }

  // 2. Check NextAuth session (Web client cookie session)
  try {
    const { auth } = await import("../auth");
    const session = await auth();
    if (session?.user?.id && session.user.email) {
      return {
        id: session.user.id,
        email: session.user.email,
      };
    }
  } catch {
    // Session check fallback
  }

  return null;
}

export async function requireAuth(
  req: NextRequest
): Promise<
  | { user: { id: string; email: string }; errorResponse?: undefined }
  | { user?: undefined; errorResponse: NextResponse }
> {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    return {
      errorResponse: NextResponse.json(
        { error: "Unauthorized: Invalid or missing session/token" },
        { status: 401 }
      ),
    };
  }
  return { user };
}

// Ownership verification helpers to reject cross-user access

export async function verifySemesterOwnership(
  semesterId: string,
  userId: string
): Promise<
  | { authorized: true; semester: any }
  | { authorized: false; errorResponse: NextResponse }
> {
  const semester = await prisma.semester.findUnique({
    where: { id: semesterId },
  });

  if (!semester) {
    return {
      authorized: false,
      errorResponse: NextResponse.json(
        { error: "Semester not found" },
        { status: 404 }
      ),
    };
  }

  if (semester.userId !== userId) {
    return {
      authorized: false,
      errorResponse: NextResponse.json(
        { error: "Forbidden: You do not have access to this semester" },
        { status: 403 }
      ),
    };
  }

  return { authorized: true, semester };
}

export async function verifyCourseOwnership(
  courseId: string,
  userId: string
): Promise<
  | { authorized: true; course: any }
  | { authorized: false; errorResponse: NextResponse }
> {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: { semester: true },
  });

  if (!course) {
    return {
      authorized: false,
      errorResponse: NextResponse.json(
        { error: "Course not found" },
        { status: 404 }
      ),
    };
  }

  if (course.semester.userId !== userId) {
    return {
      authorized: false,
      errorResponse: NextResponse.json(
        { error: "Forbidden: You do not have access to this course" },
        { status: 403 }
      ),
    };
  }

  return { authorized: true, course };
}

export async function verifySlotOwnership(
  slotId: string,
  userId: string
): Promise<
  | { authorized: true; slot: any }
  | { authorized: false; errorResponse: NextResponse }
> {
  const slot = await prisma.classSlot.findUnique({
    where: { id: slotId },
    include: { course: { include: { semester: true } } },
  });

  if (!slot) {
    return {
      authorized: false,
      errorResponse: NextResponse.json(
        { error: "Class slot not found" },
        { status: 404 }
      ),
    };
  }

  if (slot.course.semester.userId !== userId) {
    return {
      authorized: false,
      errorResponse: NextResponse.json(
        { error: "Forbidden: You do not have access to this class slot" },
        { status: 403 }
      ),
    };
  }

  return { authorized: true, slot };
}
